import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import SearchBar from '../../components/ui/SearchBar.jsx';
import { formatDate, relativeTime, truncate } from '../../lib/utils.js';
import { Mail, Phone, CheckCheck, Inbox } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminContactInquiries() {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'contact-inquiries'],
    queryFn: () => api.get('/admin/contact-inquiries').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const readMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/contact-inquiries/${id}/read`),
    onSuccess: () => qc.invalidateQueries(['admin', 'contact-inquiries']),
    onError: () => toast.error('Failed to mark as read'),
  });

  const filtered = (data?.data || []).filter((item) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.message.toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = data?.unreadCount || 0;

  const handleOpen = (item) => {
    setSelected(item);
    if (!item.is_read) readMutation.mutate(item.id);
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display flex items-center gap-2">
            Contact Inquiries
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 text-xs font-bold bg-red-500 text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Messages from your hall's public contact form</p>
        </div>
      </div>

      {/* Search */}
      <SearchBar
        placeholder="Search by name or message…"
        onSearch={setSearch}
        className="max-w-sm"
      />

      {/* List */}
      <Card>
        {isLoading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <div className="skeleton h-10 w-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3 rounded" />
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <Inbox className="h-7 w-7 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">No contact inquiries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleOpen(item)}
                className={`w-full text-left flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${
                  !item.is_read ? 'bg-primary-50/50' : ''
                }`}
              >
                {/* Avatar */}
                <div className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                  item.is_read ? 'bg-gray-100 text-gray-500' : 'bg-primary-100 text-primary-700'
                }`}>
                  {item.name?.[0]?.toUpperCase() || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-sm font-semibold ${item.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                      {item.name}
                    </p>
                    {!item.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{relativeTime(item.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-1 flex items-center gap-3">
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</span>
                    {item.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{item.email}</span>}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-1">{truncate(item.message, 80)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Contact Inquiry"
        size="md"
        footer={
          <div className="flex items-center gap-3 w-full">
            {selected && !selected.is_read && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CheckCheck className="h-4 w-4" />}
                onClick={() => { readMutation.mutate(selected.id); setSelected((s) => s ? { ...s, is_read: true } : null); }}
                loading={readMutation.isPending}
              >
                Mark as Read
              </Button>
            )}
            <div className="flex-1" />
            {selected?.phone && (
              <a href={`tel:${selected.phone}`}>
                <Button variant="secondary" size="sm" leftIcon={<Phone className="h-4 w-4" />}>
                  Call
                </Button>
              </a>
            )}
            {selected?.email && (
              <a href={`mailto:${selected.email}`}>
                <Button size="sm" leftIcon={<Mail className="h-4 w-4" />}>
                  Reply via Email
                </Button>
              </a>
            )}
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Sender info */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-lg font-bold text-primary-700 flex-shrink-0">
                {selected.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">{selected.name}</p>
                <div className="flex flex-col gap-0.5 mt-1">
                  <p className="text-sm text-gray-600 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                    {selected.phone}
                  </p>
                  {selected.email && (
                    <p className="text-sm text-gray-600 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-gray-400" />
                      {selected.email}
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-auto text-xs text-gray-400 flex-shrink-0">{formatDate(selected.created_at)}</div>
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Message</p>
              <div className="p-4 bg-white border border-gray-200 rounded-xl">
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Badge variant={selected.is_read ? 'success' : 'warning'} dot size="sm">
                {selected.is_read ? 'Read' : 'Unread'}
              </Badge>
              {selected.responded_at && (
                <span className="text-xs text-gray-400">Responded {formatDate(selected.responded_at)}</span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
