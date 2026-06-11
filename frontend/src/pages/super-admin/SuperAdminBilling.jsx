import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardBody, StatCard } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { Plus, CreditCard, TrendingUp } from 'lucide-react';

export default function SuperAdminBilling() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tenantId: '', amount: '', billingPeriodStart: '', billingPeriodEnd: '', status: 'paid', paymentMethod: 'upi' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'billing', { page, statusFilter }],
    queryFn: () => api.get('/super-admin/billing', { params: { page, limit: 20, status: statusFilter } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: tenants } = useQuery({
    queryKey: ['super-admin', 'tenants', 'all'],
    queryFn: () => api.get('/super-admin/tenants', { params: { limit: 100 } }).then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/billing', body),
    onSuccess: () => { toast.success('Billing record created'); qc.invalidateQueries(['super-admin', 'billing']); setModal(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const summary = data?.summary || {};

  const statusVariants = { paid: 'success', pending: 'warning', overdue: 'danger' };
  const TABS = [{ value: 'all', label: 'All' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'overdue', label: 'Overdue' }];

  const columns = [
    { key: 'invoice_number', label: 'Invoice', render: (v) => <span className="text-xs font-mono text-gray-600">{v}</span> },
    { key: 'tenant', label: 'Hall', render: (v) => <span className="text-sm font-medium">{v?.hall_name}</span> },
    { key: 'amount', label: 'Amount', render: (v) => <span className="text-sm font-semibold text-emerald-700">{formatCurrency(v)}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge variant={statusVariants[v] || 'default'} size="sm" dot className="capitalize">{v}</Badge> },
    { key: 'billing_period_start', label: 'Period', render: (v, row) => <span className="text-xs text-gray-500">{formatDate(v)} – {formatDate(row.billing_period_end)}</span> },
    { key: 'payment_date', label: 'Paid On', render: (v) => <span className="text-xs text-gray-400">{v ? formatDate(v) : '—'}</span> },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">SaaS Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform billing for all study halls</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>Record Payment</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Collected" value={formatCurrency(summary.collected || 0)} icon={<CreditCard className="h-5 w-5" />} iconBg="bg-emerald-100" iconColor="text-emerald-600" />
        <StatCard title="Outstanding" value={formatCurrency(summary.outstanding || 0)} icon={<CreditCard className="h-5 w-5" />} iconBg="bg-red-100" iconColor="text-red-600" />
        <StatCard title="MRR" value={formatCurrency(summary.mrr || 0)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-blue-100" iconColor="text-blue-600" />
        <StatCard title="ARR (Est.)" value={formatCurrency(summary.arr || 0)} icon={<TrendingUp className="h-5 w-5" />} iconBg="bg-violet-100" iconColor="text-violet-600" />
      </div>

      <Card>
        <div className="px-4 pt-4"><Tabs tabs={TABS} active={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1); }} /></div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination page={page} pages={data?.pagination?.pages || 1} total={data?.pagination?.total || 0} limit={20} onPageChange={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Record SaaS Payment" size="sm"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={() => createMutation.mutate({ ...form, amount: parseFloat(form.amount) })} loading={createMutation.isPending}>Save</Button></>}>
        <div className="space-y-3">
          <Select label="Study Hall" required value={form.tenantId} onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))} placeholder="Select hall"
            options={(tenants || []).map((t) => ({ value: t.id, label: t.hall_name }))} />
          <Input label="Amount (₹)" required type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Period Start" type="date" value={form.billingPeriodStart} onChange={(e) => setForm((f) => ({ ...f, billingPeriodStart: e.target.value }))} />
            <Input label="Period End" type="date" value={form.billingPeriodEnd} onChange={(e) => setForm((f) => ({ ...f, billingPeriodEnd: e.target.value }))} />
          </div>
          <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={[{ value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'overdue', label: 'Overdue' }]} />
        </div>
      </Modal>
    </div>
  );
}
