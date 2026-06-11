import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import SearchBar from '../../components/ui/SearchBar.jsx';
import Select from '../../components/ui/Select.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { Plus, ExternalLink, ShieldOff, ShieldCheck } from 'lucide-react';

export default function SuperAdminTenants() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'tenants', { page, search, status, plan }],
    queryFn: () => api.get('/super-admin/tenants', { params: { page, limit: 20, search, status, plan } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/super-admin/tenants/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries(['super-admin', 'tenants']); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const statusVariants = { active: 'success', suspended: 'danger', trial: 'warning', pending: 'info' };
  const planVariants = { standard: 'default', premium: 'primary', enterprise: 'purple' };

  const columns = [
    {
      key: 'hall_name', label: 'Hall', sortable: true,
      render: (v, row) => (
        <div>
          <Link to={`/super-admin/tenants/${row.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-600">{v}</Link>
          <p className="text-xs text-gray-500">{row.owner_name} · {row.city || '—'}</p>
        </div>
      )
    },
    { key: 'plan_type', label: 'Plan', render: (v) => <Badge variant={planVariants[v] || 'default'} size="sm" className="capitalize">{v}</Badge> },
    { key: 'status', label: 'Status', render: (v) => <Badge variant={statusVariants[v] || 'default'} size="sm" dot className="capitalize">{v}</Badge> },
    { key: 'activeStudents', label: 'Students', render: (v) => <span className="text-sm font-medium">{v || 0}</span> },
    { key: 'next_billing_date', label: 'Next Billing', render: (v) => <span className="text-sm text-gray-500">{v ? formatDate(v) : '—'}</span> },
    { key: 'created_at', label: 'Joined', render: (v) => <span className="text-xs text-gray-400">{formatDate(v)}</span> },
    {
      key: 'id', label: '', align: 'right',
      render: (id, row) => (
        <div className="flex items-center gap-1">
          <Link to={`/super-admin/tenants/${id}`}><Button variant="ghost" size="xs" iconOnly><ExternalLink className="h-3.5 w-3.5" /></Button></Link>
          {row.status === 'active'
            ? <Button variant="ghost" size="xs" iconOnly title="Suspend" onClick={() => statusMutation.mutate({ id, status: 'suspended' })}><ShieldOff className="h-3.5 w-3.5 text-red-400" /></Button>
            : <Button variant="ghost" size="xs" iconOnly title="Activate" onClick={() => statusMutation.mutate({ id, status: 'active' })}><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /></Button>
          }
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Study Halls</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} registered halls</p>
        </div>
        <Link to="/super-admin/tenants/new">
          <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add Hall</Button>
        </Link>
      </div>

      <Card>
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-100">
          <SearchBar placeholder="Search halls…" onSearch={(v) => { setSearch(v); setPage(1); }} className="flex-1" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}
            options={[{ value: 'all', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'trial', label: 'Trial' }, { value: 'suspended', label: 'Suspended' }]}
            className="w-36" />
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}
            options={[{ value: 'all', label: 'All Plans' }, { value: 'standard', label: 'Standard' }, { value: 'premium', label: 'Premium' }, { value: 'enterprise', label: 'Enterprise' }]}
            className="w-36" />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination page={page} pages={data?.pagination?.pages || 1} total={data?.pagination?.total || 0} limit={20} onPageChange={setPage} />
      </Card>
    </div>
  );
}
