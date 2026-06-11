// ============================================================
// Super Admin: Billing, Announcements, Audit, Support, Settings
// All routes are prefixed /api/super-admin (mounted in app.js)
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const uuidSchema = z.object({ id: z.string().uuid() });

// ── Billing ─────────────────────────────────────────────────

// GET /api/super-admin/billing
router.get('/billing', validateQuery(z.object({
  page:   z.coerce.number().default(1),
  limit:  z.coerce.number().default(20),
  status: z.enum(['paid','pending','overdue','all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status } = req.q;
    const offset = (page - 1) * limit;

    let q = supabaseAdmin
      .from('super_admin_billing')
      .select('*, tenant:tenants(hall_name, owner_email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    const { data: all } = await supabaseAdmin.from('super_admin_billing').select('amount, status, created_at');
    const collected    = (all||[]).filter(b=>b.status==='paid').reduce((s,b)=>s+parseFloat(b.amount),0);
    const outstanding  = (all||[]).filter(b=>b.status!=='paid').reduce((s,b)=>s+parseFloat(b.amount),0);
    const curMonth     = new Date().toISOString().substring(0,7);
    const mrr          = (all||[]).filter(b=>b.status==='paid'&&b.created_at?.startsWith(curMonth)).reduce((s,b)=>s+parseFloat(b.amount),0);

    res.json({
      data: data || [],
      pagination: { page, limit, total: count, pages: Math.ceil((count||0)/limit) },
      summary: { collected, outstanding, mrr, arr: mrr * 12 },
    });
  } catch (e) { next(e); }
});

// POST /api/super-admin/billing
router.post('/billing', validateBody(z.object({
  tenantId:           z.string().uuid(),
  amount:             z.number().positive(),
  billingPeriodStart: z.string(),
  billingPeriodEnd:   z.string(),
  status:             z.enum(['paid','pending','overdue']).default('paid'),
  paymentMethod:      z.string().optional(),
  paymentDate:        z.string().optional(),
  notes:              z.string().optional(),
})), async (req, res, next) => {
  try {
    const inv = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const { data, error } = await supabaseAdmin.from('super_admin_billing').insert({
      tenant_id:           req.body.tenantId,
      invoice_number:      inv,
      amount:              req.body.amount,
      billing_period_start:req.body.billingPeriodStart,
      billing_period_end:  req.body.billingPeriodEnd,
      status:              req.body.status,
      payment_method:      req.body.paymentMethod || null,
      payment_date:        req.body.paymentDate   || null,
      notes:               req.body.notes         || null,
    }).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// ── Settings ─────────────────────────────────────────────────

// GET /api/super-admin/settings
router.get('/settings', async (_req, res, next) => {
  try {
    res.json({
      appName:          process.env.APP_NAME  || 'StudyHub',
      supportEmail:     'support@studyhub.app',
      defaultTrialDays: 14,
    });
  } catch (e) { next(e); }
});

// ── Platform Announcements ────────────────────────────────────

// GET /api/super-admin/announcements
router.get('/announcements', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { next(e); }
});

// POST /api/super-admin/announcements
router.post('/announcements', validateBody(z.object({
  title:     z.string().min(1),
  content:   z.string().min(1),
  type:      z.enum(['info','warning','maintenance','update']).default('info'),
  target:    z.enum(['all','admins_only']).default('all'),
  expiresAt: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { data: sa } = await supabaseAdmin
      .from('super_admins').select('id').eq('user_id', req.user.id).single();

    const { data, error } = await supabaseAdmin.from('platform_announcements').insert({
      title:     req.body.title,
      content:   req.body.content,
      type:      req.body.type,
      target:    req.body.target,
      expires_at:req.body.expiresAt || null,
      created_by:sa?.id,
      is_active: true,
    }).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (e) { next(e); }
});

// DELETE /api/super-admin/announcements/:id
router.delete('/announcements/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin.from('platform_announcements').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── Audit Logs ────────────────────────────────────────────────

// GET /api/super-admin/audit-logs
router.get('/audit-logs', validateQuery(z.object({
  page:     z.coerce.number().default(1),
  limit:    z.coerce.number().default(50),
  tenantId: z.string().uuid().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, tenantId } = req.q;
    const offset = (page - 1) * limit;

    let q = supabaseAdmin
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (tenantId) q = q.eq('tenant_id', tenantId);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);
    res.json({ data: data || [], pagination: { page, limit, total: count } });
  } catch (e) { next(e); }
});

// ── Support ───────────────────────────────────────────────────

// GET /api/super-admin/support
router.get('/support', async (_req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_inquiries')
      .select('*, tenant:tenants(hall_name, owner_email)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { next(e); }
});

// PATCH /api/super-admin/support/:id/read
router.patch('/support/:id/read', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { error } = await supabaseAdmin
      .from('contact_inquiries')
      .update({ is_read: true, responded_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ success: true });
  } catch (e) { next(e); }
});

// ── Hall Owner Inquiries (leads/requests from marketing page) ──

// GET /api/super-admin/inquiries
router.get('/inquiries', validateQuery(z.object({
  page:   z.coerce.number().default(1),
  limit:  z.coerce.number().default(20),
  status: z.enum(['new','contacted','converted','rejected','all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, status } = req.q;
    const offset = (page - 1) * limit;

    let q = supabaseAdmin
      .from('hall_inquiries')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') q = q.eq('status', status);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    // Count unread
    const { count: unread } = await supabaseAdmin
      .from('hall_inquiries')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);

    res.json({
      data: data || [],
      pagination: { page, limit, total: count, pages: Math.ceil((count||0)/limit) },
      unreadCount: unread || 0,
    });
  } catch (e) { next(e); }
});

// PATCH /api/super-admin/inquiries/:id
router.patch('/inquiries/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      status:  z.enum(['new','contacted','converted','rejected']).optional(),
      notes:   z.string().optional(),
      is_read: z.boolean().optional(),
    });
    const body = schema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('hall_inquiries')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !data) return res.status(404).json({ error: 'Inquiry not found' });
    res.json(data);
  } catch (e) { next(e); }
});

// DELETE /api/super-admin/inquiries/:id
router.delete('/inquiries/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    await supabaseAdmin.from('hall_inquiries').delete().eq('id', req.params.id);
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;

