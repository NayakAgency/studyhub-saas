// ============================================================
// Admin: Contact Inquiries Routes
// GET    /api/admin/contact-inquiries
// PATCH  /api/admin/contact-inquiries/:id/read
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/contact-inquiries
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('contact_inquiries')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    // Unread count
    const { count: unreadCount } = await supabaseAdmin
      .from('contact_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_read', false);

    res.json({
      data: data || [],
      unreadCount: unreadCount || 0,
      pagination: { page: +page, limit: +limit, total: count },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/contact-inquiries/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_inquiries')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/contact-inquiries/:id/read
router.patch('/:id/read', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('contact_inquiries')
      .update({ is_read: true, responded_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
