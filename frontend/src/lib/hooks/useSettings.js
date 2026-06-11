// ============================================================
// useSettings — Hall settings hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

export function useHallSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useUpdateHallSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put('/admin/settings', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Settings saved');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to save settings'),
  });
}

export function useUpdateHallLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) =>
      api.post('/admin/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Logo updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to upload logo'),
  });
}
