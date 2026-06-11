import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { ComplaintStatusBadge, Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate } from '../../lib/utils.js';
import { MessageSquare } from 'lucide-react';

const STATUS_TABS = [
  { value: 'all', label: 'All' }, { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' },
];

const PRIORITY_COLORS = { low: 'default', normal: 'info', high: 'warning', urgent: 'danger' };

export default function AdminComplaints() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [response, setResponse] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'complaints', { page, status }],
    queryFn: () => api.get('/admin/complaints', { params: { page, limit: 20, status } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/complaints/${id}`, body),
    onSuccess: () => {
      toast.success('Complaint updated');
      qc.invalidateQueries(['admin', 'complaints']);
      setSelected(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const openDetail = (complaint) => {
    setSelected(complaint);
    setResponse(complaint.admin_response || '');
    setNewStatus(complaint.status);
  };

  const handleUpdate = () => {
    updateMutation.mutate({ id: selected.id, status: newStatus, adminResponse: response });
  };

  const columns = [
    { key: 'complaint_number', label: '#', render: (v) => <span className="text-xs font-mono text-gray-500">{v}</span> },
    {
      key: 'subject', label: 'Subject',
      render: (v, row) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{v}</p>
          <p className="text-xs text-gray-500">{row.student?.full_name} · <span className="capitalize">{row.category}</span></p>
        </div>
      )
    },
    { key: 'priority', label: 'Priority', render: (v) => <Badge variant={PRIORITY_COLORS[v] || 'default'} size="sm" className="capitalize">{v}</Badge> },
    { key: 'status', label: 'Status', render: (v) => <ComplaintStatusBadge status={v} /> },
    { key: 'created_at', label: 'Date', render: (v) => <span className="text-xs text-gray-500">{formatDate(v)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (_, row) => <Button variant="ghost" size="xs" onClick={() => openDetail(row)}>View</Button>
    },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Complaints</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data?.pagination?.total || 0} total complaints</p>
      </div>

      <Card>
        <div className="px-4 pt-4"><Tabs tabs={STATUS_TABS} active={status} onChange={(v) => { setStatus(v); setPage(1); }} /></div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination page={page} pages={data?.pagination?.pages || 1} total={data?.pagination?.total || 0} limit={20} onPageChange={setPage} />
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`Complaint ${selected?.complaint_number}`} size="md"
        footer={<><Button variant="secondary" onClick={() => setSelected(null)}>Close</Button><Button onClick={handleUpdate} loading={updateMutation.isPending}>Update</Button></>}>
        {selected && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <ComplaintStatusBadge status={selected.status} />
                <Badge variant={PRIORITY_COLORS[selected.priority] || 'default'} size="sm" className="capitalize">{selected.priority}</Badge>
                <span className="text-xs text-gray-500 ml-auto">{formatDate(selected.created_at)}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{selected.subject}</p>
              <p className="text-sm text-gray-700">{selected.description}</p>
              <p className="text-xs text-gray-400">By: {selected.student?.full_name} — <span className="capitalize">{selected.category}</span></p>
            </div>
            <Select label="Update Status" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }]} />
            <Textarea label="Admin Response" placeholder="Type your response to the student…" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
