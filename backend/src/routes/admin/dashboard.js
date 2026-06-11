// ============================================================
// Admin: Dashboard Stats Route
// ============================================================

import { Router } from 'express';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { cacheService, cacheOrFetch } from '../../services/cache.service.js';
import { broadcastDashboardUpdate } from '../../services/websocket.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

// GET /api/admin/dashboard/stats
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { refresh = false } = req.query;

    // Define cache key
    const cacheKey = `dashboard:${tenantId}`;

    // Function to fetch fresh data
    const fetchDashboardData = async () => {
      const today = new Date().toISOString().split('T')[0];
      const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [
        seatsRes, studentsRes, pendingAppsRes,
        renewalsDueRes, openComplaintsRes, pendingSeatChangesRes,
        revenueRes, sectionOccupancyRes,
        recentPaymentsRes, expiringMembershipsRes,
      ] = await Promise.all([
        // Seat counts
        supabaseAdmin.from('seats').select('status').eq('tenant_id', tenantId),
        // Student counts  
        supabaseAdmin.from('students').select('status').eq('tenant_id', tenantId),
        // Pending applications
        supabaseAdmin.from('seat_booking_requests').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'pending'),
        // Renewals due in 7 days
        supabaseAdmin.from('memberships').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'active')
          .gte('end_date', today).lte('end_date', in7Days),
        // Open complaints
        supabaseAdmin.from('complaints').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).in('status', ['open', 'in_progress']),
        // Pending seat change requests
        supabaseAdmin.from('seat_change_requests').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).eq('status', 'pending'),
        // Revenue last 6 months
        supabaseAdmin.from('payments').select('amount, payment_date')
          .eq('tenant_id', tenantId).eq('status', 'verified')
          .gte('payment_date', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
        // Section occupancy
        supabaseAdmin.from('sections').select(`
          name, color_code,
          seats(status)
        `).eq('tenant_id', tenantId).eq('is_active', true),
        // Recent payments
        supabaseAdmin.from('payments').select(`
          id, amount, payment_method, payment_date, receipt_number,
          student:students(full_name, student_code)
        `).eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(5),
        // Expiring memberships (next 7 days)
        supabaseAdmin.from('memberships').select(`
          id, end_date,
          student:students(full_name, student_code, phone),
          plan:subscription_plans(plan_name),
          seat:seats(seat_number)
        `).eq('tenant_id', tenantId).eq('status', 'active')
          .gte('end_date', today).lte('end_date', in7Days).order('end_date'),
      ]);

      // Process seat stats
      const seats = seatsRes.data || [];
      const totalSeats = seats.length;
      const occupiedSeats = seats.filter((s) => s.status === 'occupied').length;
      const availableSeats = seats.filter((s) => s.status === 'available').length;

      // Process student stats
      const students = studentsRes.data || [];
      const totalStudents = students.length;
      const activeStudents = students.filter((s) => s.status === 'active').length;

      // Revenue aggregation by month
      const revenueByMonth = {};
      (revenueRes.data || []).forEach((p) => {
        const month = p.payment_date.substring(0, 7); // YYYY-MM
        revenueByMonth[month] = (revenueByMonth[month] || 0) + parseFloat(p.amount);
      });
      const revenueChart = Object.entries(revenueByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount }));

      const totalRevenueLast6Months = Object.values(revenueByMonth).reduce((a, b) => a + b, 0);

      // Section occupancy
      const sectionStats = (sectionOccupancyRes.data || []).map((section) => {
        const seatList = section.seats || [];
        const total = seatList.length;
        const occupied = seatList.filter((s) => s.status === 'occupied').length;
        return {
          name: section.name,
          color: section.color_code,
          total,
          occupied,
          available: total - occupied,
          occupancyPercent: total > 0 ? Math.round((occupied / total) * 100) : 0,
        };
      });

      return {
        stats: {
          totalSeats,
          occupiedSeats,
          availableSeats,
          totalStudents,
          activeStudents,
          pendingApplications: pendingAppsRes.count || 0,
          renewalsDue: renewalsDueRes.count || 0,
          openComplaints: openComplaintsRes.count || 0,
          pendingSeatChanges: pendingSeatChangesRes.count || 0,
          totalRevenueLast6Months,
        },
        charts: {
          revenue: revenueChart,
          sectionOccupancy: sectionStats,
        },
        recentPayments: recentPaymentsRes.data || [],
        expiringMemberships: expiringMembershipsRes.data || [],
        lastUpdated: new Date().toISOString(),
      };
    };

    let dashboardData;

    if (refresh) {
      // Force refresh - invalidate cache and fetch fresh data
      await cacheService.invalidateDashboardStats(tenantId);
      dashboardData = await fetchDashboardData();
      await cacheService.setDashboardStats(tenantId, dashboardData, 300); // 5 minutes
    } else {
      // Use cache-or-fetch pattern
      dashboardData = await cacheOrFetch(cacheKey, fetchDashboardData, 300);
    }

    // Broadcast real-time update to connected admins
    broadcastDashboardUpdate(tenantId, dashboardData.stats);

    res.json(dashboardData);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/dashboard/platform-announcements
router.get('/platform-announcements', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_announcements')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

export default router;
