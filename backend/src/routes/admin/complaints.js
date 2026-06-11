// ============================================================
// Admin: Complaint Management Routes
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

// GET /api/admin/complaints
router.get('/', validateQuery(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'all']).default('all'),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status, priority } = req.q;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('complaints')
      .select(`
        *, student:students(id, full_name, student_code, profile_photo_url)
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (priority !== 'all') query = query.eq('priority', priority);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);
    res.json({ data, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/complaints/:id
router.patch('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      adminResponse: z.string().optional(),
    });
    const body = schema.parse(req.body);

    const updateData = {};
    if (body.status) updateData.status = body.status;
    if (body.priority) updateData.priority = body.priority;
    if (body.adminResponse !== undefined) updateData.admin_response = body.adminResponse;
    if (body.status === 'resolved' || body.status === 'closed') {
      updateData.resolved_at = new Date().toISOString();
      updateData.resolved_by = req.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select('*, student:students(id)')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Complaint not found' });

    // Notify student if response added
    if (body.adminResponse && data.student?.id) {
      await createNotification({
        tenantId: req.user.tenant_id,
        studentId: data.student.id,
        type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
        title: 'Complaint Update',
        body: `Your complaint #${data.complaint_number} has been ${body.status || 'updated'}.`,
        referenceId: data.id,
        referenceType: 'complaint',
      });
    }

    req.logAudit({
      action: AUDIT_ACTIONS.COMPLAINT_UPDATE,
      resourceType: 'complaints',
      resourceId: req.params.id,
      newValues: updateData,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;

