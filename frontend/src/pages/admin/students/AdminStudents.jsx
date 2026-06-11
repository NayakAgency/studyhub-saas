import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api.js';
import { Table, Pagination } from '../../../components/ui/Table.jsx';
import { StudentStatusBadge } from '../../../components/ui/Badge.jsx';
import SearchBar from '../../../components/ui/SearchBar.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { ConfirmDialog } from '../../../components/ui/Modal.jsx';
import { formatDate, formatPhone } from '../../../lib/utils.js';
import { Plus, Download, UserX, Pencil } from 'lucide-react';
import { downloadCSV } from '../../../lib/utils.js';

const STATUS_TABS = [
  { value: 'all',       label: 'All' },
  { value: 'active',    label: 'Active' },
  { value: 'pending',   label: 'Pending' },
  { value: 'inactive',  label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

export default function AdminStudents() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'students', { page, search, status }],
    queryFn: () => api.get('/admin/students', { params: { page, limit: 20, search, status } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/students/${id}`),
    onSuccess: () => {
      toast.success('Student deleted');
      qc.invalidateQueries(['admin', 'students']);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const columns = [
    {
      key: 'full_name', label: 'Student', sortable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          <Avatar src={row.profile_photo_url} name={val} size="sm" />
          <div className="min-w-0">
            <Link to={`/admin/students/${row.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600 truncate block">
              {val}
            </Link>
            <p className="text-xs text-gray-500">{row.student_code}</p>
          </div>
        </div>
      )
    },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-sm font-mono">{formatPhone(v)}</span> },
    {
      key: 'assigned_seat', label: 'Seat',
      render: (v) => v ? (
        <div>
          <p className="text-sm font-medium">{v.seat_number}</p>
          <p className="text-xs text-gray-500">{v.section?.name}</p>
        </div>
      ) : <span className="text-gray-400 text-sm">No seat</span>
    },
    {
      key: 'memberships', label: 'Plan / Expiry',
      render: (v) => {
        const active = v?.find((m) => m.status === 'active');
        if (!active) return <span className="text-gray-400 text-sm">—</span>;
        return (
          <div>
            <p className="text-sm font-medium">{active.plan?.plan_name}</p>
            <p className="text-xs text-gray-500">Exp: {formatDate(active.end_date)}</p>
          </div>
        );
      }
    },
    { key: 'status', label: 'Status', render: (v) => <StudentStatusBadge status={v} /> },
    { key: 'registered_at', label: 'Registered', sortable: true, render: (v) => <span className="text-sm text-gray-500">{formatDate(v)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (_, row) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="sm" iconOnly onClick={() => navigate(`/admin/students/${row.id}`)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" iconOnly onClick={() => setDeleteTarget(row)}>
            <UserX className="h-3.5 w-3.5 text-red-400" />
          </Button>
        </div>
      )
    },
  ];

  const handleExport = () => {
    const rows = data?.data || [];
    const csv = [
      'Code,Name,Phone,Email,Seat,Status,Registered',
      ...rows.map((r) => `${r.student_code},${r.full_name},${r.phone},${r.email || ''},${r.assigned_seat?.seat_number || ''},${r.status},${r.registered_at || ''}`)
    ].join('\n');
    downloadCSV(csv, 'students.csv');
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} total students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>Export</Button>
          <Link to="/admin/students/new">
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>Add Student</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-100">
          <SearchBar placeholder="Search name, phone, ID…" onSearch={(v) => { setSearch(v); setPage(1); }} className="flex-1" />
        </div>
        <div className="px-4 pt-1">
          <Tabs tabs={STATUS_TABS} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        </div>

        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination
          page={page} pages={data?.pagination?.pages || 1}
          total={data?.pagination?.total || 0} limit={20}
          onPageChange={setPage}
        />
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Student"
        message={`Are you sure you want to permanently delete ${deleteTarget?.full_name}? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
