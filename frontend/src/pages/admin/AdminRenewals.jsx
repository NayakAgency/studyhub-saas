import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { Bell, RefreshCw } from 'lucide-react';

export default function AdminRenewals() {
  const [tab, setTab] = useState('upcoming');
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'renewals', tab, page],
    queryFn: () => api.get('/admin/renewals', { params: { tab, page, limit: 20 } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const remindMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/renewals/${id}/remind`),
    onSuccess: () => toast.success('Reminder sent'),
    onError: () => toast.error('Failed to send reminder'),
  });

  const columns = [
    {
      key: 'student', label: 'Student',
      render: (v) => <div><p className="text-sm font-medium text-gray-900">{v?.full_name}</p><p className="text-xs text-gray-500">{v?.phone}</p></div>
    },
    { key: 'seat', label: 'Seat', render: (v) => <span className="text-sm font-mono">{v?.seat_number || '—'}</span> },
    { key: 'plan', label: 'Plan', render: (v) => <span className="text-sm">{v?.plan_name}</span> },
    { key: 'end_date', label: 'Expires', render: (v) => <span className="text-sm">{formatDate(v)}</span> },
    {
      key: 'daysRemaining', label: 'Days Left',
      render: (v) => <Badge variant={v < 0 ? 'danger' : v <= 3 ? 'warning' : 'orange'} dot size="sm">{v < 0 ? `${Math.abs(v)}d overdue` : `${v}d`}</Badge>
    },
    {
      key: 'id', label: '', align: 'right',
      render: (id) => (
        <Button variant="ghost" size="xs" leftIcon={<Bell className="h-3 w-3" />}
          onClick={() => remindMutation.mutate(id)} loading={remindMutation.isPending}>
          Remind
        </Button>
      )
    },
  ];

  const TABS = [
    { value: 'upcoming', label: 'Upcoming (30 days)' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'all', label: 'All Active' },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Renewals</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} memberships</p>
      </div>

      <Card>
        <div className="px-4 pt-4"><Tabs tabs={TABS} active={tab} onChange={(v) => { setTab(v); setPage(1); }} /></div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination page={page} pages={data?.pagination?.pages || 1} total={data?.pagination?.total || 0} limit={20} onPageChange={setPage} />
      </Card>
    </div>
  );
}
