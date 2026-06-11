// ============================================================
// Super Admin — Support (contact inquiries from all halls)
// GET   /api/super-admin/support
// PATCH /api/super-admin/support/:id
// ============================================================

import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

// GET /api/super-admin/support
// Returns contact inquiries across all tenants (unread first, recent 100)
router.get('/', async (req, res, next) => {
  try {
    const { is_read, limit = 100, offset = 0 } = req.query;

    let query = supabaseAdmin
      .from('contact_inquiries')
      .select(`
        *,
        tenants ( id, hall_name, slug )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (is_read !== undefined) {
      query = query.eq('is_read', is_read === 'true');
    }

    const { data, error, count } = await query;
    if (error) throw error;

    // Summary stats
    const { count: unreadCount } = await supabaseAdmin
      .from('contact_inquiries')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);

    res.json({
      data: data || [],
      total: count || 0,
      unread: unreadCount || 0,
    });
  } catch (err) { next(err); }
});

// PATCH /api/super-admin/support/:id  — mark read / add response
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['is_read', 'responded_at'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    if (req.body.is_read === true && !updates.responded_at) {
      updates.responded_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('contact_inquiries')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

export default router;
