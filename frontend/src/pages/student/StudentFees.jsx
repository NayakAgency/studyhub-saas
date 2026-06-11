// ============================================================
// Student Fees Page
// View payment history + Submit UPI payment with UTR
// ============================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CreditCard, Plus, Upload, Clock, CheckCircle,
  XCircle, ChevronDown, AlertCircle, Download,
  Banknote, History, X,
} from 'lucide-react';
import { api, getErrorMessage } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatDate, formatCurrency, cn } from '../../lib/utils.js';

// ── Status config ─────────────────────────────────────────────

const STATUS_CONFIG = {
  verified: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Verified', badge: 'success' },
  pending:  { icon: Clock,       color: 'text-amber-600',  bg: 'bg-amber-50',   label: 'Pending',  badge: 'warning' },
  rejected: { icon: XCircle,     color: 'text-red-600',    bg: 'bg-red-50',     label: 'Rejected', badge: 'danger'  },
};

// ── Submit UPI Payment Form ───────────────────────────────────

function SubmitPaymentPanel({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    amount:      '',
    utrNumber:   '',
    description: '',
  });
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);

  const mutation = useMutation({
    mutationFn: (fd) => api.post('/student/payments/submit', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
    onSuccess: () => {
      toast.success('Payment submitted! Admin will verify shortly.');
      qc.invalidateQueries({ queryKey: ['student', 'fees'] });
      qc.invalidateQueries({ queryKey: ['student', 'payments', 'summary'] });
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large (max 5MB)'); return; }
    setScreenshot(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('Enter a valid amount');
    if (!form.utrNumber.trim()) return toast.error('UTR number is required');
    if (form.utrNumber.length < 12 || form.utrNumber.length > 22) return toast.error('UTR must be 12–22 characters');

    const fd = new FormData();
    fd.append('amount', form.amount);
    fd.append('utrNumber', form.utrNumber.toUpperCase());
    if (form.description) fd.append('description', form.description);
    if (screenshot) fd.append('screenshot', screenshot);

    mutation.mutate(fd);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary-600" />
            Submit UPI Payment
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors">
            <X className="h-4 w-4" />
          </button>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* How it works banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-3">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                Make UPI payment to the hall's UPI ID, then enter the UTR/transaction ID below.
                Admin will verify and send you a receipt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Amount (₹)"
                type="number"
                required
                placeholder="1500"
                min="1"
                value={form.amount}
                onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
              />
              <Input
                label="UTR Number"
                required
                placeholder="UTR123456789012"
                maxLength={22}
                value={form.utrNumber}
                onChange={(e) => setForm(f => ({ ...f, utrNumber: e.target.value.toUpperCase() }))}
                hint="12–22 chars, from your UPI app"
              />
            </div>

            <Input
              label="Note (optional)"
              placeholder="e.g. June month fee"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />

            {/* Screenshot upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Payment Screenshot (optional but recommended)
              </label>
              {screenshotPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-gray-200">
                  <img src={screenshotPreview} alt="screenshot" className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setScreenshot(null); setScreenshotPreview(null); }}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200
                  rounded-xl py-5 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all">
                  <Upload className="h-6 w-6 text-gray-400 mb-2" />
                  <span className="text-xs text-gray-500">Click to upload screenshot</span>
                  <span className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5MB</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                loading={mutation.isPending}
                leftIcon={<CreditCard className="h-4 w-4" />}
              >
                Submit Payment
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function StudentFees() {
  const [showForm, setShowForm] = useState(false);

  const { data: feesData, isLoading } = useQuery({
    queryKey: ['student', 'fees'],
    queryFn: () => api.get('/student/fees').then(r => r.data),
  });

  const { data: summary } = useQuery({
    queryKey: ['student', 'payments', 'summary'],
    queryFn: () => api.get('/student/payments/summary').then(r => r.data),
  });

  const payments = feesData || [];
  const pendingCount = payments.filter(p => p.status === 'pending').length;

  return (
    <div className="p-5 space-y-5 max-w-2xl">

      {/* ── Header ──────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Fee Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">UPI payments with UTR verification</p>
        </div>
        {!showForm && (
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowForm(true)}>
            Submit Payment
          </Button>
        )}
      </div>

      {/* ── Summary Cards ───────── */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-xs text-gray-500 font-medium">Total Paid</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {formatCurrency(summary.summary?.total_paid || 0)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{summary.summary?.payment_count || 0} payments</p>
          </Card>
          <Card className={cn('p-4', pendingCount > 0 && 'ring-2 ring-amber-200')}>
            <p className="text-xs text-gray-500 font-medium">Pending</p>
            <p className={cn('text-xl font-bold mt-1', pendingCount > 0 ? 'text-amber-600' : 'text-gray-400')}>
              {pendingCount}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">awaiting verification</p>
          </Card>
        </div>
      )}

      {/* ── Submit Form (inline) ── */}
      <AnimatePresence>
        {showForm && (
          <SubmitPaymentPanel onClose={() => setShowForm(false)} />
        )}
      </AnimatePresence>

      {/* ── Pending alert ───────── */}
      {pendingCount > 0 && !showForm && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {pendingCount} payment{pendingCount > 1 ? 's' : ''} pending admin verification
          </p>
        </div>
      )}

      {/* ── Payment History ──────── */}
      <Card>
        <CardHeader className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800">Payment History ({payments.length})</h3>
        </CardHeader>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : payments.length === 0 ? (
          <div className="py-12 text-center">
            <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No payments yet</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 text-xs text-primary-600 hover:underline"
            >
              Submit your first payment →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {payments.map((p) => {
              const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              return (
                <div key={p.id} className="flex items-start gap-3 px-5 py-3.5">
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', cfg.bg)}>
                    <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                      <Badge variant={cfg.badge} size="sm" dot>{cfg.label}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-gray-400">{formatDate(p.payment_date)}</span>
                      <span className="text-xs text-gray-400 uppercase">{p.payment_method}</span>
                      {p.utr_number && (
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 rounded">
                          UTR: {p.utr_number}
                        </span>
                      )}
                    </div>
                    {p.receipt_number && (
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{p.receipt_number}</p>
                    )}
                    {p.reject_reason && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> {p.reject_reason}
                      </p>
                    )}
                  </div>
                  {p.status === 'verified' && (
                    <button
                      onClick={() => window.open(`/api/student/fees/receipt/${p.id}`, '_blank')}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="Download receipt"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
