// ============================================================
// useStudents — Admin student data hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

/**
 * Paginated + filtered student list
 */
export function useStudents({ page = 1, limit = 20, search = '', status = 'all' } = {}) {
  return useQuery({
    queryKey: ['admin', 'students', { page, search, status }],
    queryFn: () =>
      api.get('/admin/students', { params: { page, limit, search, status } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

/**
 * Single student detail
 */
export function useStudent(id) {
  return useQuery({
    queryKey: ['admin', 'students', id],
    queryFn: () => api.get(`/admin/students/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Create a new student (admin side)
 */
export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/admin/students', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      toast.success('Student created');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create student'),
  });
}

/**
 * Update student
 */
export function useUpdateStudent(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/admin/students/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'students', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast.success('Student updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update student'),
  });
}

/**
 * Delete student
 */
export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/students/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      toast.success('Student deleted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Delete failed'),
  });
}

/**
 * Update student status (active/suspended/inactive)
 */
export function useUpdateStudentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }) =>
      api.patch(`/admin/students/${id}/status`, { status, reason }).then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'students', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'students'] });
      toast.success('Status updated');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update status'),
  });
}
