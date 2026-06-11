import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { getErrorMessage } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const faqSchema = z.object({
  question:     z.string().min(5, 'Question is too short'),
  answer:       z.string().min(5, 'Answer is too short'),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive:     z.boolean().default(true),
});

function FAQForm({ initial, onClose }) {
  const qc = useQueryClient();
  const isEdit = !!initial;

  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm({
    resolver: zodResolver(faqSchema),
    defaultValues: {
      question:     initial?.question     || '',
      answer:       initial?.answer       || '',
      displayOrder: initial?.display_order ?? 0,
      isActive:     initial?.is_active    ?? true,
    },
  });

  const isActive = watch('isActive');

  const save = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/admin/faqs/${initial.id}`, data).then((r) => r.data)
        : api.post('/admin/faqs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['admin', 'faqs']);
      toast.success(isEdit ? 'FAQ updated' : 'FAQ created');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Question</label>
        <textarea
          {...register('question')}
          rows={2}
          placeholder="e.g. What are the hall timings?"
          className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
        />
        {errors.question && <p className="text-red-500 text-xs mt-1">{errors.question.message}</p>}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Answer</label>
        <textarea
          {...register('answer')}
          rows={4}
          placeholder="Provide a clear, helpful answer..."
          className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
        />
        {errors.answer && <p className="text-red-500 text-xs mt-1">{errors.answer.message}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Display Order</label>
          <Input type="number" {...register('displayOrder')} min="0" className="w-24" />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <button
            type="button"
            onClick={() => setValue('isActive', !isActive)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-primary-600' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm text-gray-600">Visible on website</span>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting || save.isPending} className="flex-1">
          {isEdit ? 'Save Changes' : 'Create FAQ'}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function AdminFAQs() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ['admin', 'faqs'],
    queryFn: () => api.get('/admin/faqs').then((r) => r.data),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.put(`/admin/faqs/${id}`, { isActive }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries(['admin', 'faqs']),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteFaq = useMutation({
    mutationFn: (id) => api.delete(`/admin/faqs/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['admin', 'faqs']);
      toast.success('FAQ deleted');
      setDeleting(null);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (faq) => { setEditing(faq); setModalOpen(true); };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">FAQs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage the FAQ section on your public hall website</p>
        </div>
        <Button leftIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>Add FAQ</Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
        </div>
      ) : faqs.length === 0 ? (
        <EmptyState
          icon={<HelpCircle className="h-10 w-10 text-gray-300" />}
          title="No FAQs yet"
          description="Add frequently asked questions to help students on your public website."
          action={<Button onClick={openCreate} leftIcon={<Plus className="h-4 w-4" />}>Add your first FAQ</Button>}
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {faqs.map((faq, idx) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <GripVertical className="h-5 w-5 text-gray-300 flex-shrink-0 mt-0.5 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-gray-900">{faq.question}</p>
                        {!faq.is_active && (
                          <Badge variant="default" size="sm">Hidden</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2">{faq.answer}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleActive.mutate({ id: faq.id, isActive: !faq.is_active })}
                        title={faq.is_active ? 'Hide from website' : 'Show on website'}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {faq.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(faq)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleting(faq)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          <p className="text-xs text-gray-400 text-center pt-2">
            {faqs.filter(f => f.is_active).length} of {faqs.length} FAQs visible on your website
          </p>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit FAQ' : 'Add FAQ'}
        size="md"
      >
        <FAQForm initial={editing} onClose={() => setModalOpen(false)} />
      </Modal>

      {/* Delete Confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete FAQ"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete this FAQ? This cannot be undone.
          </p>
          <p className="text-sm font-medium text-gray-800 bg-gray-50 rounded-lg p-3">
            "{deleting?.question}"
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={deleteFaq.isPending}
              onClick={() => deleteFaq.mutate(deleting.id)}
              className="flex-1"
            >
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
