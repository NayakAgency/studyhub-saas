// ============================================================
// usePlans — Subscription plan hooks (admin + public)
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

export function usePlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/plans', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      toast.success('Plan created');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create plan'),
  });
}

export function useUpdatePlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/admin/plans/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      toast.success('Plan updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update plan'),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/plans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      toast.success('Plan deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete plan'),
  });
}

/** Public: plans visible on the hall website */
export function usePublicPlans(slug) {
  return useQuery({
    queryKey: ['public', 'hall', slug, 'plans'],
    queryFn: () => api.get(`/public/hall/${slug}/plans`).then((r) => r.data),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}
