import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table } from '../../components/ui/Table.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatDate } from '../../lib/utils.js';
import { Plus, Bell, X } from 'lucide-react';

export default function AdminWaitingList() {
  const [addModal, setAddModal] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', preferredPlanId: '', notes: '' });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'waiting-list'],
    queryFn: () => api.get('/admin/waiting-list').then((r) => r.data),
  });

  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
  });

  const addMutation = useMutation({
    mutationFn: (body) => api.post('/admin/waiting-list', body),
    onSuccess: () => { toast.success('Added to waiting list'); qc.invalidateQueries(['admin', 'waiting-list']); setAddModal(false); setForm({ fullName: '', phone: '', email: '', preferredSection: '', notes: '' }); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const notifyMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/waiting-list/${id}/notify`),
    onSuccess: () => { toast.success('Marked as notified'); qc.invalidateQueries(['admin', 'waiting-list']); },
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/waiting-list/${id}/remove`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries(['admin', 'waiting-list']); },
  });

  const planOptions = (plans || []).map((p) => ({ value: p.id, label: p.plan_name }));

  const columns = [
    { key: 'added_at', label: '#', render: (_, __, i) => <span className="text-xs text-gray-400 font-medium">{(i || 0) + 1}</span> },
    { key: 'full_name', label: 'Name', render: (v) => <p className="text-sm font-medium text-gray-900">{v}</p> },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-sm font-mono">{v}</span> },
    { key: 'plan', label: 'Preferred Plan', render: (v) => <span className="text-sm text-gray-600">{v?.plan_name || '—'}</span> },
    { key: 'status', label: 'Status', render: (v) => <Badge variant={v === 'notified' ? 'info' : 'warning'} size="sm" dot className="capitalize">{v}</Badge> },
    { key: 'added_at', label: 'Added', render: (v) => <span className="text-xs text-gray-500">{formatDate(v)}</span> },
    {
      key: 'id', label: '', align: 'right',
      render: (id, row) => (
        <div className="flex gap-1">
          {row.status === 'waiting' && (
            <Button variant="ghost" size="xs" leftIcon={<Bell className="h-3 w-3" />} onClick={() => notifyMutation.mutate(id)}>Notify</Button>
          )}
          <Button variant="ghost" size="xs" iconOnly onClick={() => removeMutation.mutate(id)}><X className="h-4 w-4 text-red-400" /></Button>
        </div>
      )
    },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Waiting List</h1>
          <p className="text-sm text-gray-500 mt-0.5">{data?.length || 0} people waiting</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddModal(true)}>Add Person</Button>
      </div>

      <Card><Table columns={columns} data={data} loading={isLoading} /></Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add to Waiting List" size="sm"
        footer={<><Button variant="secondary" onClick={() => setAddModal(false)}>Cancel</Button><Button onClick={() => addMutation.mutate(form)} loading={addMutation.isPending}>Add</Button></>}>
        <div className="space-y-3">
          <Input label="Full Name" required value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
          <Input label="Phone" required value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input label="Email (optional)" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Select label="Preferred Plan" placeholder="Any plan" options={planOptions} value={form.preferredPlanId || ''}
            onChange={(e) => setForm((f) => ({ ...f, preferredPlanId: e.target.value }))} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
