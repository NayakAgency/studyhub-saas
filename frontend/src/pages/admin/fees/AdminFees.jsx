import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api.js';
import { Card, CardHeader } from '../../../components/ui/Card.jsx';
import { Table, Pagination } from '../../../components/ui/Table.jsx';
import { Badge } from '../../../components/ui/Badge.jsx';
import SearchBar from '../../../components/ui/SearchBar.jsx';
import Button from '../../../components/ui/Button.jsx';
import { formatCurrency, formatDate, daysRemaining } from '../../../lib/utils.js';
import { Plus, Download } from 'lucide-react';
import { downloadCSV } from '../../../lib/utils.js';

export default function AdminFees() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'payments', { page, search }],
    queryFn: () => api.get('/admin/payments', { params: { page, limit: 20, ...(search ? { search } : {}) } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const { data: overview } = useQuery({
    queryKey: ['admin', 'fees-overview'],
    queryFn: () => api.get('/admin/fees/overview').then((r) => r.data),
  });

  const columns = [
    { key: 'receipt_number', label: 'Receipt #', render: (v) => <span className="text-xs font-mono text-gray-600">{v}</span> },
    {
      key: 'student', label: 'Student',
      render: (v) => <div><p className="text-sm font-medium text-gray-900">{v?.full_name}</p><p className="text-xs text-gray-500">{v?.student_code}</p></div>
    },
    { key: 'amount', label: 'Amount', render: (v) => <span className="text-sm font-semibold text-emerald-700">{formatCurrency(v)}</span> },
    {
      key: 'payment_method', label: 'Method',
      render: (v) => <Badge variant={v === 'upi' ? 'primary' : 'default'} size="sm">{v?.toUpperCase()}</Badge>
    },
    { key: 'payment_date', label: 'Date', render: (v) => <span className="text-sm text-gray-600">{formatDate(v)}</span> },
    {
      key: 'id', label: '', align: 'right',
      render: (id) => (
        <Button variant="ghost" size="xs" onClick={() => window.open(`/admin/payments/${id}/receipt-preview`, '_blank')}>
          Receipt
        </Button>
      )
    },
  ];

  const handleExport = () => {
    const rows = data?.data || [];
    const csv = ['Receipt,Student,Amount,Method,Date', ...rows.map((r) => `${r.receipt_number},${r.student?.full_name},${r.amount},${r.payment_method},${r.payment_date}`)].join('\n');
    downloadCSV(csv, 'payments.csv');
  };

  // Summary stats from overview endpoint (full dataset, not just current page)
  const totalCollected = overview?.totalCollected ?? (data?.data || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Fee Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} payments recorded</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>Export</Button>
          <Link to="/admin/payments/record">
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>Record Payment</Button>
          </Link>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100">
          <SearchBar placeholder="Search student…" onSearch={(v) => { setSearch(v); setPage(1); }} />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination page={page} pages={data?.pagination?.pages || 1} total={data?.pagination?.total || 0} limit={20} onPageChange={setPage} />
      </Card>
    </div>
  );
}
