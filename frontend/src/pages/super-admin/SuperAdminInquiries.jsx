// ============================================================
// Super Admin — Hall Owner Requests / Leads
// Submitted via the marketing page "List Your Hall" form
// ============================================================
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate, relativeTime } from '../../lib/utils.js';
import {
  Building2, Phone, Mail, MapPin, Inbox, UserCheck,
  CheckCheck, Trash2, Plus, Armchair, MessageSquare,
} from 'lucide-react';

const STATUS_TABS = [
  { value: 'all',       label: 'All'       },
  { value: 'new',       label: 'New'       },
  { value: 'contacted', label: 'Contacted' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected',  label: 'Rejected'  },
];

const STATUS_CONFIG = {
  new:       { variant: 'primary',  label: 'New'       },
  contacted: { variant: 'warning',  label: 'Contacted' },
  converted: { variant: 'success',  label: 'Converted' },
  rejected:  { variant: 'danger',   label: 'Rejected'  },
};

const PLAN_LABELS = {
  standard:   'Standard',
  premium:    'Premium',
  enterprise: 'Enterprise',
};

export default function SuperAdminInquiries() {
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'inquiries', filter],
    queryFn: () => api.get('/super-admin/inquiries', { params: { status: filter, limit: 50 } }).then(r => r.data),
    refetchInterval: 30_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/super-admin/inquiries/${id}`, body),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['super-admin', 'inquiries'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
      setSelected(prev => prev ? { ...prev, ...updateMutation.variables } : null);
    },
    onError: () => toast.error('Update failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/super-admin/inquiries/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['super-admin', 'inquiries'] });
      setSelected(null);
    },
  });

  const openDetail = (inquiry) => {
    setSelected(inquiry);
    setNotes(inquiry.notes || '');
    if (!inquiry.is_read) {
      updateMutation.mutate({ id: inquiry.id, is_read: true });
    }
  };

  const handleConvert = () => {
    if (!selected) return;
    // Mark as converted and navigate to "Add Hall" with prefilled data
    updateMutation.mutate({ id: selected.id, status: 'converted' });
    navigate('/super-admin/tenants/new', {
      state: {
        prefill: {
          ownerName:  selected.owner_name,
          ownerEmail: selected.owner_email,
          ownerPhone: selected.owner_phone,
          hallName:   selected.hall_name,
          city:       selected.city,
          planType:   selected.plan_interest || 'standard',
        },
      },
    });
  };

  const inquiries = data?.data || [];
  const unread = data?.unreadCount || 0;

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Hall Owner Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Requests from prospective study hall owners submitted on the marketing page
          </p>
        </div>
        {unread > 0 && (
          <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-xl text-sm font-semibold">
            <Inbox className="h-4 w-4" />
            {unread} new
          </div>
        )}
      </div>

      <Card>
        <div className="px-4 pt-4">
          <Tabs tabs={STATUS_TABS} active={filter} onChange={setFilter} />
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-14 text-center">
            <Inbox className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {filter === 'new' ? 'No new requests' : `No ${filter} requests`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {inquiries.map((req, i) => {
              const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.new;
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => openDetail(req)}
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${!req.is_read ? 'bg-blue-50/40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-semibold text-gray-900 ${!req.is_read ? 'font-bold' : ''}`}>
                          {req.hall_name}
                        </p>
                        {!req.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{req.owner_name}</span>
                        {req.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{req.city}</span>}
                        {req.seat_count && <span className="flex items-center gap-1"><Armchair className="h-3 w-3" />{req.seat_count} seats</span>}
                        {req.plan_interest && <span className="font-medium text-primary-600">{PLAN_LABELS[req.plan_interest]}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <Badge variant={sc.variant} size="sm">{sc.label}</Badge>
                      <span className="text-xs text-gray-400 whitespace-nowrap">{relativeTime(req.created_at)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Request Details"
        size="md"
        footer={
          <div className="flex items-center justify-between w-full gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => deleteMutation.mutate(selected?.id)}
              loading={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <div className="flex gap-2">
              {selected?.status === 'new' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateMutation.mutate({ id: selected.id, status: 'contacted' })}
                  loading={updateMutation.isPending}
                >
                  Mark Contacted
                </Button>
              )}
              {['new','contacted'].includes(selected?.status) && (
                <Button
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                  onClick={handleConvert}
                >
                  Onboard Hall
                </Button>
              )}
              {selected?.status !== 'rejected' && selected?.status !== 'converted' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-500"
                  onClick={() => updateMutation.mutate({ id: selected.id, status: 'rejected' })}
                >
                  Reject
                </Button>
              )}
            </div>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between">
              <Badge variant={STATUS_CONFIG[selected.status]?.variant || 'default'} size="md">
                {STATUS_CONFIG[selected.status]?.label || selected.status}
              </Badge>
              <span className="text-xs text-gray-400">{formatDate(selected.created_at)}</span>
            </div>

            {/* Contact info */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700">{selected.owner_name?.[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selected.owner_name}</p>
                  <p className="text-xs text-gray-500">{selected.hall_name}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 pt-1">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  <a href={`tel:${selected.owner_phone}`} className="hover:text-primary-600">{selected.owner_phone}</a>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  <a href={`mailto:${selected.owner_email}`} className="hover:text-primary-600">{selected.owner_email}</a>
                </div>
                {selected.city && (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" />
                    {selected.city}
                  </div>
                )}
              </div>
            </div>

            {/* Hall details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selected.seat_count && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Seats</p>
                  <p className="font-bold text-gray-900">{selected.seat_count}</p>
                </div>
              )}
              {selected.plan_interest && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Interested Plan</p>
                  <p className="font-bold text-gray-900 capitalize">{PLAN_LABELS[selected.plan_interest]}</p>
                </div>
              )}
            </div>

            {/* Message */}
            {selected.message && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Message
                </p>
                <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-xl p-3 leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </p>
              </div>
            )}

            {/* Internal notes */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Internal Notes</p>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-300"
                placeholder="Add notes about this lead…"
              />
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                onClick={() => updateMutation.mutate({ id: selected.id, notes })}
                loading={updateMutation.isPending}
              >
                Save Notes
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
