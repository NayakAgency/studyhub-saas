// ============================================================
// Super Admin: Dashboard + Analytics
// GET /api/super-admin/dashboard
// GET /api/super-admin/analytics
// ============================================================

import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('super_admin'));

// GET /api/super-admin/dashboard
router.get('/dashboard', async (_req, res, next) => {
  try {
    const [tenantsRes, studentsRes, revenueRes, newTenantsRes, inquiriesRes, pendingInquiriesRes] = await Promise.all([
      supabaseAdmin.from('tenants').select('id, status, plan_type, created_at, hall_name, city'),
      supabaseAdmin.from('students').select('id, tenant_id, status'),
      supabaseAdmin.from('super_admin_billing').select('amount, payment_date').eq('status', 'paid'),
      supabaseAdmin.from('tenants').select('id, hall_name, created_at').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('contact_inquiries').select('id, name, tenant_id, created_at, is_read').order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('hall_inquiries').select('id, owner_name, hall_name, city, plan_interest, status, is_read, created_at').eq('status', 'new').order('created_at', { ascending: false }).limit(5),
    ]);

    const tenants  = tenantsRes.data  || [];
    const students = studentsRes.data || [];
    const payments = revenueRes.data  || [];

    const totalHalls    = tenants.length;
    const activeHalls   = tenants.filter(t => t.status === 'active').length;
    const totalStudents = students.length;
    const activeStudents = students.filter(s => s.status === 'active').length;

    const monthlyRevenue = payments
      .filter(p => new Date(p.payment_date) >= new Date(Date.now() - 30*24*60*60*1000))
      .reduce((s, p) => s + parseFloat(p.amount), 0);
    const totalRevenue = payments.reduce((s, p) => s + parseFloat(p.amount), 0);

    // Revenue chart (last 12 months)
    const revenueByMonth = {};
    payments.forEach(p => {
      const m = p.payment_date?.substring(0, 7);
      if (m) revenueByMonth[m] = (revenueByMonth[m] || 0) + parseFloat(p.amount);
    });
    const revenueChart = Object.entries(revenueByMonth)
      .sort(([a],[b]) => a.localeCompare(b)).slice(-12)
      .map(([month, amount]) => ({ month, amount }));

    // Tenant growth chart (last 12 months)
    const tenantsByMonth = {};
    tenants.forEach(t => {
      const m = t.created_at?.substring(0, 7);
      if (m) tenantsByMonth[m] = (tenantsByMonth[m] || 0) + 1;
    });
    const tenantsChart = Object.entries(tenantsByMonth)
      .sort(([a],[b]) => a.localeCompare(b)).slice(-12)
      .map(([month, count]) => ({ month, count }));

    // Plan distribution
    const planDist = tenants.reduce((acc, t) => {
      acc[t.plan_type] = (acc[t.plan_type] || 0) + 1;
      return acc;
    }, {});

    res.json({
      kpis: { totalHalls, activeHalls, totalStudents, activeStudents, monthlyRevenue, totalRevenue },
      charts: {
        revenue: revenueChart,
        newTenants: tenantsChart,
        planDistribution: Object.entries(planDist).map(([plan, count]) => ({ plan, count })),
      },
      recentTenants:     newTenantsRes.data || [],
      recentInquiries:   inquiriesRes.data  || [],
      pendingRequests:   pendingInquiriesRes.data || [],
      pendingRequestsCount: (pendingInquiriesRes.data || []).length,
    });
  } catch (e) { next(e); }
});

// GET /api/super-admin/analytics
router.get('/analytics', async (_req, res, next) => {
  try {
    const { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('id, hall_name, city, plan_type, status');

    const studentsPerHall = await Promise.all((tenants || []).map(async t => {
      const { count } = await supabaseAdmin
        .from('students').select('*', { count: 'exact', head: true })
        .eq('tenant_id', t.id).eq('status', 'active');
      return { hallName: t.hall_name, city: t.city, count: count || 0 };
    }));

    res.json({ studentsPerHall });
  } catch (e) { next(e); }
});

export default router;
