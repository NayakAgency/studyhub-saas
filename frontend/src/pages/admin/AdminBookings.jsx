// AdminBookings — seat booking requests view (separate from student applications)
// Applications = pending new student registrations
// Bookings = seat booking requests from existing students (book-seat flow)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { Table, Pagination } from '../../components/ui/Table.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatDate, formatCurrency } from '../../lib/utils.js';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export default function AdminBookings() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [approveModal, setApproveModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxTarget, setLightboxTarget] = useState(null);
  const [approveForm, setApproveForm] = useState({ adminNotes: '' });
  const [rejectNotes, setRejectNotes] = useState('');
  const qc = useQueryClient();

  const { data: seats } = useQuery({
    queryKey: ['admin', 'seats', 'available'],
    queryFn: () => api.get('/admin/seats').then((r) => r.data.filter((s) => s.status === 'available')),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'bookings', status, page],
    queryFn: () => api.get('/admin/bookings', { params: { status, page, limit: 20 } }).then((r) => r.data),
    keepPreviousData: true,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/admin/bookings/${id}/approve`, body),
    onSuccess: () => {
      toast.success('Booking approved!');
      qc.invalidateQueries(['admin', 'bookings']);
      setApproveModal(false);
      setSelected(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, adminNotes }) => api.patch(`/admin/bookings/${id}/reject`, { adminNotes }),
    onSuccess: () => {
      toast.success('Booking rejected');
      qc.invalidateQueries(['admin', 'bookings']);
      setRejectModal(false);
      setSelected(null);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  const seatOptions = (seats || []).map((s) => ({
    value: s.id,
    label: `${s.seat_number} — ${s.section?.name || ''}`,
  }));

  const STATUS_TABS = [
    { value: 'pending', label: 'Pending', count: status === 'pending' ? data?.pagination?.total : undefined },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  const columns = [
    {
      key: 'student', label: 'Student',
      render: (v) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{v?.full_name}</p>
          <p className="text-xs text-gray-500 font-mono">{v?.student_code}</p>
        </div>
      ),
    },
    {
      key: 'seat', label: 'Requested Seat',
      render: (v) => (
        <div>
          <p className="text-sm font-semibold">{v?.seat_number || '—'}</p>
          <p className="text-xs text-gray-400">{v?.section?.name}</p>
        </div>
      ),
    },
    {
      key: 'plan', label: 'Plan',
      render: (v) => (
        <div>
          <p className="text-sm">{v?.plan_name}</p>
          <p className="text-xs text-gray-400">{formatCurrency(v?.price)}</p>
        </div>
      ),
    },
    {
      key: 'status', label: 'Status',
      render: (v) => (
        <Badge
          variant={v === 'pending' ? 'warning' : v === 'approved' ? 'success' : v === 'rejected' ? 'danger' : 'default'}
          dot size="sm" className="capitalize"
        >
          {v}
        </Badge>
      ),
    },
    {
      key: 'created_at', label: 'Date',
      render: (v) => <span className="text-xs text-gray-500">{formatDate(v)}</span>,
    },
    {
      key: 'id', label: '', align: 'right',
      render: (id, row) => (
        <div className="flex items-center gap-1 justify-end">
          {row.payment_screenshot_url && (
            <Button variant="ghost" size="xs" iconOnly
              onClick={() => { setLightboxTarget(row.payment_screenshot_url); setLightboxOpen(true); }}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {row.status === 'pending' && (
            <>
              <Button variant="ghost" size="xs"
                onClick={() => { setSelected(row); setApproveForm({ adminNotes: '' }); setApproveModal(true); }}
                className="text-emerald-600 hover:bg-emerald-50">
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="xs"
                onClick={() => { setSelected(row); setRejectNotes(''); setRejectModal(true); }}
                className="text-red-500 hover:bg-red-50">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Seat Booking Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Booking requests from registered students</p>
      </div>

      <Card>
        <div className="px-4 pt-4">
          <Tabs tabs={STATUS_TABS} active={status} onChange={(v) => { setStatus(v); setPage(1); }} />
        </div>
        <Table columns={columns} data={data?.data} loading={isLoading} />
        <Pagination
          page={page} pages={data?.pagination?.pages || 1}
          total={data?.pagination?.total || 0} limit={20}
          onPageChange={setPage}
        />
      </Card>

      {/* Approve Modal */}
      <Modal
        open={approveModal} onClose={() => setApproveModal(false)}
        title="Approve Booking Request" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApproveModal(false)}>Cancel</Button>
            <Button
              onClick={() => approveMutation.mutate({ id: selected?.id, ...approveForm })}
              loading={approveMutation.isPending}
            >
              Confirm Approval
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl text-sm">
              <p className="font-semibold text-gray-900">{selected.student?.full_name}</p>
              <p className="text-gray-500">Requested: {selected.seat?.seat_number} · {selected.plan?.plan_name}</p>
            </div>
            <Select
              label="Override Seat (optional)"
              placeholder="Use requested seat"
              options={seatOptions}
              value={approveForm.seatId || ''}
              onChange={(e) => setApproveForm((f) => ({ ...f, seatId: e.target.value || undefined }))}
            />
            <Textarea
              label="Admin Notes (optional)" rows={2}
              value={approveForm.adminNotes}
              onChange={(e) => setApproveForm((f) => ({ ...f, adminNotes: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        open={rejectModal} onClose={() => setRejectModal(false)}
        title="Reject Booking Request" size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRejectModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => rejectMutation.mutate({ id: selected?.id, adminNotes: rejectNotes })}
              loading={rejectMutation.isPending}
            >
              Reject Request
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason for rejection"
          rows={3}
          placeholder="Explain why this request is being rejected…"
          value={rejectNotes}
          onChange={(e) => setRejectNotes(e.target.value)}
        />
      </Modal>

      {/* Screenshot Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxTarget ? [{ src: lightboxTarget }] : []}
      />
    </div>
  );
}
