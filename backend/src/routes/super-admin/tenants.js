// ============================================================
// Super Admin: Tenant Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { sendTenantWelcomeEmail } from '../../services/email.service.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

const uuidSchema = z.object({ id: z.string().uuid() });

const createTenantSchema = z.object({
  hallName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug: lowercase, numbers, hyphens only'),
  city: z.string().optional(),
  address: z.string().optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPhone: z.string().min(10),
  planType: z.enum(['standard', 'premium', 'enterprise']).default('standard'),
  billingType: z.enum(['monthly', 'yearly', 'one_time']).default('monthly'),
  billingAmount: z.number().optional(),
  trialDays: z.number().optional(),
  sendWelcomeEmail: z.boolean().default(true),
});

// GET /api/super-admin/tenants
router.get('/', validateQuery(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  search: z.string().optional(),
  status: z.enum(['active', 'suspended', 'trial', 'pending', 'all']).default('all'),
  plan: z.enum(['standard', 'premium', 'enterprise', 'all']).default('all'),
})), async (req, res, next) => {
  try {
    const { page, limit, search, status, plan } = req.q;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('tenants')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== 'all') query = query.eq('status', status);
    if (plan !== 'all') query = query.eq('plan_type', plan);
    if (search) query = query.or(`hall_name.ilike.%${search}%,owner_name.ilike.%${search}%,city.ilike.%${search}%`);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    // Enrich with student counts
    const enriched = await Promise.all((data || []).map(async (tenant) => {
      const { count: studentCount } = await supabaseAdmin
        .from('students').select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenant.id).eq('status', 'active');
      return { ...tenant, activeStudents: studentCount || 0 };
    }));

    res.json({ data: enriched, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    next(error);
  }
});

// GET /api/super-admin/tenants/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants').select('*').eq('id', req.params.id).single();
    if (error || !tenant) return res.status(404).json({ error: 'Tenant not found' });

    const [studentsRes, paymentsRes, complaintRes, billingRes] = await Promise.all([
      supabaseAdmin.from('students').select('status').eq('tenant_id', req.params.id),
      supabaseAdmin.from('payments').select('amount').eq('tenant_id', req.params.id).eq('status', 'verified'),
      supabaseAdmin.from('complaints').select('id', { count: 'exact', head: true }).eq('tenant_id', req.params.id).in('status', ['open', 'in_progress']),
      supabaseAdmin.from('super_admin_billing').select('*').eq('tenant_id', req.params.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const totalRevenue = (paymentsRes.data || []).reduce((s, p) => s + parseFloat(p.amount), 0);

    res.json({
      tenant,
      stats: {
        totalStudents: studentsRes.data?.length || 0,
        activeStudents: studentsRes.data?.filter((s) => s.status === 'active').length || 0,
        totalRevenue,
        openComplaints: complaintRes.count || 0,
      },
      recentBilling: billingRes.data || [],
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/super-admin/tenants
router.post('/', validateBody(createTenantSchema), async (req, res, next) => {
  try {
    const { ownerName, ownerEmail, ownerPhone, sendWelcomeEmail, trialDays, ...tenantData } = req.body;

    // Check slug uniqueness
    const { data: existing } = await supabaseAdmin
      .from('tenants').select('id').eq('slug', tenantData.slug).single();
    if (existing) return res.status(409).json({ error: 'Slug already taken' });

    // Generate temp password
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase() + '1!';

    // Create auth user for hall admin
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
    });

    if (authError) return res.status(400).json({ error: authError.message });

    // Create tenant
    const trialEndsAt = trialDays
      ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .insert({
        hall_name: tenantData.hallName,
        slug: tenantData.slug,
        owner_name: ownerName,
        owner_email: ownerEmail,
        owner_phone: ownerPhone,
        address: tenantData.address || null,
        city: tenantData.city || null,
        plan_type: tenantData.planType,
        billing_type: tenantData.billingType,
        billing_amount: tenantData.billingAmount || null,
        status: trialDays ? 'trial' : 'active',
        trial_ends_at: trialEndsAt,
        onboarded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (tenantError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(tenantError.message);
    }

    // Create hall admin record
    await supabaseAdmin.from('hall_admins').insert({
      tenant_id: tenant.id,
      user_id: authData.user.id,
      full_name: ownerName,
      phone: ownerPhone,
      email: ownerEmail,
      role: 'owner',
    });

    // Create default hall settings
    await supabaseAdmin.from('hall_settings').insert({ tenant_id: tenant.id });

    // Send welcome email
    if (sendWelcomeEmail) {
      await sendTenantWelcomeEmail({
        ownerEmail,
        ownerName,
        hallName: tenant.hall_name,
        loginEmail: ownerEmail,
        tempPassword,
        slug: tenant.slug,
      });
    }

    req.logAudit({
      action: AUDIT_ACTIONS.TENANT_CREATE,
      resourceType: 'tenants',
      resourceId: tenant.id,
      newValues: { hallName: tenant.hall_name, slug: tenant.slug, ownerEmail },
    });

    res.status(201).json({ tenant, tempPassword: sendWelcomeEmail ? undefined : tempPassword });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/super-admin/tenants/:id/status
router.patch('/:id/status', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      status: z.enum(['active', 'suspended', 'trial', 'pending']),
      reason: z.string().optional(),
    });
    const { status, reason } = schema.parse(req.body);

    const { data, error } = await supabaseAdmin
      .from('tenants').update({ status }).eq('id', req.params.id).select().single();

    if (error || !data) return res.status(404).json({ error: 'Tenant not found' });

    req.logAudit({
      action: status === 'suspended' ? AUDIT_ACTIONS.TENANT_SUSPEND : AUDIT_ACTIONS.TENANT_ACTIVATE,
      resourceType: 'tenants',
      resourceId: req.params.id,
      newValues: { status, reason },
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// PUT /api/super-admin/tenants/:id
router.put('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const schema = z.object({
      hallName: z.string().optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      planType: z.enum(['standard', 'premium', 'enterprise']).optional(),
      billingAmount: z.number().optional(),
      nextBillingDate: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const updateData = {};
    if (body.hallName) updateData.hall_name = body.hallName;
    if (body.city) updateData.city = body.city;
    if (body.address) updateData.address = body.address;
    if (body.planType) updateData.plan_type = body.planType;
    if (body.billingAmount !== undefined) updateData.billing_amount = body.billingAmount;
    if (body.nextBillingDate) updateData.next_billing_date = body.nextBillingDate;

    const { data, error } = await supabaseAdmin
      .from('tenants').update(updateData).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ error: 'Tenant not found' });

    req.logAudit({ action: AUDIT_ACTIONS.TENANT_UPDATE, resourceType: 'tenants', resourceId: req.params.id });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/super-admin/tenants/:id
router.delete('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    // Get all hall admins to delete auth users
    const { data: admins } = await supabaseAdmin.from('hall_admins').select('user_id').eq('tenant_id', req.params.id);
    for (const admin of admins || []) {
      await supabaseAdmin.auth.admin.deleteUser(admin.user_id);
    }
    await supabaseAdmin.from('tenants').delete().eq('id', req.params.id);
    req.logAudit({ action: AUDIT_ACTIONS.TENANT_DELETE, resourceType: 'tenants', resourceId: req.params.id });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;

