// ============================================================
// Admin Analytics Routes
// Occupancy predictions, revenue forecasts, churn analysis,
// optimization recommendations, and historical trends
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { validateQuery } from '../../middleware/validate.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { cacheOrFetch } from '../../services/cache.service.js';
import {
  predictOccupancy,
  forecastRevenue,
  analyzeChurnRisk,
  getOptimizationRecommendations,
} from '../../services/analytics.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

// ============================================================
// GET /api/admin/analytics/dashboard
// Aggregated analytics overview for the analytics page
// ============================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    if (!tenantId) throw new Error('Tenant required');

    const [occupancyData, revenueData, churnData, recommendations] = await Promise.all([
      predictOccupancy(tenantId, 14),
      forecastRevenue(tenantId, 3),
      analyzeChurnRisk(tenantId),
      getOptimizationRecommendations(tenantId),
    ]);

    const dashboard = {
      overview: {
        occupancy_trend: occupancyData.trends?.weeklyGrowth ?? 0,
        revenue_growth:  revenueData.trends?.growth ?? 0,
        retention_health: churnData.overall_health?.score ?? 0,
        optimization_score: recommendations.summary?.estimated_impact?.score ?? 0,
      },
      quick_insights: [
        {
          type: 'occupancy',
          message: (occupancyData.trends?.weeklyGrowth ?? 0) >= 0
            ? `Occupancy growing at ${(occupancyData.trends?.weeklyGrowth ?? 0).toFixed(1)}% weekly`
            : `Occupancy declining by ${Math.abs(occupancyData.trends?.weeklyGrowth ?? 0).toFixed(1)}% weekly`,
          status: (occupancyData.trends?.weeklyGrowth ?? 0) >= 0 ? 'positive' : 'negative',
        },
        {
          type: 'revenue',
          message: `Revenue forecast: ${(revenueData.trends?.growth ?? 0).toFixed(1)}% growth`,
          status: (revenueData.trends?.growth ?? 0) >= 5 ? 'positive' : 'neutral',
        },
        {
          type: 'retention',
          message: `${churnData.at_risk_students?.length ?? 0} students at churn risk`,
          status: (churnData.at_risk_students?.length ?? 0) <= 5 ? 'positive' : 'warning',
        },
      ],
      action_items: (recommendations.recommendations || [])
        .filter((r) => r.priority === 'critical' || r.priority === 'high')
        .slice(0, 5),
      data: { occupancy: occupancyData, revenue: revenueData, churn: churnData, recommendations },
    };

    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/admin/analytics/occupancy?days=30
// ============================================================
router.get('/occupancy', validateQuery(z.object({
  days: z.coerce.number().min(1).max(90).default(30),
})), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { days } = req.q;
    const data = await predictOccupancy(tenantId, days);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/admin/analytics/revenue?months=6
// ============================================================
router.get('/revenue', validateQuery(z.object({
  months: z.coerce.number().min(1).max(24).default(6),
})), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { months } = req.q;
    const data = await forecastRevenue(tenantId, months);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/admin/analytics/churn
// ============================================================
router.get('/churn', async (req, res, next) => {
  try {
    const data = await analyzeChurnRisk(req.user.tenant_id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/admin/analytics/recommendations
// ============================================================
router.get('/recommendations', async (req, res, next) => {
  try {
    const data = await getOptimizationRecommendations(req.user.tenant_id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET /api/admin/analytics/overview?months=6
// Revenue, occupancy, student trend charts
// ============================================================
router.get('/overview', validateQuery(z.object({
  months: z.coerce.number().min(1).max(24).default(6),
})), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { months } = req.q;
    const since = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const cacheKey = `analytics:overview:${tenantId}:${months}`;
    const data = await cacheOrFetch(cacheKey, async () => {
      const [paymentsRes, seatsRes, studentsRes] = await Promise.all([
        supabaseAdmin
          .from('payments')
          .select('amount, payment_date, payment_method')
          .eq('tenant_id', tenantId)
          .eq('status', 'verified')
          .gte('payment_date', since),
        supabaseAdmin.from('seats').select('status').eq('tenant_id', tenantId),
        supabaseAdmin.from('students').select('status, created_at').eq('tenant_id', tenantId),
      ]);

      // Revenue by month
      const revenueByMonth = {};
      (paymentsRes.data || []).forEach((p) => {
        const m = p.payment_date.substring(0, 7);
        if (!revenueByMonth[m]) revenueByMonth[m] = { month: m, amount: 0, upi: 0, cash: 0 };
        revenueByMonth[m].amount += parseFloat(p.amount);
        revenueByMonth[m][p.payment_method] = (revenueByMonth[m][p.payment_method] || 0) + parseFloat(p.amount);
      });
      const revenueChart = Object.values(revenueByMonth).sort((a, b) => a.month.localeCompare(b.month));

      // Seat utilization
      const seats = seatsRes.data || [];
      const totalSeats = seats.length;
      const occupiedSeats = seats.filter((s) => s.status === 'occupied').length;

      // Method split
      const methodSplit = { upi: 0, cash: 0 };
      (paymentsRes.data || []).forEach((p) => {
        if (p.payment_method in methodSplit) methodSplit[p.payment_method] += parseFloat(p.amount);
      });

      return {
        revenueChart,
        occupancyRate: totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0,
        totalSeats,
        occupiedSeats,
        methodSplit,
        totals: {
          revenue: (paymentsRes.data || []).reduce((s, p) => s + parseFloat(p.amount), 0),
          activeStudents: (studentsRes.data || []).filter((s) => s.status === 'active').length,
        },
      };
    }, 600);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

export default router;
