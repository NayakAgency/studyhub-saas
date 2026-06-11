import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import Input from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function AdminApplications() {
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [approveForm, setApproveForm] = useState({ adminNotes: '' });
  const [rejectForm, setRejectForm] = useState({ adminNotes: '' });
  const qc = useQueryClient();

  const { data: seats } = useQuery({
    queryKey: ['admin', 'seats', 'available'],
    queryFn: () => api.get('/admin/seats').then((r) => r.data.filter((s) => s.status === 'available')),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', status],
    queryFn: () => api.get('/admin/bookings', { params: { status, limit: 50 } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/bookings/${id}/approve`, body),
    onSuccess: () => { toast.success('Application approved!'); qc.invalidateQueries(['admin', 'bookings']); setApproveModal(false); setSelected(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => api.patch(`/admin/bookings/${id}/reject`, { adminNotes }),
    onSuccess: () => { toast.success('Application rejected'); qc.invalidateQueries(['admin', 'bookings']); setRejectModal(false); setSelected(null); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const seatOptions = (seats || []).map((s) => ({ value: s.id, label: `${s.seat_number} — ${s.section?.name || ''}` }));

  const TABS = [
    { value: 'pending', label: 'Pending', count: data?.pagination?.total },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Applications</h1>
        <p className="text-sm text-gray-500 mt-0.5">Student seat booking requests</p>
      </div>

      <div className="mb-4"><Tabs tabs={TABS} active={status} onChange={setStatus} /></div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-28 rounded-xl skeleton" />)}</div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {status} applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.map((app) => (
            <Card key={app.id} className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Avatar src={app.student?.profile_photo_url} name={app.student?.full_name} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{app.student?.full_name}</p>
                    <Badge variant={app.status === 'pending' ? 'warning' : app.status === 'approved' ? 'success' : 'danger'} size="sm" dot>{app.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500">
                    <span>📞 {app.student?.phone}</span>
                    <span>🪑 Requested: {app.seat?.seat_number || '—'}</span>
                    <span>📋 {app.plan?.plan_name} — {formatCurrency(app.plan?.price)}</span>
                    <span>📅 {formatDate(app.created_at)}</span>
                  </div>
                  {/* UTR display for admin verification */}
                  {app.utr_number && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800">
                        💳 UTR: <span className="font-mono tracking-wide">{app.utr_number}</span>
                      </span>
                      {app.payment_method && (
                        <span className="text-xs text-gray-400 uppercase">{app.payment_method}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {app.payment_screenshot_url && (
                    <Button variant="secondary" size="sm" iconOnly onClick={() => { setSelected(app); setLightboxOpen(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  {app.status === 'pending' && (
                    <>
                      <Button size="sm" variant="success" leftIcon={<CheckCircle className="h-4 w-4" />}
                        onClick={() => { setSelected(app); setApproveForm({ adminNotes: '' }); setApproveModal(true); }}>
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" leftIcon={<XCircle className="h-4 w-4" />}
                        onClick={() => { setSelected(app); setRejectModal(true); }}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Approve Modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Approve Application" size="sm"
        footer={
          <><Button variant="secondary" onClick={() => setApproveModal(false)}>Cancel</Button>
          <Button onClick={() => approveMutation.mutate({ id: selected?.id, ...approveForm })} loading={approveMutation.isPending}>
            Confirm Approval
          </Button></>
        }>
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Approving application for <strong>{selected.student?.full_name}</strong></p>
            <Select label="Assign Seat" placeholder="Use requested seat" value={approveForm.seatId || ''}
              onChange={(e) => setApproveForm((f) => ({ ...f, seatId: e.target.value }))} options={seatOptions} />
            <Textarea label="Notes (optional)" rows={2} value={approveForm.adminNotes}
              onChange={(e) => setApproveForm((f) => ({ ...f, adminNotes: e.target.value }))} />
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Application" size="sm"
        footer={
          <><Button variant="secondary" onClick={() => setRejectModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => rejectMutation.mutate({ id: selected?.id, adminNotes: rejectForm.adminNotes })} loading={rejectMutation.isPending}>
            Reject
          </Button></>
        }>
        <Textarea label="Reason for rejection" rows={3} placeholder="Explain why…" value={rejectForm.adminNotes}
          onChange={(e) => setRejectForm((f) => ({ ...f, adminNotes: e.target.value }))} />
      </Modal>

      {/* Lightbox for payment screenshot */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={selected?.payment_screenshot_url ? [{ src: selected.payment_screenshot_url }] : []}
      />
    </div>
  );
}
