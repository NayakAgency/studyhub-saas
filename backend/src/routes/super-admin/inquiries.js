// ============================================================
// Super Admin — Hall Inquiries (leads from marketing page)
// GET    /api/super-admin/inquiries
// PATCH  /api/super-admin/inquiries/:id
// DELETE /api/super-admin/inquiries/:id
// ============================================================

import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

// GET /api/super-admin/inquiries
router.get('/', async (req, res, next) => {
  try {
    const { status = 'all', limit = 50, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('hall_inquiries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ data: data || [], total: count || 0 });
  } catch (err) { next(err); }
});

// PATCH /api/super-admin/inquiries/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowed = ['status', 'notes', 'is_read'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('hall_inquiries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/super-admin/inquiries/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('hall_inquiries')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
