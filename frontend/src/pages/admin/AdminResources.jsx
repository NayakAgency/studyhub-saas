import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import FileUpload from '../../components/ui/FileUpload.jsx';
import { formatDate, formatFileSize } from '../../lib/utils.js';
import { Plus, Trash2, FileText, Download } from 'lucide-react';

export default function AdminResources() {
  const [modal, setModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', subjectTag: '' });
  const [file, setFile] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'resources'],
    queryFn: () => api.get('/admin/resources').then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (fd) => api.post('/admin/resources', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { toast.success('Resource uploaded'); qc.invalidateQueries(['admin', 'resources']); setModal(false); setFile(null); setForm({ title: '', description: '', subjectTag: '' }); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/resources/${id}`),
    onSuccess: () => { toast.success('Resource deleted'); qc.invalidateQueries(['admin', 'resources']); setDeleteTarget(null); },
  });

  const handleUpload = () => {
    if (!file) return toast.error('Select a PDF file');
    if (!form.title) return toast.error('Enter a title');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', form.title);
    fd.append('description', form.description);
    fd.append('subjectTag', form.subjectTag);
    uploadMutation.mutate(fd);
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Study Resources</h1>
          <p className="text-sm text-gray-500 mt-0.5">PDFs available to students</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>Upload PDF</Button>
      </div>

      {isLoading ? <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}</div>
        : data?.length === 0 ? <p className="text-gray-500 text-sm text-center py-12">No resources yet</p>
        : (
          <div className="space-y-3">
            {data?.map((resource) => (
              <Card key={resource.id} className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{resource.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    {resource.subject_tag && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{resource.subject_tag}</span>}
                    <span>{formatFileSize(resource.file_size_bytes)}</span>
                    <span>{formatDate(resource.created_at)}</span>
                    <span>{resource.download_count} views</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <a href={resource.file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="xs" iconOnly><Download className="h-4 w-4" /></Button>
                  </a>
                  <Button variant="ghost" size="xs" iconOnly onClick={() => setDeleteTarget(resource)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

      <Modal open={modal} onClose={() => setModal(false)} title="Upload Study Resource" size="sm"
        footer={<><Button variant="secondary" onClick={() => setModal(false)}>Cancel</Button><Button onClick={handleUpload} loading={uploadMutation.isPending}>Upload</Button></>}>
        <div className="space-y-3">
          <FileUpload label="PDF File" accept="application/pdf" value={file} onChange={setFile} hint="Only PDF files, max 10MB" />
          <Input label="Title" required placeholder="Study material title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <Input label="Subject Tag" placeholder="e.g. Mathematics, Physics" value={form.subjectTag} onChange={(e) => setForm((f) => ({ ...f, subjectTag: e.target.value }))} />
          <Input label="Description (optional)" placeholder="Brief description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Resource" message={`Delete "${deleteTarget?.title}"?`} confirmLabel="Delete" loading={deleteMutation.isPending} />
    </div>
  );
}
