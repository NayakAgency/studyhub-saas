// ============================================================
// Student: Complaints & Suggestions Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('student'));

// GET /api/student/complaints
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('id, complaint_number, category, subject, status, priority, admin_response, created_at, updated_at')
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/student/complaints
router.post('/', validateBody(z.object({
  category: z.enum(['seat', 'facility', 'staff', 'payment', 'cleanliness', 'other']),
  subject: z.string().min(5),
  description: z.string().min(20, 'Please provide more detail'),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
})), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        tenant_id: req.user.tenant_id,
        student_id: req.user.student_id,
        category: req.body.category,
        subject: req.body.subject,
        description: req.body.description,
        priority: req.body.priority,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/student/suggestions
router.get('/suggestions', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('suggestions')
      .select('id, subject, status, is_anonymous, created_at')
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/student/suggestions
router.post('/suggestions', validateBody(z.object({
  subject: z.string().min(5),
  description: z.string().min(10),
  isAnonymous: z.boolean().default(false),
})), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('suggestions')
      .insert({
        tenant_id: req.user.tenant_id,
        student_id: req.body.isAnonymous ? null : req.user.student_id,
        subject: req.body.subject,
        description: req.body.description,
        is_anonymous: req.body.isAnonymous,
        status: 'received',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
