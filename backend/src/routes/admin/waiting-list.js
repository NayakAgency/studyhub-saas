// ============================================================
// Admin: Waiting List Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

const addSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  preferredPlanId: z.string().uuid().optional(),
  preferredSection: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/admin/waiting-list
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('waiting_list')
      .select('*, plan:subscription_plans!preferred_plan_id(plan_name, price)')
      .eq('tenant_id', req.user.tenant_id)
      .in('status', ['waiting', 'notified'])
      .order('added_at');
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/waiting-list
router.post('/', validateBody(addSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('waiting_list')
      .insert({
        tenant_id: req.user.tenant_id,
        full_name: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email || null,
        preferred_plan_id: req.body.preferredPlanId || null,
        preferred_section: req.body.preferredSection || null,
        notes: req.body.notes || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/waiting-list/:id/notify
router.patch('/:id/notify', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin.from('waiting_list')
      .update({ status: 'notified' })
      .eq('id', req.params.id).eq('tenant_id', req.user.tenant_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/waiting-list/:id/remove
router.patch('/:id/remove', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin.from('waiting_list')
      .update({ status: 'removed' })
      .eq('id', req.params.id).eq('tenant_id', req.user.tenant_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
