// ============================================================
// Super Admin — Platform Announcements
// GET    /api/super-admin/announcements
// POST   /api/super-admin/announcements
// PATCH  /api/super-admin/announcements/:id
// DELETE /api/super-admin/announcements/:id
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const announcementSchema = z.object({
  title:     z.string().min(1).max(200),
  content:   z.string().min(1),
  type:      z.enum(['info','warning','maintenance','update']).default('info'),
  target:    z.enum(['all','admins_only']).default('all'),
  is_active: z.boolean().default(true),
  expires_at: z.string().nullable().optional(),
});

// GET /api/super-admin/announcements
router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_announcements')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) { next(err); }
});

// POST /api/super-admin/announcements
router.post('/', validateBody(announcementSchema), async (req, res, next) => {
  try {
    // Look up the super_admin row for created_by
    const { data: sa } = await supabaseAdmin
      .from('super_admins')
      .select('id')
      .eq('user_id', req.user.sub)
      .single();

    const { data, error } = await supabaseAdmin
      .from('platform_announcements')
      .insert({ ...req.body, created_by: sa?.id || null })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// PATCH /api/super-admin/announcements/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const allowed = ['title','content','type','target','is_active','expires_at'];
    const updates = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );

    const { data, error } = await supabaseAdmin
      .from('platform_announcements')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/super-admin/announcements/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('platform_announcements')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
