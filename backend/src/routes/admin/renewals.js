// ============================================================
// Admin: Renewal Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/renewals
router.get('/', validateQuery(z.object({
  tab: z.enum(['upcoming', 'overdue', 'all']).default('upcoming'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
})), async (req, res, next) => {
  try {
    const { tab, page, limit } = req.q;
    const offset = (page - 1) * limit;
    const today = new Date().toISOString().split('T')[0];
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let query = supabaseAdmin
      .from('memberships')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, email),
        plan:subscription_plans(plan_name, price),
        seat:seats(seat_number)
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'active')
      .order('end_date')
      .range(offset, offset + limit - 1);

    if (tab === 'upcoming') query = query.gte('end_date', today).lte('end_date', in30Days);
    if (tab === 'overdue') query = query.lt('end_date', today);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Add days remaining
    const enriched = data.map((m) => ({
      ...m,
      daysRemaining: Math.ceil((new Date(m.end_date) - new Date()) / (1000 * 60 * 60 * 24)),
    }));

    res.json({ data: enriched, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/renewals/requests
router.get('/requests', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('renewal_requests')
      .select(`
        *,
        student:students(full_name, student_code, phone),
        plan:subscription_plans(plan_name, price)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/renewals/:id/approve
router.patch('/:id/approve', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      planId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      paymentAmount: z.number().optional(),
      paymentMethod: z.enum(['cash', 'upi']).optional(),
    });
    const body = schema.parse(req.body);
    const tenantId = req.user.tenant_id;

    const { data: renewal } = await supabaseAdmin
      .from('renewal_requests')
      .select('*, student:students(assigned_seat_id), membership:memberships(plan_id, seat_id)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!renewal) return res.status(404).json({ error: 'Renewal request not found' });

    const planId = body.planId || renewal.requested_plan_id || renewal.membership?.plan_id;
    const seatId = renewal.membership?.seat_id || renewal.student?.assigned_seat_id;

    const { data: plan } = await supabaseAdmin
      .from('subscription_plans').select('*').eq('id', planId).single();

    // Expire current membership
    if (renewal.current_membership_id) {
      await supabaseAdmin.from('memberships').update({ status: 'expired' })
        .eq('id', renewal.current_membership_id);
    }

    // Create new membership
    const start = body.startDate ? new Date(body.startDate) : new Date();
    const end = new Date(start);
    const days = plan.validity_days || (plan.validity_type === 'monthly' ? 30 : 7);
    end.setDate(end.getDate() + days);

    const { data: membership } = await supabaseAdmin.from('memberships').insert({
      tenant_id: tenantId,
      student_id: renewal.student_id,
      plan_id: planId,
      seat_id: seatId,
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0],
      status: 'active',
      created_by: req.user.id,
    }).select().single();

    // Record payment
    if (body.paymentAmount && body.paymentMethod) {
      await supabaseAdmin.from('payments').insert({
        tenant_id: tenantId,
        student_id: renewal.student_id,
        membership_id: membership.id,
        amount: body.paymentAmount,
        payment_method: body.paymentMethod,
        payment_date: new Date().toISOString().split('T')[0],
        recorded_by: req.user.id,
        status: 'verified',
      });
    }

    await supabaseAdmin.from('renewal_requests').update({
      status: 'approved',
    }).eq('id', req.params.id);

    await createNotification({
      tenantId,
      studentId: renewal.student_id,
      type: NOTIFICATION_TYPES.RENEWAL_REMINDER,
      title: 'Membership Renewed!',
      body: `Your membership has been renewed until ${end.toISOString().split('T')[0]}.`,
      referenceId: membership.id,
      referenceType: 'membership',
    });

    res.json({ success: true, membership });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/renewals/direct
// Admin directly renews a student membership (no pending request needed)
router.post('/direct', async (req, res, next) => {
  try {
    const schema = z.object({
      studentId:  z.string().uuid(),
      planId:     z.string().uuid().optional(),
      startDate:  z.string().optional(),
    });
    const body = schema.parse(req.body);
    const tenantId = req.user.tenant_id;

    // Get student + current active membership
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, assigned_seat_id')
      .eq('id', body.studentId)
      .eq('tenant_id', tenantId)
      .single();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { data: currentMembership } = await supabaseAdmin
      .from('memberships')
      .select('id, plan_id, seat_id')
      .eq('student_id', body.studentId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .single();

    const planId = body.planId || currentMembership?.plan_id;
    if (!planId) return res.status(400).json({ error: 'No plan specified and no current plan found' });

    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    // Expire current membership
    if (currentMembership) {
      await supabaseAdmin
        .from('memberships')
        .update({ status: 'expired' })
        .eq('id', currentMembership.id);
    }

    // Compute dates
    const start = body.startDate ? new Date(body.startDate) : new Date();
    const end   = new Date(start);
    const days  = plan.validity_days || (plan.validity_type === 'monthly' ? 30 : plan.validity_type === 'weekly' ? 7 : 1);
    end.setDate(end.getDate() + days);

    const seatId = currentMembership?.seat_id || student.assigned_seat_id || null;

    const { data: membership, error } = await supabaseAdmin
      .from('memberships')
      .insert({
        tenant_id:  tenantId,
        student_id: body.studentId,
        plan_id:    planId,
        seat_id:    seatId,
        start_date: start.toISOString().split('T')[0],
        end_date:   end.toISOString().split('T')[0],
        status:     'active',
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await createNotification({
      tenantId,
      studentId: body.studentId,
      type: NOTIFICATION_TYPES.RENEWAL_REMINDER,
      title: 'Membership Renewed',
      body: `Your membership has been renewed until ${end.toISOString().split('T')[0]}.`,
      referenceId: membership.id,
      referenceType: 'membership',
    });

    res.status(201).json({ success: true, membership });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/renewals/:id/remind
router.patch('/:id/remind', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data: membership } = await supabaseAdmin
      .from('memberships')
      .select('student_id, end_date, plan:subscription_plans(plan_name)')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (!membership) return res.status(404).json({ error: 'Membership not found' });

    const daysLeft = Math.ceil((new Date(membership.end_date) - new Date()) / (1000 * 60 * 60 * 24));

    await createNotification({
      tenantId: req.user.tenant_id,
      studentId: membership.student_id,
      type: NOTIFICATION_TYPES.RENEWAL_REMINDER,
      title: 'Membership Renewal Reminder',
      body: `Your membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please renew to keep your seat.`,
      referenceId: req.params.id,
      referenceType: 'membership',
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

