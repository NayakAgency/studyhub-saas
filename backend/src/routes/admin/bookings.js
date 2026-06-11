// ============================================================
// Admin: Seat Booking Requests & Applications
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';
import { sendStudentApprovedEmail } from '../../services/email.service.js';
import { env } from '../../config/env.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/bookings
router.get('/', validateQuery(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled', 'all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status } = req.q;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('seat_booking_requests')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, email, profile_photo_url),
        seat:seats!requested_seat_id(seat_number, section:sections(name)),
        plan:subscription_plans(plan_name, price, validity_type)
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({ data, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/bookings/:id/approve
router.patch('/:id/approve', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      seatId: z.string().uuid().optional(),
      planId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      paymentAmount: z.number().optional(),
      paymentMethod: z.enum(['cash', 'upi']).optional(),
      adminNotes: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const tenantId = req.user.tenant_id;

    // Get booking request
    const { data: booking } = await supabaseAdmin
      .from('seat_booking_requests')
      .select('*, student:students(*, email), plan:subscription_plans(*)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!booking) return res.status(404).json({ error: 'Booking request not found' });
    if (booking.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    const seatId = body.seatId || booking.requested_seat_id;
    const planId = body.planId || booking.plan_id;

    // Verify seat is available
    const { data: seat } = await supabaseAdmin
      .from('seats').select('*').eq('id', seatId).eq('tenant_id', tenantId).single();

    if (!seat) return res.status(400).json({ error: 'Seat not found' });
    if (seat.status === 'occupied') return res.status(400).json({ error: 'Seat is already occupied' });

    // Get plan details
    const { data: plan } = await supabaseAdmin
      .from('subscription_plans').select('*').eq('id', planId).single();

    if (!plan) return res.status(400).json({ error: 'Plan not found' });

    // Calculate membership dates
    const start = body.startDate ? new Date(body.startDate) : new Date();
    const end = new Date(start);
    const days = plan.validity_days || (plan.validity_type === 'monthly' ? 30 : plan.validity_type === 'weekly' ? 7 : 30);
    end.setDate(end.getDate() + days);

    // Create membership
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .insert({
        tenant_id: tenantId,
        student_id: booking.student_id,
        plan_id: planId,
        seat_id: seatId,
        start_date: start.toISOString().split('T')[0],
        end_date: end.toISOString().split('T')[0],
        status: 'active',
        created_by: req.user.id,
      })
      .select()
      .single();

    // Update student: assign seat + activate
    await supabaseAdmin.from('students').update({
      status: 'active',
      assigned_seat_id: seatId,
      activated_at: new Date().toISOString(),
    }).eq('id', booking.student_id).eq('tenant_id', tenantId);

    // Mark seat occupied
    await supabaseAdmin.from('seats').update({ status: 'occupied' }).eq('id', seatId);

    // Record payment if amount provided
    if (body.paymentAmount && body.paymentMethod) {
      const { data: payment } = await supabaseAdmin.from('payments').insert({
        tenant_id: tenantId,
        student_id: booking.student_id,
        membership_id: membership.id,
        amount: body.paymentAmount,
        payment_method: body.paymentMethod,
        payment_date: new Date().toISOString().split('T')[0],
        payment_screenshot_url: booking.payment_screenshot_url,
        utr_number: booking.utr_number || null,
        recorded_by: req.user.id,
        status: 'verified',
      }).select().single();

      // Store UTR in used_utrs to prevent fraud reuse
      if (booking.utr_number && payment) {
        await supabaseAdmin.from('used_utrs').upsert({
          tenant_id: tenantId,
          utr_number: booking.utr_number.trim().toUpperCase(),
          student_id: booking.student_id,
          payment_id: payment.id,
          verified_at: new Date().toISOString(),
        }, { onConflict: 'utr_number', ignoreDuplicates: true });
      }
    } else if (booking.utr_number) {
      // Even if no explicit payment, store UTR from booking if UPI was used
      await supabaseAdmin.from('used_utrs').upsert({
        tenant_id: tenantId,
        utr_number: booking.utr_number.trim().toUpperCase(),
        student_id: booking.student_id,
        payment_id: null,
        verified_at: new Date().toISOString(),
      }, { onConflict: 'utr_number', ignoreDuplicates: true });
    }

    // Update booking request status
    await supabaseAdmin.from('seat_booking_requests').update({
      status: 'approved',
      admin_notes: body.adminNotes || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    // Send notification
    await createNotification({
      tenantId,
      studentId: booking.student_id,
      type: NOTIFICATION_TYPES.GENERAL,
      title: 'Seat Booking Approved!',
      body: `Your seat ${seat.seat_number} has been assigned. Welcome!`,
      referenceId: membership.id,
      referenceType: 'membership',
    });

    // Send email
    if (booking.student?.email) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants').select('hall_name, slug').eq('id', tenantId).single();
      await sendStudentApprovedEmail({
        studentEmail: booking.student.email,
        studentName: booking.student.full_name,
        hallName: tenant?.hall_name,
        seatNumber: seat.seat_number,
        planName: plan.plan_name,
        loginUrl: `${env.appUrl}/${tenant?.slug}/login`,
      });
    }

    req.logAudit({
      action: AUDIT_ACTIONS.APPLICATION_APPROVE,
      resourceType: 'seat_booking_requests',
      resourceId: req.params.id,
    });

    res.json({ success: true, membership });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/bookings/:id/reject
router.patch('/:id/reject', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { adminNotes } = z.object({ adminNotes: z.string().optional() }).parse(req.body);

    const { data: booking } = await supabaseAdmin
      .from('seat_booking_requests').select('student_id')
      .eq('id', req.params.id).eq('tenant_id', req.user.tenant_id).single();

    if (!booking) return res.status(404).json({ error: 'Booking request not found' });

    await supabaseAdmin.from('seat_booking_requests').update({
      status: 'rejected',
      admin_notes: adminNotes || null,
      reviewed_by: req.user.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    // Notify student
    await createNotification({
      tenantId: req.user.tenant_id,
      studentId: booking.student_id,
      type: NOTIFICATION_TYPES.GENERAL,
      title: 'Booking Request Update',
      body: adminNotes || 'Your booking request was not approved. Please contact the admin.',
    });

    req.logAudit({
      action: AUDIT_ACTIONS.APPLICATION_REJECT,
      resourceType: 'seat_booking_requests',
      resourceId: req.params.id,
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

