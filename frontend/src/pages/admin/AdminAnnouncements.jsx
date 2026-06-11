import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { api } from '../../lib/api.js';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatDate, relativeTime } from '../../lib/utils.js';
import { Plus, Trash2, Pin, PinOff, Bold, Italic, List } from 'lucide-react';

const TYPE_COLORS = { general: 'default', holiday: 'success', maintenance: 'danger', fee_reminder: 'warning', urgent: 'danger' };

export default function AdminAnnouncements() {
  const [modal, setModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'general', isPinned: false, expiresAt: '', notifyStudents: true });
  const qc = useQueryClient();

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none min-h-[120px] focus:outline-none p-3' }
    }
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => api.get('/admin/announcements').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editItem ? api.put(`/admin/announcements/${editItem.id}`, data) : api.post('/admin/announcements', data),
    onSuccess: () => { toast.success('Announcement saved'); qc.invalidateQueries(['admin', 'announcements']); closeModal(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/announcements/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['admin', 'announcements']); setDeleteTarget(null); },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }) => api.put(`/admin/announcements/${id}`, { isPinned }),
    onSuccess: () => qc.invalidateQueries(['admin', 'announcements']),
  });

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ title: item.title, type: item.type, isPinned: item.is_pinned, expiresAt: item.expires_at?.split('T')[0] || '', notifyStudents: false });
    editor?.commands.setContent(item.content);
    setModal(true);
  };

  const closeModal = () => {
    setModal(false); setEditItem(null);
    setForm({ title: '', type: 'general', isPinned: false, expiresAt: '', notifyStudents: true });
    editor?.commands.setContent('');
  };

  const handleSave = () => {
    if (!form.title) return toast.error('Title is required');
    const content = editor?.getHTML() || '';
    if (!content || content === '<p></p>') return toast.error('Content is required');
    saveMutation.mutate({ ...form, content });
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Announcements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{announcements?.length || 0} total</p>
        </div>
        <Button size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setModal(true)}>New Announcement</Button>
      </div>

      <div className="space-y-3">
        {isLoading ? [1,2].map((i) => <div key={i} className="h-24 rounded-xl skeleton" />)
          : announcements?.map((ann) => (
            <Card key={ann.id} className="p-4">
              <div className="flex items-start gap-3">
                {ann.is_pinned && <Pin className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={TYPE_COLORS[ann.type] || 'default'} size="sm" className="capitalize">{ann.type.replace('_', ' ')}</Badge>
                    <span className="text-xs text-gray-400">{relativeTime(ann.created_at)}</span>
                    {ann.expires_at && <span className="text-xs text-gray-400">Expires {formatDate(ann.expires_at)}</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{ann.title}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="xs" iconOnly onClick={() => pinMutation.mutate({ id: ann.id, isPinned: !ann.is_pinned })}>
                    {ann.is_pinned ? <PinOff className="h-3.5 w-3.5 text-amber-500" /> : <Pin className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => openEdit(ann)}>Edit</Button>
                  <Button variant="ghost" size="xs" iconOnly onClick={() => setDeleteTarget(ann)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                </div>
              </div>
            </Card>
          ))}
      </div>

      <Modal open={modal} onClose={closeModal} title={editItem ? 'Edit Announcement' : 'New Announcement'} size="lg"
        footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button onClick={handleSave} loading={saveMutation.isPending}>Publish</Button></>}>
        <div className="space-y-4">
          <Input label="Title" required placeholder="Announcement title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              options={[{ value: 'general', label: 'General' }, { value: 'holiday', label: 'Holiday' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'fee_reminder', label: 'Fee Reminder' }, { value: 'urgent', label: 'Urgent' }]} />
            <Input label="Expires At (optional)" type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} />
          </div>
          {/* Rich text editor */}
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Content</label>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
                {[
                  { icon: Bold, cmd: () => editor?.chain().focus().toggleBold().run(), active: editor?.isActive('bold') },
                  { icon: Italic, cmd: () => editor?.chain().focus().toggleItalic().run(), active: editor?.isActive('italic') },
                  { icon: List, cmd: () => editor?.chain().focus().toggleBulletList().run(), active: editor?.isActive('bulletList') },
                ].map(({ icon: Icon, cmd, active }, i) => (
                  <button key={i} type="button" onMouseDown={(e) => { e.preventDefault(); cmd(); }}
                    className={`p-1.5 rounded transition-colors ${active ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <EditorContent editor={editor} />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))} className="h-4 w-4 rounded" />
              <span className="text-sm text-gray-700">Pin to top</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.notifyStudents} onChange={(e) => setForm((f) => ({ ...f, notifyStudents: e.target.checked }))} className="h-4 w-4 rounded" />
              <span className="text-sm text-gray-700">Notify all students</span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        title="Delete Announcement" message={`Delete "${deleteTarget?.title}"?`} confirmLabel="Delete" loading={deleteMutation.isPending} />
    </div>
  );
}
