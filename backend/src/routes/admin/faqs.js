// ============================================================
// Admin: Hall FAQs Management
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

const faqSchema = z.object({
  question:     z.string().min(5).max(500),
  answer:       z.string().min(5),
  displayOrder: z.number().int().min(0).default(0),
  isActive:     z.boolean().default(true),
});

// GET /api/admin/faqs
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('hall_faqs')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .order('display_order')
      .order('created_at');

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/faqs
router.post('/', validateBody(faqSchema), async (req, res, next) => {
  try {
    const { question, answer, displayOrder, isActive } = req.body;

    const { data, error } = await supabaseAdmin
      .from('hall_faqs')
      .insert({
        tenant_id:     req.user.tenant_id,
        question,
        answer,
        display_order: displayOrder,
        is_active:     isActive,
        created_by:    req.user.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/faqs/:id
router.put('/:id', validateParams(uuidSchema), validateBody(faqSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.question     !== undefined) updateData.question      = req.body.question;
    if (req.body.answer       !== undefined) updateData.answer        = req.body.answer;
    if (req.body.displayOrder !== undefined) updateData.display_order = req.body.displayOrder;
    if (req.body.isActive     !== undefined) updateData.is_active     = req.body.isActive;

    const { data, error } = await supabaseAdmin
      .from('hall_faqs')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'FAQ not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/faqs/reorder — bulk reorder by array of { id, displayOrder }
router.patch('/reorder', validateBody(z.object({
  items: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number() })).min(1),
})), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    await Promise.all(req.body.items.map(({ id, displayOrder }) =>
      supabaseAdmin
        .from('hall_faqs')
        .update({ display_order: displayOrder })
        .eq('id', id)
        .eq('tenant_id', tenantId)
    ));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/faqs/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('hall_faqs')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
