// ============================================================
// Admin: Seat & Section Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// ============================================================
// SECTIONS
// ============================================================

const sectionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  colorCode: z.string().default('#3B82F6'),
  displayOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

// GET /api/admin/sections
router.get('/sections', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sections')
      .select('*, seats(count)')
      .eq('tenant_id', req.user.tenant_id)
      .order('display_order');

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/sections
router.post('/sections', validateBody(sectionSchema), async (req, res, next) => {
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
router.put('/sections/:id', validateParams(uuidSchema), validateBody(sectionSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.colorCode !== undefined) updateData.color_code = req.body.colorCode;
    if (req.body.displayOrder !== undefined) updateData.display_order = req.body.displayOrder;
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive;

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
router.delete('/sections/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    // Check no seats exist
    const { count } = await supabaseAdmin
      .from('seats')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', req.params.id);

    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete section with seats. Remove seats first.' });
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

// ============================================================
// SEATS
// ============================================================

const seatSchema = z.object({
  sectionId: z.string().uuid(),
  seatNumber: z.string().min(1),
  rowPosition: z.number().optional(),
  colPosition: z.number().optional(),
  seatType: z.enum(['standard', 'premium', 'cabin']).default('standard'),
  notes: z.string().optional(),
});

const generateSeatsSchema = z.object({
  sectionId: z.string().uuid(),
  prefix: z.string().min(1),
  startNumber: z.number().min(1),
  count: z.number().min(1).max(200),
  seatType: z.enum(['standard', 'premium', 'cabin']).default('standard'),
});

// GET /api/admin/seats
router.get('/', validateQuery(z.object({
  sectionId: z.string().uuid().optional(),
})), async (req, res, next) => {
  try {
    const { sectionId } = req.q;

    let query = supabaseAdmin
      .from('seats')
      .select(`
        *,
        section:sections(id, name, color_code),
        student:students!assigned_seat_id(id, full_name, student_code, status)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .order('seat_number');

    if (sectionId) query = query.eq('section_id', sectionId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/seats/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seats')
      .select(`
        *,
        section:sections(*),
        student:students!assigned_seat_id(id, full_name, student_code, phone, status),
        memberships(*, plan:subscription_plans(plan_name))
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Seat not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/seats
router.post('/', validateBody(seatSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('seats')
      .insert({
        tenant_id: req.user.tenant_id,
        section_id: req.body.sectionId,
        seat_number: req.body.seatNumber,
        row_position: req.body.rowPosition || null,
        col_position: req.body.colPosition || null,
        seat_type: req.body.seatType,
        notes: req.body.notes || null,
        status: 'available',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Seat number already exists' });
      throw new Error(error.message);
    }

    req.logAudit({ action: AUDIT_ACTIONS.SEAT_CREATE, resourceType: 'seats', resourceId: data.id });
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/seats/generate
router.post('/generate', validateBody(generateSeatsSchema), async (req, res, next) => {
  try {
    const { sectionId, prefix, startNumber, count, seatType } = req.body;
    const tenantId = req.user.tenant_id;

    const seats = [];
    for (let i = 0; i < count; i++) {
      const num = startNumber + i;
      seats.push({
        tenant_id: tenantId,
        section_id: sectionId,
        seat_number: `${prefix}-${String(num).padStart(2, '0')}`,
        seat_type: seatType,
        status: 'available',
        row_position: Math.floor(i / 10),
        col_position: i % 10,
      });
    }

    const { data, error } = await supabaseAdmin.from('seats').insert(seats).select();
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'One or more seat numbers already exist. Check prefix/start number.' });
      throw new Error(error.message);
    }

    req.logAudit({
      action: AUDIT_ACTIONS.SEAT_BULK_GENERATE,
      resourceType: 'seats',
      newValues: { count: data.length, prefix, sectionId },
    });

    res.status(201).json({ created: data.length, seats: data });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/seats/:id
router.put('/:id', validateParams(uuidSchema), validateBody(seatSchema.partial()), async (req, res, next) => {
  try {
    const updateData = {};
    if (req.body.seatNumber !== undefined) updateData.seat_number = req.body.seatNumber;
    if (req.body.seatType !== undefined) updateData.seat_type = req.body.seatType;
    if (req.body.notes !== undefined) updateData.notes = req.body.notes;
    if (req.body.rowPosition !== undefined) updateData.row_position = req.body.rowPosition;
    if (req.body.colPosition !== undefined) updateData.col_position = req.body.colPosition;

    const { data, error } = await supabaseAdmin
      .from('seats')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Seat not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/seats/:id/status
router.patch('/:id/status', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const statusSchema = z.object({
      status: z.enum(['available', 'blocked', 'reserved', 'maintenance']),
    });
    const { status } = statusSchema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('seats')
      .update({ status })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Seat not found' });

    req.logAudit({
      action: status === 'blocked' ? AUDIT_ACTIONS.SEAT_BLOCK : AUDIT_ACTIONS.SEAT_UPDATE,
      resourceType: 'seats',
      resourceId: req.params.id,
      newValues: { status },
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/seats/bulk-status
router.patch('/bulk-status', async (req, res, next) => {
  try {
    const schema = z.object({
      ids: z.array(z.string().uuid()).min(1).max(50),
      status: z.enum(['available', 'blocked', 'reserved', 'maintenance']),
    });
    const { ids, status } = schema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('seats')
      .update({ status })
      .in('id', ids)
      .eq('tenant_id', req.user.tenant_id)
      .select('id, seat_number, status');

    if (error) throw new Error(error.message);
    res.json({ updated: data.length, seats: data });
  } catch (error) {
    next(error);
  }
});

export default router;

