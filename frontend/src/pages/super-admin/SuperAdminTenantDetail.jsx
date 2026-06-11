import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody, StatCard } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { formatDate, formatCurrency, daysRemaining } from '../../lib/utils.js';
import {
  ArrowLeft, ShieldOff, ShieldCheck, Users, CreditCard, MessageSquare,
  Edit2, Trash2, RefreshCw, Package, ExternalLink, Copy, Calendar,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import Select from '../../components/ui/Select.jsx';

const DEFAULT_PLANS = [
  { id: 'standard', name: 'standard', monthlyPrice: 999, yearlyPrice: 9990 },
  { id: 'premium', name: 'premium', monthlyPrice: 1999, yearlyPrice: 19990 },
  { id: 'enterprise', name: 'enterprise', monthlyPrice: null, yearlyPrice: null },
];

export default function SuperAdminTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [renewalModal, setRenewalModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [renewalForm, setRenewalForm] = useState({
    amount: '',
    billingPeriodStart: '',
    billingPeriodEnd: '',
    paymentMethod: '',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'tenant', id],
    queryFn: () => api.get(`/super-admin/tenants/${id}`).then((r) => r.data),
  });

  const { data: plansData } = useQuery({
    queryKey: ['super-admin', 'saas-plans'],
    queryFn: () => api.get('/super-admin/saas-plans').then((r) => r.data),
    placeholderData: DEFAULT_PLANS,
  });

  const plans = (plansData && plansData.length > 0 ? plansData : DEFAULT_PLANS).filter((p) => p.isActive !== false);

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/super-admin/tenants/${id}/status`, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries(['super-admin', 'tenant', id]);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const editMutation = useMutation({
    mutationFn: (body) => api.put(`/super-admin/tenants/${id}`, body),
    onSuccess: () => {
      toast.success('Hall updated');
      qc.invalidateQueries(['super-admin', 'tenant', id]);
      setEditMode(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to update'),
  });

  const upgradeMutation = useMutation({
    mutationFn: (planType) => api.put(`/super-admin/tenants/${id}`, { planType }),
    onSuccess: () => {
      toast.success('Plan updated');
      qc.invalidateQueries(['super-admin', 'tenant', id]);
      setUpgradeModal(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to upgrade plan'),
  });

  const renewMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/billing', body),
    onSuccess: () => {
      toast.success('Renewal recorded');
      qc.invalidateQueries(['super-admin', 'tenant', id]);
      setRenewalModal(false);
      setRenewalForm({ amount: '', billingPeriodStart: '', billingPeriodEnd: '', paymentMethod: '', notes: '' });
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to record renewal'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/super-admin/tenants/${id}`),
    onSuccess: () => {
      toast.success('Hall deleted');
      navigate('/super-admin/tenants');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to delete hall'),
  });

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!data) return <div className="p-6 text-gray-500">Hall not found</div>;

  const { tenant, stats, recentBilling } = data;
  const statusVariants = { active: 'success', suspended: 'danger', trial: 'warning', pending: 'info' };

  const origin = window.location.origin;
  const adminUrl = `${origin}/admin/login`;
  const studentUrl = `${origin}/${tenant.slug}`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  const handleEditSave = () => {
    editMutation.mutate({
      hallName: editForm.hallName,
      city: editForm.city,
      address: editForm.address,
    });
  };

  const startEdit = () => {
    setEditForm({
      hallName: tenant.hall_name,
      city: tenant.city || '',
      address: tenant.address || '',
    });
    setEditMode(true);
  };

  // Renewal info
  const nextBilling = tenant.next_billing_date || tenant.billing_period_end;
  const daysUntilRenewal = nextBilling ? daysRemaining(nextBilling) : null;
  const renewalStatus =
    daysUntilRenewal === null ? 'unknown'
    : daysUntilRenewal < 0 ? 'overdue'
    : daysUntilRenewal <= 7 ? 'due-soon'
    : 'ok';

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* Header Card */}
      <Card className="p-5">
        {editMode ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-800">Edit Hall Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Hall Name"
                value={editForm.hallName}
                onChange={(e) => setEditForm((f) => ({ ...f, hallName: e.target.value }))}
              />
              <Input
                label="City"
                value={editForm.city}
                onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
              />
              <Input
                label="Address"
                value={editForm.address}
                onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEditSave} loading={editMutation.isPending}>
                Save Changes
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-gray-900 font-display">{tenant.hall_name}</h1>
                <Badge variant={statusVariants[tenant.status] || 'default'} dot className="capitalize">
                  {tenant.status}
                </Badge>
                <Badge
                  variant={
                    tenant.plan_type === 'enterprise' ? 'purple'
                    : tenant.plan_type === 'premium' ? 'primary'
                    : 'default'
                  }
                  className="capitalize"
                >
                  {tenant.plan_type}
                </Badge>
              </div>
              <p className="text-sm text-gray-500">
                {tenant.owner_name} · {tenant.owner_email} · {tenant.city || '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Slug: /{tenant.slug} · Joined {formatDate(tenant.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" leftIcon={<Edit2 className="h-4 w-4" />} onClick={startEdit}>
                Edit Hall
              </Button>
              <Button variant="secondary" size="sm" leftIcon={<Package className="h-4 w-4" />} onClick={() => setUpgradeModal(true)}>
                Upgrade Plan
              </Button>
              {tenant.status === 'active' ? (
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<ShieldOff className="h-4 w-4" />}
                  onClick={() => statusMutation.mutate('suspended')}
                  loading={statusMutation.isPending}
                >
                  Suspend
                </Button>
              ) : (
                <Button
                  variant="success"
                  size="sm"
                  leftIcon={<ShieldCheck className="h-4 w-4" />}
                  onClick={() => statusMutation.mutate('active')}
                  loading={statusMutation.isPending}
                >
                  Activate
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleteConfirm(true)}
              >
                Delete Hall
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={stats?.totalStudents || 0}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          title="Active Students"
          value={stats?.activeStudents || 0}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          title="Open Complaints"
          value={stats?.openComplaints || 0}
          icon={<MessageSquare className="h-5 w-5" />}
          iconBg="bg-red-100"
          iconColor="text-red-600"
        />
      </div>

      {/* Portal Links */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-800">Portal Links</h3>
        </CardHeader>
        <div className="divide-y divide-gray-100">
          {[
            { label: 'Admin Login URL', url: adminUrl },
            { label: 'Student Portal URL', url: studentUrl },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between px-5 py-3 gap-3">
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-sm font-medium text-gray-900 font-mono">{url}</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => copyToClipboard(url)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Renewal Tracking */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-800">Renewal Tracking</h3>
          </div>
          <Button
            size="sm"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            onClick={() => setRenewalModal(true)}
          >
            Record Renewal
          </Button>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Period Start</p>
              <p className="text-sm font-semibold text-gray-900">
                {tenant.billing_period_start ? formatDate(tenant.billing_period_start) : '—'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Period End</p>
              <p className="text-sm font-semibold text-gray-900">
                {tenant.billing_period_end ? formatDate(tenant.billing_period_end) : '—'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 mb-1">Next Billing</p>
              <p className="text-sm font-semibold text-gray-900">
                {nextBilling ? formatDate(nextBilling) : '—'}
              </p>
            </div>
            <div
              className={`text-center p-3 rounded-xl ${
                renewalStatus === 'overdue' ? 'bg-red-50' :
                renewalStatus === 'due-soon' ? 'bg-amber-50' :
                'bg-emerald-50'
              }`}
            >
              <p className="text-xs text-gray-500 mb-1">Days Until Renewal</p>
              <div className="flex items-center justify-center gap-1">
                {renewalStatus === 'overdue' ? (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                ) : renewalStatus === 'due-soon' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <p
                  className={`text-sm font-bold ${
                    renewalStatus === 'overdue' ? 'text-red-700' :
                    renewalStatus === 'due-soon' ? 'text-amber-700' :
                    daysUntilRenewal === null ? 'text-gray-500' :
                    'text-emerald-700'
                  }`}
                >
                  {daysUntilRenewal === null ? '—' :
                   daysUntilRenewal < 0 ? `${Math.abs(daysUntilRenewal)}d overdue` :
                   `${daysUntilRenewal}d`}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Billing Amount:</span>
            <span className="text-sm font-semibold text-gray-900">
              {tenant.billing_amount ? formatCurrency(tenant.billing_amount) : '—'}
            </span>
            <span className="text-xs text-gray-400 capitalize">
              {tenant.billing_type ? `/ ${tenant.billing_type}` : ''}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-800">Billing History</h3>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Invoice', 'Period', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!recentBilling?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No billing records yet
                  </td>
                </tr>
              ) : recentBilling.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs">{b.invoice_number}</td>
                  <td className="px-4 py-2.5 text-gray-500">
                    {b.billing_period_start} – {b.billing_period_end}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-emerald-700">{formatCurrency(b.amount)}</td>
                  <td className="px-4 py-2.5">
                    <Badge
                      variant={b.status === 'paid' ? 'success' : b.status === 'overdue' ? 'danger' : 'warning'}
                      size="sm"
                      dot
                      className="capitalize"
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{formatDate(b.payment_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Upgrade Plan Modal */}
      <Modal
        open={upgradeModal}
        onClose={() => setUpgradeModal(false)}
        title="Upgrade / Change Plan"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUpgradeModal(false)}>Cancel</Button>
            <Button
              onClick={() => selectedPlan && upgradeMutation.mutate(selectedPlan)}
              loading={upgradeMutation.isPending}
              disabled={!selectedPlan}
            >
              Update Plan
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Current plan: <strong className="capitalize">{tenant.plan_type}</strong></p>
          <div className="space-y-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.name)}
                className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all ${
                  selectedPlan === plan.name
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold capitalize text-gray-900">{plan.name}</p>
                    {plan.maxSeats && (
                      <p className="text-xs text-gray-500">
                        {plan.maxSeats === -1 ? 'Unlimited' : `Up to ${plan.maxSeats}`} seats
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    {plan.monthlyPrice ? (
                      <p className="text-sm font-bold text-gray-900">₹{plan.monthlyPrice.toLocaleString('en-IN')}/mo</p>
                    ) : (
                      <p className="text-sm font-bold text-gray-900">Custom</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Record Renewal Modal */}
      <Modal
        open={renewalModal}
        onClose={() => setRenewalModal(false)}
        title="Record Renewal Payment"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewalModal(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!renewalForm.amount || !renewalForm.billingPeriodStart || !renewalForm.billingPeriodEnd) {
                  toast.error('Amount and billing period are required');
                  return;
                }
                renewMutation.mutate({
                  tenantId: id,
                  amount: parseFloat(renewalForm.amount),
                  billingPeriodStart: renewalForm.billingPeriodStart,
                  billingPeriodEnd: renewalForm.billingPeriodEnd,
                  status: 'paid',
                  paymentMethod: renewalForm.paymentMethod || undefined,
                  notes: renewalForm.notes || undefined,
                  paymentDate: new Date().toISOString(),
                });
              }}
              loading={renewMutation.isPending}
            >
              Record Payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Amount (₹)"
            type="number"
            required
            value={renewalForm.amount}
            onChange={(e) => setRenewalForm((f) => ({ ...f, amount: e.target.value }))}
            placeholder={tenant.billing_amount || ''}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Period Start"
              type="date"
              required
              value={renewalForm.billingPeriodStart}
              onChange={(e) => setRenewalForm((f) => ({ ...f, billingPeriodStart: e.target.value }))}
            />
            <Input
              label="Period End"
              type="date"
              required
              value={renewalForm.billingPeriodEnd}
              onChange={(e) => setRenewalForm((f) => ({ ...f, billingPeriodEnd: e.target.value }))}
            />
          </div>
          <Select
            label="Payment Method"
            value={renewalForm.paymentMethod}
            onChange={(e) => setRenewalForm((f) => ({ ...f, paymentMethod: e.target.value }))}
            options={[
              { value: '', label: 'Select method...' },
              { value: 'upi', label: 'UPI' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
            ]}
          />
          <Input
            label="Notes (optional)"
            value={renewalForm.notes}
            onChange={(e) => setRenewalForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Study Hall"
        message={`Are you sure you want to permanently delete "${tenant.hall_name}"? This will delete all data including students, admins, and billing records. This cannot be undone.`}
        confirmLabel="Delete Permanently"
        loading={deleteMutation.isPending}
        confirmVariant="danger"
      />
    </div>
  );
}
