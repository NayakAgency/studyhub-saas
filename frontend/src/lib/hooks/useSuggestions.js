// ============================================================
// useSuggestions — Admin & student suggestion hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

// ── Admin ────────────────────────────────────────────────────

export function useAdminSuggestions({ page = 1, limit = 20, status = 'all' } = {}) {
  return useQuery({
    queryKey: ['admin', 'suggestions', { page, status }],
    queryFn: () =>
      api.get('/admin/suggestions', { params: { page, limit, status } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useUpdateSuggestionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      api.patch(`/admin/suggestions/${id}`, { status }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'suggestions'] });
      toast.success('Suggestion updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update'),
  });
}

// ── Student ──────────────────────────────────────────────────

export function useStudentSuggestions() {
  return useQuery({
    queryKey: ['student', 'suggestions'],
    queryFn: () => api.get('/student/suggestions').then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSubmitSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/student/suggestions', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'suggestions'] });
      toast.success('Suggestion submitted — thank you!');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit suggestion'),
  });
}
