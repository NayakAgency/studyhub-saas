// ============================================================
// Admin Payments Page
// View all payments · Verify pending UPI submissions · Export CSV
// Payment methods: UPI (UTR) + Cash only — no gateway
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Download, TrendingUp, CheckCircle,
  XCircle, Search, Eye, AlertCircle, Banknote,
  Clock, BadgeCheck, ImageIcon, ExternalLink,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../lib/api.js';
import { Card, CardHeader, CardBody, StatCard } from '../../../components/ui/Card.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import { Skeleton } from '../../../components/ui/Skeleton.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { formatCurrency, formatDate, cn, downloadCSV } from '../../../lib/utils.js';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

// ── Constants ────────────────────────────────────────────────

const STATUS_VARIANTS = {
  verified: 'success',
  pending:  'warning',
  rejected: 'danger',
};

const METHOD_LABELS = {
  upi:  'UPI',
  cash: 'Cash',
};

const PAGE_TABS = [
  { value: 'all',     label: 'All Payments' },
  { value: 'pending', label: 'Pending Verification' },
];

// ── Verify / Reject Modal ────────────────────────────────────

function VerifyModal({ payment, onClose }) {
  const [rejectReason, setRejectReason] = useState('');
  const [action, setAction] = useState(null); // 'verify' | 'reject'
  const [sendReceipt, setSendReceipt] = useState(true);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: (act) => api.post(`/admin/payments/${payment.id}/verify`, {
      action: act,
      rejectReason: act === 'reject' ? rejectReason : undefined,
      sendReceipt: act === 'verify' ? sendReceipt : false,
    }),
    onSuccess: (_, act) => {
      qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      toast.success(act === 'verify' ? 'Payment verified ✓' : 'Payment rejected');
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Modal title="Verify Payment" onClose={onClose} size="md">
      <div className="space-y-4">

        {/* Payment info */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Student</span>
            <span className="font-semibold text-gray-900">{payment.student?.full_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Amount</span>
            <span className="font-bold text-emerald-700 text-base">{formatCurrency(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">UTR Number</span>
            <span className="font-mono text-gray-800 font-semibold">{payment.utr_number}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="text-gray-700">{formatDate(payment.payment_date)}</span>
          </div>
          {payment.description && (
            <div className="flex justify-between">
              <span className="text-gray-500">Note</span>
              <span className="text-gray-700 max-w-[200px] text-right">{payment.description}</span>
            </div>
          )}
        </div>

        {/* Screenshot */}
        {payment.payment_screenshot_url && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> Payment Screenshot
            </p>
            <a
              href={payment.payment_screenshot_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-600 text-sm hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Screenshot
            </a>
          </div>
        )}

        {/* Reject reason */}
        {action === 'reject' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none
                focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3}
              placeholder="Tell the student why the payment was rejected…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
        )}

        {/* Send receipt toggle (only for verify) */}
        {(action === 'verify' || !action) && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendReceipt}
              onChange={(e) => setSendReceipt(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Send receipt email to student</span>
          </label>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="success"
            className="flex-1"
            loading={mutation.isPending && action === 'verify'}
            onClick={() => { setAction('verify'); mutation.mutate('verify'); }}
            leftIcon={<BadgeCheck className="h-4 w-4" />}
          >
            Verify Payment
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={mutation.isPending && action === 'reject'}
            disabled={action === 'reject' && !rejectReason.trim()}
            onClick={() => {
              if (!action) { setAction('reject'); return; }
              if (action === 'reject' && rejectReason.trim()) mutation.mutate('reject');
            }}
            leftIcon={<XCircle className="h-4 w-4" />}
          >
            {action === 'reject' ? 'Confirm Reject' : 'Reject'}
          </Button>
        </div>

        {action === 'reject' && (
          <button
            onClick={() => { setAction(null); setRejectReason(''); }}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            Cancel rejection
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function AdminPayments() {
  const [tab, setTab]         = useState('all');
  const [page, setPage]       = useState(1);
  const [status, setStatus]   = useState('');
  const [method, setMethod]   = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]   = useState('');
  const [verifyTarget, setVerifyTarget] = useState(null);
  const LIMIT = 20;

  // Stats
  const statsQ = useQuery({
    queryKey: ['admin', 'payments', 'stats'],
    queryFn: () => api.get('/admin/payments/stats').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Pending payments (for verification tab)
  const pendingQ = useQuery({
    queryKey: ['admin', 'payments', 'pending'],
    queryFn: () => api.get('/admin/payments/pending').then(r => r.data),
    enabled: tab === 'pending',
    staleTime: 30_000,
  });

  // All payments list
  const paymentsQ = useQuery({
    queryKey: ['admin', 'payments', 'list', page, status, method, startDate, endDate],
    queryFn: () => api.get('/admin/payments', {
      params: {
        page, limit: LIMIT,
        status:  status    || undefined,
        method:  method    || undefined,
        from:    startDate || undefined,
        to:      endDate   || undefined,
      },
    }).then(r => r.data),
    enabled: tab === 'all',
    staleTime: 60_000,
    keepPreviousData: true,
  });

  const stats      = statsQ.data?.stats || {};
  const payments   = paymentsQ.data?.data || [];
  const pagination = paymentsQ.data?.pagination || {};
  const pending    = pendingQ.data || [];

  const handleExport = async () => {
    try {
      const res = await api.get('/admin/payments/export', {
        params: {
          from:   startDate || undefined,
          to:     endDate   || undefined,
          status: status    || undefined,
        },
      });
      downloadCSV(res.data, `payments-${new Date().toISOString().split('T')[0]}.csv`);
      toast.success('CSV exported');
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <div className="p-6 space-y-6 pb-20 md:pb-6">

      {/* ── Header ─────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">UPI & Cash · Verify student submissions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
            Export CSV
          </Button>
          <Link to="/admin/payments/record">
            <Button size="sm" leftIcon={<CreditCard className="h-4 w-4" />}>Record Payment</Button>
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Revenue',
            value: formatCurrency(stats.total_amount || 0),
            icon: <TrendingUp className="h-5 w-5" />,
            iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
          },
          {
            title: 'Transactions',
            value: stats.total_count || 0,
            icon: <CreditCard className="h-5 w-5" />,
            iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
          },
          {
            title: 'Verified',
            value: stats.successful_count || 0,
            icon: <CheckCircle className="h-5 w-5" />,
            iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
          },
          {
            title: 'Pending',
            value: statsQ.data?.pendingCount || 0,
            icon: <Clock className="h-5 w-5" />,
            iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
            highlight: (statsQ.data?.pendingCount || 0) > 0,
          },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={cn('p-4', c.highlight && 'ring-2 ring-amber-300')}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500">{c.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {statsQ.isLoading ? <Skeleton className="h-7 w-20 mt-1" /> : c.value}
                  </p>
                </div>
                <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', c.iconBg)}>
                  <span className={c.iconColor}>{c.icon}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Alert: pending verifications ───── */}
      {(statsQ.data?.pendingCount || 0) > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            {statsQ.data.pendingCount} payment{statsQ.data.pendingCount > 1 ? 's' : ''} waiting for verification
          </p>
          <button
            onClick={() => setTab('pending')}
            className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 underline"
          >
            Review now
          </button>
        </motion.div>
      )}

      {/* ── Tabs ───────────────────────────── */}
      <Tabs
        tabs={PAGE_TABS}
        active={tab}
        onChange={(v) => { setTab(v); setPage(1); }}
      />

      {/* ════════════════════════════════════════
          TAB: PENDING VERIFICATION
      ════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {tab === 'pending' && (
          <motion.div key="pending" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {pendingQ.isLoading ? (
              <Card className="p-6 space-y-3">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </Card>
            ) : pending.length === 0 ? (
              <Card className="p-14 text-center">
                <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">No pending payments to verify</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {pending.map((p) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Banknote className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-900">{p.student?.full_name}</p>
                              <p className="text-xs text-gray-500">{p.student?.student_code} · {p.student?.phone}</p>
                            </div>
                            <p className="font-bold text-emerald-700 text-lg flex-shrink-0">
                              {formatCurrency(p.amount)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                              UTR: {p.utr_number}
                            </span>
                            <span>{formatDate(p.payment_date)}</span>
                            {p.description && <span>{p.description}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            leftIcon={<Eye className="h-3.5 w-3.5" />}
                            onClick={() => setVerifyTarget(p)}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ════════════════════════════════════════
            TAB: ALL PAYMENTS
        ════════════════════════════════════════ */}
        {tab === 'all' && (
          <motion.div key="all" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-4">

            {/* Filters */}
            <Card>
              <CardBody>
                <div className="flex flex-wrap gap-3 items-end">
                  <Select
                    value={status}
                    onChange={e => { setStatus(e.target.value); setPage(1); }}
                    placeholder="All status"
                    options={[
                      { value: 'verified', label: 'Verified' },
                      { value: 'pending',  label: 'Pending'  },
                      { value: 'rejected', label: 'Rejected' },
                    ]}
                    className="min-w-[130px]"
                  />
                  <Select
                    value={method}
                    onChange={e => { setMethod(e.target.value); setPage(1); }}
                    placeholder="All methods"
                    options={[
                      { value: 'upi',  label: 'UPI'  },
                      { value: 'cash', label: 'Cash' },
                    ]}
                    className="min-w-[120px]"
                  />
                  <Input type="date" value={startDate}
                    onChange={e => { setStartDate(e.target.value); setPage(1); }}
                    className="w-36" placeholder="From" />
                  <Input type="date" value={endDate}
                    onChange={e => { setEndDate(e.target.value); setPage(1); }}
                    className="w-36" placeholder="To" />
                  {(status || method || startDate || endDate) && (
                    <Button variant="ghost" size="sm"
                      onClick={() => { setStatus(''); setMethod(''); setStartDate(''); setEndDate(''); setPage(1); }}>
                      Clear
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Table */}
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Receipt', 'Student', 'Amount', 'Method', 'UTR / Note', 'Date', 'Status', ''].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-gray-500 px-4 py-3 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paymentsQ.isLoading
                      ? Array(8).fill(0).map((_, i) => (
                        <tr key={i}>
                          {Array(8).fill(0).map((__, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                      : payments.length === 0
                      ? (
                        <tr>
                          <td colSpan={8} className="text-center text-gray-400 text-sm py-16">
                            No payments found
                          </td>
                        </tr>
                      )
                      : payments.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                            {p.receipt_number || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.student?.full_name || '—'}</p>
                            <p className="text-xs text-gray-400">{p.student?.student_code}</p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={p.payment_method === 'upi' ? 'primary' : 'default'}
                              size="sm"
                            >
                              {METHOD_LABELS[p.payment_method] || p.payment_method}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {p.utr_number
                              ? <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">{p.utr_number}</span>
                              : <span className="text-gray-300">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_VARIANTS[p.status] || 'default'} size="sm" dot>
                              {p.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {p.status === 'pending' && (
                                <button
                                  onClick={() => setVerifyTarget(p)}
                                  className="p-1.5 text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                  title="Verify payment"
                                >
                                  <BadgeCheck className="h-4 w-4" />
                                </button>
                              )}
                              <Link to={`/admin/payments/${p.id}/receipt-preview`}>
                                <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors" title="View receipt">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}>Prev</Button>
                    <Button variant="secondary" size="sm" disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Verify Modal ───────────────────── */}
      {verifyTarget && (
        <VerifyModal
          payment={verifyTarget}
          onClose={() => setVerifyTarget(null)}
        />
      )}
    </div>
  );
}
