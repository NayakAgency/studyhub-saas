// ============================================================
// useNotifications — Student notification hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

export function useNotifications({ page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ['student', 'notifications', { page }],
    queryFn: () =>
      api.get('/student/notifications', { params: { page, limit } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 10_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['student', 'notifications', 'count'],
    queryFn: () =>
      api
        .get('/student/notifications', { params: { page: 1, limit: 1 } })
        .then((r) => r.data.unreadCount ?? 0),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.patch(`/student/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/student/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'notifications'] });
      toast.success('All notifications marked as read');
    },
  });
}
