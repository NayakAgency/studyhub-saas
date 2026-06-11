// ============================================================
// usePayments — Admin & student payment hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api.js';
import toast from 'react-hot-toast';

// ── Admin ────────────────────────────────────────────────────

export function useAdminPayments({ page = 1, limit = 20, search = '', method = '' } = {}) {
  return useQuery({
    queryKey: ['admin', 'payments', { page, search, method }],
    queryFn: () =>
      api.get('/admin/payments', { params: { page, limit, search, method } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) =>
      api.post('/admin/payments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
      qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      toast.success('Payment recorded');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to record payment'),
  });
}

export function useAdminFees({ page = 1, limit = 20, search = '', status = 'all' } = {}) {
  return useQuery({
    queryKey: ['admin', 'fees', { page, search, status }],
    queryFn: () =>
      api.get('/admin/fees', { params: { page, limit, search, status } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 30_000,
  });
}

// ── Student ──────────────────────────────────────────────────

export function useStudentFees() {
  return useQuery({
    queryKey: ['student', 'fees'],
    queryFn: () => api.get('/student/fees').then((r) => r.data),
    staleTime: 60_000,
  });
}

export function useStudentPayments({ page = 1, limit = 20 } = {}) {
  return useQuery({
    queryKey: ['student', 'payments', { page }],
    queryFn: () =>
      api.get('/student/payments', { params: { page, limit } }).then((r) => r.data),
    keepPreviousData: true,
    staleTime: 60_000,
  });
}

export function usePaymentReceipt(paymentId) {
  return useQuery({
    queryKey: ['student', 'fees', 'receipt', paymentId],
    queryFn: () => api.get(`/student/fees/receipt/${paymentId}`).then((r) => r.data),
    enabled: !!paymentId,
    staleTime: Infinity, // receipts are immutable
  });
}

export function useRequestRenewal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData) =>
      api.post('/student/membership/renew', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student', 'membership'] });
      qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
      toast.success('Renewal request submitted');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit renewal'),
  });
}
