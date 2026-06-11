// ============================================================
// Admin: Section Management Routes (standalone)
// GET    /api/admin/sections
// POST   /api/admin/sections
// PUT    /api/admin/sections/:id
// DELETE /api/admin/sections/:id
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

const sectionSchema = z.object({
  name: z.string().min(1, 'Section name required'),
  description: z.string().optional(),
  colorCode: z.string().default('#3B82F6'),
  displayOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/admin/sections
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sections')
      .select(`
        *,
        seats:seats(count)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .order('display_order');

    if (error) throw new Error(error.message);

    // Flatten count
    const result = (data || []).map((s) => ({
      ...s,
      seat_count: Array.isArray(s.seats) ? s.seats[0]?.count ?? 0 : 0,
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sections
router.post('/', validateBody(sectionSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sections')
      .insert({
        tenant_id: req.user.tenant_id,
        name: req.body.name,
        description: req.body.description || null,
        color_code: req.body.colorCode,
        display_order: req.body.displayOrder,
        is_active: req.body.isActive,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/sections/:id
router.put('/:id', validateParams(uuidSchema), validateBody(sectionSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined)         updateData.name = req.body.name;
    if (req.body.description !== undefined)  updateData.description = req.body.description || null;
    if (req.body.colorCode !== undefined)    updateData.color_code = req.body.colorCode;
    if (req.body.displayOrder !== undefined) updateData.display_order = req.body.displayOrder;
    if (req.body.isActive !== undefined)     updateData.is_active = req.body.isActive;

    const { data, error } = await supabaseAdmin
      .from('sections')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Section not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/sections/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    // Guard: no seats in this section
    const { count } = await supabaseAdmin
      .from('seats')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', req.params.id)
      .eq('tenant_id', req.user.tenant_id);

    if (count > 0) {
      return res.status(400).json({
        error: 'Cannot delete a section that has seats. Remove all seats from this section first.',
      });
    }

    const { error } = await supabaseAdmin
      .from('sections')
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
