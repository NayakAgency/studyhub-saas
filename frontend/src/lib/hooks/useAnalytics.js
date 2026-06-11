// ============================================================
// useAnalytics — Admin & super-admin analytics hooks
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { api } from '../api.js';

/**
 * Hall-level analytics (revenue, occupancy, churn, etc.)
 * @param {'7d'|'30d'|'90d'|'1y'} period
 */
export function useAdminAnalytics(period = '30d') {
  return useQuery({
    queryKey: ['admin', 'analytics', period],
    queryFn: () =>
      api.get('/admin/analytics', { params: { period } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Revenue breakdown by month
 */
export function useRevenueReport(months = 6) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', months],
    queryFn: () =>
      api.get('/admin/reports/revenue', { params: { months } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Occupancy stats over time
 */
export function useOccupancyReport() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'occupancy'],
    queryFn: () => api.get('/admin/reports/occupancy').then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}

/**
 * Super admin platform-wide analytics
 */
export function useSuperAdminAnalytics(period = '30d') {
  return useQuery({
    queryKey: ['super-admin', 'analytics', period],
    queryFn: () =>
      api.get('/super-admin/analytics', { params: { period } }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });
}
