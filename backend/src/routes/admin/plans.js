// ============================================================
// Admin: Subscription Plans Routes
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

const planSchema = z.object({
  planName: z.string().min(1),
  description: z.string().optional(),
  planType: z.enum(['slot_based', 'full_day', 'open_hours', 'half_day', 'custom']),
  seatCategory: z.enum(['ac', 'non_ac', 'other', 'any']).default('any'),
  timeSlots: z.array(z.object({
    label: z.string(),
    start: z.string(),
    end: z.string(),
  })).optional(),
  validityType: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly', 'custom']),
  validityDays: z.number().optional(),
  price: z.number().positive(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  displayOrder: z.number().default(0),
});

// GET /api/admin/plans
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .order('display_order');

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/plans/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Plan not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/plans
router.post('/', validateBody(planSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({
        tenant_id: req.user.tenant_id,
        plan_name: req.body.planName,
        description: req.body.description || null,
        plan_type: req.body.planType,
        seat_category: req.body.seatCategory || 'any',
        time_slots: req.body.timeSlots || null,
        validity_type: req.body.validityType,
        validity_days: req.body.validityDays || null,
        price: req.body.price,
        features: req.body.features || [],
        is_active: req.body.isActive,
        display_order: req.body.displayOrder,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/plans/:id
router.put('/:id', validateParams(uuidSchema), validateBody(planSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    const fieldMap = {
      planName: 'plan_name', description: 'description', planType: 'plan_type',
      seatCategory: 'seat_category', timeSlots: 'time_slots',
      validityType: 'validity_type', validityDays: 'validity_days',
      price: 'price', isActive: 'is_active', displayOrder: 'display_order',
      features: 'features',
    };
    Object.entries(fieldMap).forEach(([key, dbKey]) => {
      if (req.body[key] !== undefined) updateData[dbKey] = req.body[key];
    });

    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Plan not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/plans/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    // Check no active memberships
    const { count } = await supabaseAdmin
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', req.params.id)
      .eq('status', 'active');

    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete plan with active memberships' });
    }

    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/plans/:id/duplicate
router.post('/:id/duplicate', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data: original } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (!original) return res.status(404).json({ error: 'Plan not found' });

    const { id, created_at, ...planData } = original;
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert({ ...planData, plan_name: `${original.plan_name} (Copy)`, is_active: false })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
