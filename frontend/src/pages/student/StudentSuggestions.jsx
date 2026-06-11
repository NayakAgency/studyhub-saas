import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { formatDate } from '../../lib/utils.js';
import { Plus, Lightbulb } from 'lucide-react';

const schema = z.object({
  subject: z.string().min(5, 'Enter a clear subject'),
  description: z.string().min(10, 'Please describe your suggestion'),
  isAnonymous: z.boolean().default(false),
});

const STATUS_VARIANTS = { received: 'info', reviewed: 'warning', implemented: 'success' };

export default function StudentSuggestions() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'suggestions'],
    queryFn: () => api.get('/student/suggestions').then((r) => r.data),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { isAnonymous: false },
  });

  const isAnonymous = watch('isAnonymous');

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/student/suggestions', body),
    onSuccess: () => {
      toast.success('Suggestion submitted!');
      qc.invalidateQueries(['student', 'suggestions']);
      setModal(false);
      reset();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 font-display">Suggestions</h1>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>New</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}</div>
      ) : data?.length === 0 ? (
        <Card className="p-8 text-center">
          <Lightbulb className="h-12 w-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No suggestions yet</p>
          <p className="text-gray-400 text-xs mt-1">Share ideas to improve your study hall</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {data?.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">{s.subject}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(s.created_at)}</p>
                </div>
                <Badge variant={STATUS_VARIANTS[s.status] || 'default'} size="sm" className="capitalize flex-shrink-0">{s.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Submit a Suggestion" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit((d) => createMutation.mutate(d))} loading={createMutation.isPending}>Submit</Button>
          </>
        }>
        <form className="space-y-3">
          <Input label="Subject" required placeholder="Brief title for your suggestion" error={errors.subject?.message} {...register('subject')} />
          <Textarea label="Description" required rows={3} placeholder="Describe your idea in detail…" error={errors.description?.message} {...register('description')} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-primary-600" {...register('isAnonymous')} />
            <span className="text-sm text-gray-700">Submit anonymously</span>
          </label>
          {isAnonymous && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">Your name won't be shown to the admin.</p>}
        </form>
      </Modal>
    </div>
  );
}
