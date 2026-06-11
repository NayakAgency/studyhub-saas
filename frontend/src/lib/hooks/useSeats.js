// ============================================================
// useSeats — Admin seat & section data hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

export function useSeats(params = {}) {
  return useQuery({
    queryKey: ['admin', 'seats', params],
    queryFn: () => api.get('/admin/seats', { params }).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useSections() {
  return useQuery({
    queryKey: ['admin', 'sections'],
    queryFn: () => api.get('/admin/sections').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useCreateSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/seats', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'seats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      toast.success('Seat created');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create seat'),
  });
}

export function useUpdateSeat(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/admin/seats/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'seats'] });
      toast.success('Seat updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update seat'),
  });
}

export function useDeleteSeat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/seats/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'seats'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      toast.success('Seat deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete seat'),
  });
}

export function useCreateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/sections', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sections'] });
      qc.invalidateQueries({ queryKey: ['admin', 'seats'] });
      toast.success('Section created');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create section'),
  });
}

export function useUpdateSection(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/admin/sections/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sections'] });
      toast.success('Section updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update section'),
  });
}
