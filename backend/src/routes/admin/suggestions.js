// ============================================================
// Admin: Student Suggestions Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// GET /api/admin/suggestions
router.get('/', validateQuery(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  status: z.enum(['received', 'reviewed', 'implemented', 'all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status } = req.q;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('suggestions')
      .select(`
        id, subject, description, content, status, is_anonymous, created_at,
        student:students(id, full_name, student_code)
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Mask anonymous suggestions + normalize content fields
    const masked = (data || []).map((s) => ({
      ...s,
      // Support both old (content) and new (subject/description) schema
      subject: s.subject || s.content || '',
      description: s.description || s.content || '',
      student: s.is_anonymous ? null : s.student,
    }));

    res.json({
      data: masked,
      pagination: { page, limit, total: count, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/suggestions/:id
router.patch('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['received', 'reviewed', 'implemented']),
    });
    const body = schema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('suggestions')
      .update({ status: body.status })
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Suggestion not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
