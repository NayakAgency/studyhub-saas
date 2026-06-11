// ============================================================
// useAnnouncements — Admin announcement hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

export function useAnnouncements({ page = 1, limit = 20, search = '' } = {}) {
  return useQuery({
    queryKey: ['admin', 'announcements', { page, search }],
    queryFn: () =>
      api.get('/admin/announcements', { params: { page, limit, search } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/announcements', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      toast.success('Announcement created');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create announcement'),
  });
}

export function useUpdateAnnouncement(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/admin/announcements/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      toast.success('Announcement updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update announcement'),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      toast.success('Announcement deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete announcement'),
  });
}
