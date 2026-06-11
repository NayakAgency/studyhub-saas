// ============================================================
// Admin: Announcement Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { createBroadcastNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

const announcementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(['general', 'holiday', 'maintenance', 'fee_reminder', 'urgent']).default('general'),
  isPinned: z.boolean().default(false),
  expiresAt: z.string().optional(),
  notifyStudents: z.boolean().default(true),
});

// GET /api/admin/announcements
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/announcements
router.post('/', validateBody(announcementSchema), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { notifyStudents, ...announcementData } = req.body;

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        tenant_id: tenantId,
        title: announcementData.title,
        content: announcementData.content,
        type: announcementData.type,
        is_pinned: announcementData.isPinned,
        expires_at: announcementData.expiresAt || null,
        created_by: req.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Notify all active students
    if (notifyStudents) {
      await createBroadcastNotification({
        tenantId,
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        title: data.title,
        body: data.content.substring(0, 200),
        referenceId: data.id,
        referenceType: 'announcement',
      });
    }

    req.logAudit({
      action: AUDIT_ACTIONS.ANNOUNCEMENT_CREATE,
      resourceType: 'announcements',
      resourceId: data.id,
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/announcements/:id
router.put('/:id', validateParams(uuidSchema), validateBody(announcementSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    const fieldMap = {
      title: 'title', content: 'content', type: 'type',
      isPinned: 'is_pinned', expiresAt: 'expires_at',
    };
    Object.entries(fieldMap).forEach(([key, dbKey]) => {
      if (req.body[key] !== undefined) updateData[dbKey] = req.body[key];
    });

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Announcement not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    req.logAudit({ action: AUDIT_ACTIONS.ANNOUNCEMENT_DELETE, resourceType: 'announcements', resourceId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
