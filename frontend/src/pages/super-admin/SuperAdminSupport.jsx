// ============================================================
// Super Admin Support — Contact inquiries from all halls
// Mark as read, expand message, filter by hall/status
// ============================================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate } from '../../lib/utils.js';
import { MessageSquare, Phone, Mail, Building2, CheckCheck, Eye } from 'lucide-react';

const STATUS_TABS = [
  { value: 'all',   label: 'All'  },
  { value: 'unread', label: 'Unread' },
  { value: 'read',   label: 'Read'   },
];

export default function SuperAdminSupport() {
  const [filter, setFilter]   = useState('all');
  const [selected, setSelected] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'support'],
    queryFn: () => api.get('/super-admin/support').then((r) => r.data),
    refetchInterval: 60_000,
  });

  // Mark a single inquiry as read via super-admin endpoint (no tenant context needed)
  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/super-admin/support/${id}/read`),
    onSuccess: () => {
      toast.success('Marked as read');
      qc.invalidateQueries(['super-admin', 'support']);
      setSelected((prev) => prev ? { ...prev, is_read: true } : null);
    },
    onError: () => toast.error('Failed to mark as read'),
  });

  const inquiries = (data || []).filter((i) => {
    if (filter === 'unread') return !i.is_read;
    if (filter === 'read')   return i.is_read;
    return true;
  });

  const unreadCount = (data || []).filter((i) => !i.is_read).length;

  const openDetail = (inquiry) => {
    setSelected(inquiry);
    // Auto-mark as read when opening
    if (!inquiry.is_read) {
      markReadMutation.mutate(inquiry.id);
    }
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Support Inquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">Contact form submissions from all study halls</p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-xl text-sm font-medium">
            <MessageSquare className="h-4 w-4" />
            {unreadCount} new
          </div>
        )}
      </div>

      <Card>
        <div className="px-4 pt-4">
          <Tabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-14 text-center">
            <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No {filter !== 'all' ? filter : ''} inquiries</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                onClick={() => openDetail(inquiry)}
                className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${!inquiry.is_read ? 'bg-blue-50/40' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name + hall */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm font-semibold text-gray-900 ${!inquiry.is_read ? 'font-bold' : ''}`}>
                        {inquiry.name}
                      </p>
                      {!inquiry.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      <span>{inquiry.tenant?.hall_name || 'Unknown Hall'}</span>
                      <span>·</span>
                      <Phone className="h-3.5 w-3.5" />
                      <span>{inquiry.phone}</span>
                      {inquiry.email && (
                        <>
                          <span>·</span>
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[120px]">{inquiry.email}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-1">{inquiry.message}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge variant={inquiry.is_read ? 'default' : 'primary'} size="sm">
                      {inquiry.is_read ? 'Read' : 'New'}
                    </Badge>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(inquiry.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Inquiry Details"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Building2 className="h-3.5 w-3.5" />
              {selected?.tenant?.hall_name}
            </div>
            <div className="flex gap-2">
              {!selected?.is_read && (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<CheckCheck className="h-4 w-4" />}
                  loading={markReadMutation.isPending}
                  onClick={() => markReadMutation.mutate(selected.id)}
                >
                  Mark Read
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Sender info */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700">
                    {selected.name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selected.name}</p>
                  <p className="text-xs text-gray-500">{selected.tenant?.hall_name}</p>
                </div>
                <Badge variant={selected.is_read ? 'default' : 'primary'} size="sm" className="ml-auto">
                  {selected.is_read ? 'Read' : 'New'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {selected.phone}
                </div>
                {selected.email && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Mail className="h-3.5 w-3.5 text-gray-400" />
                    {selected.email}
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Message</p>
              <p className="text-sm text-gray-800 bg-white border border-gray-200 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
                {selected.message}
              </p>
            </div>

            <p className="text-xs text-gray-400">
              Received {formatDate(selected.created_at, 'dd MMM yyyy, HH:mm')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
