import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { ComplaintStatusBadge, Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { formatDate, relativeTime } from '../../lib/utils.js';
import { Plus, MessageSquare, ChevronRight } from 'lucide-react';

const schema = z.object({
  category: z.enum(['seat','facility','staff','payment','cleanliness','other']),
  subject: z.string().min(5, 'Enter a clear subject'),
  description: z.string().min(20, 'Please describe the issue in detail'),
  priority: z.enum(['low','normal','high']).default('normal'),
});

export default function StudentComplaints() {
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'complaints'],
    queryFn: () => api.get('/student/complaints').then((r) => r.data),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/student/complaints', body),
    onSuccess: () => { toast.success('Complaint submitted'); qc.invalidateQueries(['student', 'complaints']); setModal(false); reset(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const PRIORITY_COLORS = { low: 'default', normal: 'info', high: 'warning' };

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-display">Complaints</h1>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>New</Button>
      </div>

      {isLoading ? <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
        : data?.length === 0 ? (
          <Card className="p-8 text-center">
            <MessageSquare className="h-12 w-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No complaints yet</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data?.map((c) => (
              <Card key={c.id} interactive className="p-4" onClick={() => setDetail(c)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <ComplaintStatusBadge status={c.status} />
                      <Badge variant={PRIORITY_COLORS[c.priority] || 'default'} size="sm" className="capitalize">{c.priority}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.subject}</p>
                    <p className="text-xs text-gray-400 font-mono">{c.complaint_number} · {relativeTime(c.created_at)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        )}

      {/* New complaint modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Submit Complaint" size="md"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleSubmit((d) => createMutation.mutate(d))} loading={createMutation.isPending}>Submit</Button></>}>
        <form className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" required error={errors.category?.message}
              options={[{ value: 'seat', label: 'Seat' }, { value: 'facility', label: 'Facility' }, { value: 'staff', label: 'Staff' }, { value: 'payment', label: 'Payment' }, { value: 'cleanliness', label: 'Cleanliness' }, { value: 'other', label: 'Other' }]}
              placeholder="Select" {...register('category')} />
            <Select label="Priority"
              options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]}
              {...register('priority')} />
          </div>
          <Input label="Subject" required placeholder="Brief summary of your issue" error={errors.subject?.message} {...register('subject')} />
          <Textarea label="Description" required placeholder="Describe your complaint in detail…" rows={4} error={errors.description?.message} {...register('description')} />
        </form>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Complaint ${detail?.complaint_number}`} size="md">
        {detail && (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <ComplaintStatusBadge status={detail.status} />
              <Badge variant={PRIORITY_COLORS[detail.priority] || 'default'} size="sm" className="capitalize">{detail.priority}</Badge>
              <span className="text-xs text-gray-400 ml-auto">{formatDate(detail.created_at)}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{detail.subject}</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{detail.description}</p>
            {detail.admin_response && (
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-3">
                <p className="text-xs font-semibold text-primary-700 mb-1">Admin Response</p>
                <p className="text-sm text-primary-800">{detail.admin_response}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
