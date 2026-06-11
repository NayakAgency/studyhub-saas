import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, Clock, Armchair, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { formatDate } from '../../lib/utils.js';
import { Tabs } from '../../components/ui/Tabs.jsx';

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' };

function ReviewModal({ request, action, onClose }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/admin/seat-changes/${request.id}/${action}`, { adminNotes: notes || undefined })
         .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['admin', 'seat-changes']);
      toast.success(action === 'approve' ? 'Seat change approved!' : 'Request rejected');
      onClose();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const isApprove = action === 'approve';

  return (
    <div className="space-y-4">
      {/* Request summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Avatar
            src={request.student?.profile_photo_url}
            name={request.student?.full_name}
            size="sm"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">{request.student?.full_name}</p>
            <p className="text-xs text-gray-500 font-mono">{request.student?.student_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">Current Seat</p>
            <p className="font-bold text-gray-900">{request.current_seat?.seat_number || '—'}</p>
            <p className="text-xs text-gray-400">{request.current_seat?.section?.name}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          <div className="flex-1 text-center">
            <p className="text-xs text-gray-500 mb-1">Requested Seat</p>
            <p className="font-bold text-primary-600">{request.requested_seat?.seat_number || '—'}</p>
            <p className="text-xs text-gray-400">{request.requested_seat?.section?.name}</p>
          </div>
        </div>
        {request.reason && (
          <div>
            <p className="text-xs text-gray-500">Reason</p>
            <p className="text-sm text-gray-700 mt-0.5">{request.reason}</p>
          </div>
        )}
        {request.requested_seat?.status && request.requested_seat.status !== 'available' && isApprove && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            ⚠ The requested seat is currently <strong>{request.requested_seat.status}</strong>. It may not be assignable.
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">
          {isApprove ? 'Note to student (optional)' : 'Reason for rejection (optional)'}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={isApprove ? 'e.g. Seat change effective from tomorrow.' : 'e.g. Requested seat is reserved for premium members.'}
          className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2 focus:ring-2 focus:ring-primary-300 focus:border-primary-400 outline-none resize-none"
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant={isApprove ? 'primary' : 'danger'}
          loading={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="flex-1"
          leftIcon={isApprove ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        >
          {isApprove ? 'Approve Change' : 'Reject Request'}
        </Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

export default function AdminSeatChanges() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState(null);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'seat-changes', activeTab, page],
    queryFn: () =>
      api.get('/admin/seat-changes', { params: { status: activeTab, page, limit: 20 } })
         .then((r) => r.data),
    keepPreviousData: true,
  });

  const requests = data?.data || [];
  const pagination = data?.pagination;

  const openReview = (req, act) => { setSelected(req); setAction(act); };
  const closeModal = () => { setSelected(null); setAction(null); };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Seat Change Requests</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review and manage student seat change requests</p>
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          { value: 'pending',  label: 'Pending' },
          { value: 'approved', label: 'Approved' },
          { value: 'rejected', label: 'Rejected' },
          { value: 'all',      label: 'All' },
        ]}
        active={activeTab}
        onChange={(v) => { setActiveTab(v); setPage(1); }}
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl skeleton" />)}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-10 w-10 text-gray-300" />}
          title="No requests found"
          description={activeTab === 'pending' ? 'No pending seat change requests right now.' : `No ${activeTab} requests.`}
        />
      ) : (
        <div className="space-y-3">
          {requests.map((req, i) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="p-4">
                <div className="flex items-start gap-4">
                  {/* Student info */}
                  <Avatar
                    src={req.student?.profile_photo_url}
                    name={req.student?.full_name}
                    size="md"
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{req.student?.full_name}</p>
                      <span className="text-xs text-gray-400 font-mono">{req.student?.student_code}</span>
                      <Badge variant={STATUS_VARIANT[req.status]} size="sm" className="capitalize">{req.status}</Badge>
                    </div>

                    {/* Seat flow */}
                    <div className="flex items-center gap-2 mt-1.5 text-sm">
                      <span className="inline-flex items-center gap-1 bg-gray-100 rounded-md px-2 py-0.5 text-xs font-medium text-gray-700">
                        <Armchair className="h-3 w-3" />
                        {req.current_seat?.seat_number || 'No seat'}
                        {req.current_seat?.section?.name && (
                          <span className="text-gray-400">· {req.current_seat.section.name}</span>
                        )}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                      <span className="inline-flex items-center gap-1 bg-primary-50 rounded-md px-2 py-0.5 text-xs font-medium text-primary-700">
                        <Armchair className="h-3 w-3" />
                        {req.requested_seat?.seat_number || '—'}
                        {req.requested_seat?.section?.name && (
                          <span className="text-primary-400">· {req.requested_seat.section.name}</span>
                        )}
                      </span>
                    </div>

                    {req.reason && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">Reason: {req.reason}</p>
                    )}

                    {req.admin_notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">Admin note: {req.admin_notes}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>Submitted {formatDate(req.created_at)}</span>
                      {req.reviewed_at && <span>· Reviewed {formatDate(req.reviewed_at)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="success"
                        leftIcon={<CheckCircle className="h-3.5 w-3.5" />}
                        onClick={() => openReview(req, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-outline"
                        leftIcon={<XCircle className="h-3.5 w-3.5" />}
                        onClick={() => openReview(req, 'reject')}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page} of {pagination.pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Review Modal */}
      <Modal
        open={!!(selected && action)}
        onClose={closeModal}
        title={action === 'approve' ? 'Approve Seat Change' : 'Reject Request'}
        size="md"
      >
        {selected && action && (
          <ReviewModal request={selected} action={action} onClose={closeModal} />
        )}
      </Modal>
    </div>
  );
}
