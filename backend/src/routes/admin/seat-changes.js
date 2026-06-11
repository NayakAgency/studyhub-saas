// ============================================================
// Admin: Seat Change Requests Management
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/seat-changes
router.get('/', validateQuery(z.object({
  page:   z.coerce.number().default(1),
  limit:  z.coerce.number().default(20),
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status } = req.q;
    const tenantId = req.user.tenant_id;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('seat_change_requests')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, profile_photo_url),
        current_seat:seats!current_seat_id(seat_number, section:sections(name)),
        requested_seat:seats!requested_seat_id(seat_number, status, section:sections(name))
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({
      data: data || [],
      pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/seat-changes/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seat_change_requests')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, email, profile_photo_url, status),
        current_seat:seats!current_seat_id(id, seat_number, seat_type, section:sections(name, color_code)),
        requested_seat:seats!requested_seat_id(id, seat_number, seat_type, status, section:sections(name, color_code))
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Request not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/seat-changes/:id/approve
router.patch('/:id/approve', validateParams(uuidSchema), validateBody(z.object({
  adminNotes: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    const tenantId = req.user.tenant_id;

    const { data: request } = await supabaseAdmin
      .from('seat_change_requests')
      .select(`
        *,
        student:students(id, full_name, assigned_seat_id)
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    // Verify the requested seat is still available
    if (request.requested_seat_id) {
      const { data: seat } = await supabaseAdmin
        .from('seats')
        .select('status')
        .eq('id', request.requested_seat_id)
        .single();

      if (!seat || seat.status === 'occupied') {
        return res.status(400).json({ error: 'Requested seat is no longer available' });
      }
    }

    // Free the old seat
    if (request.current_seat_id) {
      await supabaseAdmin
        .from('seats')
        .update({ status: 'available' })
        .eq('id', request.current_seat_id)
        .eq('tenant_id', tenantId);
    }

    // Occupy the new seat
    if (request.requested_seat_id) {
      await supabaseAdmin
        .from('seats')
        .update({ status: 'occupied' })
        .eq('id', request.requested_seat_id);
    }

    // Update student's assigned seat
    await supabaseAdmin
      .from('students')
      .update({ assigned_seat_id: request.requested_seat_id })
      .eq('id', request.student_id)
      .eq('tenant_id', tenantId);

    // Update active membership seat_id
    await supabaseAdmin
      .from('memberships')
      .update({ seat_id: request.requested_seat_id })
      .eq('student_id', request.student_id)
      .eq('status', 'active');

    // Mark request approved
    await supabaseAdmin
      .from('seat_change_requests')
      .update({
        status:      'approved',
        admin_notes: adminNotes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    // Notify student
    await createNotification({
      tenantId,
      studentId: request.student_id,
      type:      NOTIFICATION_TYPES.SEAT_CHANGE,
      title:     'Seat Change Approved',
      body:      adminNotes
        ? `Your seat change request has been approved. ${adminNotes}`
        : 'Your seat has been changed. Please check your dashboard.',
      referenceId:   req.params.id,
      referenceType: 'seat_change_requests',
    });

    req.logAudit({
      action:       AUDIT_ACTIONS.STUDENT_UPDATE,
      resourceType: 'seat_change_requests',
      resourceId:   req.params.id,
      newValues:    { status: 'approved', newSeat: request.requested_seat_id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/seat-changes/:id/reject
router.patch('/:id/reject', validateParams(uuidSchema), validateBody(z.object({
  adminNotes: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { adminNotes } = req.body;
    const tenantId = req.user.tenant_id;

    const { data: request } = await supabaseAdmin
      .from('seat_change_requests')
      .select('student_id, requested_seat_id, status')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    // Free the reserved seat (if it was reserved when request was made)
    if (request.requested_seat_id) {
      // Only free if no other pending request uses this seat
      const { count } = await supabaseAdmin
        .from('seat_change_requests')
        .select('*', { count: 'exact', head: true })
        .eq('requested_seat_id', request.requested_seat_id)
        .eq('status', 'pending')
        .neq('id', req.params.id);

      if (!count || count === 0) {
        await supabaseAdmin
          .from('seats')
          .update({ status: 'available' })
          .eq('id', request.requested_seat_id)
          .eq('status', 'reserved');
      }
    }

    await supabaseAdmin
      .from('seat_change_requests')
      .update({
        status:      'rejected',
        admin_notes: adminNotes || null,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', req.params.id);

    // Notify student
    await createNotification({
      tenantId,
      studentId: request.student_id,
      type:      NOTIFICATION_TYPES.SEAT_CHANGE,
      title:     'Seat Change Request Declined',
      body:      adminNotes || 'Your seat change request was not approved. Please contact the admin for details.',
      referenceId:   req.params.id,
      referenceType: 'seat_change_requests',
    });

    req.logAudit({
      action:       AUDIT_ACTIONS.STUDENT_UPDATE,
      resourceType: 'seat_change_requests',
      resourceId:   req.params.id,
      newValues:    { status: 'rejected' },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
