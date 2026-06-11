// ============================================================
// useComplaints — Admin & student complaint hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

// ── Admin ────────────────────────────────────────────────────

export function useAdminComplaints({ page = 1, limit = 20, status = 'all', search = '' } = {}) {
  return useQuery({
    queryKey: ['admin', 'complaints', { page, status, search }],
    queryFn: () =>
      api.get('/admin/complaints', { params: { page, limit, status, search } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useRespondComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, response, status }) =>
      api.patch(`/admin/complaints/${id}`, { response, status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'complaints'] });
      toast.success('Response saved');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update complaint'),
  });
}

// ── Student ──────────────────────────────────────────────────

export function useStudentComplaints() {
  return useQuery({
    queryKey: ['student', 'complaints'],
    queryFn: () => api.get('/student/complaints').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSubmitComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/student/complaints', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'complaints'] });
      toast.success('Complaint submitted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit complaint'),
  });
}
