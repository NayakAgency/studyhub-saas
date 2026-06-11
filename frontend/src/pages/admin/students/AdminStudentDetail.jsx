import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import { StudentStatusBadge, MembershipStatusBadge, Badge } from '../../../components/ui/Badge.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Select from '../../../components/ui/Select.jsx';
import Input from '../../../components/ui/Input.jsx';
import { Tabs } from '../../../components/ui/Tabs.jsx';
import { formatDate, formatCurrency, daysRemaining } from '../../../lib/utils.js';
import { ArrowLeft, CreditCard, RefreshCw, Armchair, Phone, Mail, MapPin, AlertTriangle, Clock } from 'lucide-react';

export default function AdminStudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  const [statusModal, setStatusModal]   = useState(false);
  const [renewModal, setRenewModal]     = useState(false);
  const [renewPlanId, setRenewPlanId]   = useState('');
  const [renewStartDate, setRenewStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const { data: student, isLoading } = useQuery({
    queryKey: ['admin', 'student', id],
    queryFn: () => api.get(`/admin/students/${id}`).then((r) => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['admin', 'student', id, 'history'],
    queryFn: () => api.get(`/admin/students/${id}/history`).then((r) => r.data),
    enabled: tab === 'history',
  });

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/admin/students/${id}/status`, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries(['admin', 'student', id]); setStatusModal(false); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed'),
  });

  // Fetch plans for renewal modal
  const { data: plans } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.get('/admin/plans').then((r) => r.data),
    enabled: renewModal,
  });

  const renewMutation = useMutation({
    mutationFn: (body) => api.patch(`/admin/renewals/${body.renewalRequestId}/approve`, body),
    onSuccess: () => {
      toast.success('Membership renewed successfully');
      qc.invalidateQueries(['admin', 'student', id]);
      setRenewModal(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Renewal failed'),
  });

  // Direct renewal: create a renewal_request then immediately approve it
  const directRenewMutation = useMutation({
    mutationFn: async ({ planId, startDate }) => {
      // Step 1: create renewal request
      const { data: req } = await api.post('/admin/renewals/direct', {
        studentId: id,
        planId: planId || activeMembership?.plan_id,
        startDate,
      });
      return req;
    },
    onSuccess: () => {
      toast.success('Membership renewed');
      qc.invalidateQueries(['admin', 'student', id]);
      setRenewModal(false);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Renewal failed'),
  });

  if (isLoading) return <div className="p-6 text-gray-500">Loading…</div>;
  if (!student) return <div className="p-6 text-gray-500">Student not found</div>;

  const activeMembership = student.memberships?.find((m) => m.status === 'active');
  const days = activeMembership ? daysRemaining(activeMembership.end_date) : null;

  const TABS = [
    { value: 'overview', label: 'Overview' },
    { value: 'payments', label: 'Payments', count: student.payments?.length },
    { value: 'complaints', label: 'Complaints', count: student.complaints?.length },
    { value: 'history', label: 'Activity' },
  ];

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </button>

      {/* Profile header */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row gap-5">
          <Avatar src={student.profile_photo_url} name={student.full_name} size="2xl" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900 font-display">{student.full_name}</h1>
                <p className="text-sm text-gray-500 font-mono">{student.student_code}</p>
              </div>
              <StudentStatusBadge status={student.status} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600"><Phone className="h-4 w-4 text-gray-400" />{student.phone}</div>
              {student.email && <div className="flex items-center gap-2 text-gray-600"><Mail className="h-4 w-4 text-gray-400" />{student.email}</div>}
              {student.address && <div className="flex items-center gap-2 text-gray-600 col-span-full"><MapPin className="h-4 w-4 text-gray-400" />{student.address}</div>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
            <Link to="/admin/payments/record" state={{ studentId: id }}>
              <Button size="sm" leftIcon={<CreditCard className="h-4 w-4" />}>Record Payment</Button>
            </Link>
            <Button variant="secondary" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={() => { setRenewPlanId(activeMembership?.plan?.id || ''); setRenewModal(true); }}>
              Renew
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatusModal(true)}>Change Status</Button>
          </div>
        </CardBody>
      </Card>

      {/* Info cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Seat */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2"><Armchair className="h-4 w-4" />ASSIGNED SEAT</div>
          {student.assigned_seat ? (
            <>
              <p className="text-2xl font-bold text-gray-900">{student.assigned_seat.seat_number}</p>
              <p className="text-sm text-gray-500">{student.assigned_seat.section?.name}</p>
            </>
          ) : <p className="text-gray-400 text-sm">No seat assigned</p>}
        </Card>
        {/* Membership */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2"><Clock className="h-4 w-4" />MEMBERSHIP</div>
          {activeMembership ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{activeMembership.plan?.plan_name}</p>
              <p className="text-xs text-gray-500">Expires {formatDate(activeMembership.end_date)}</p>
              {days !== null && (
                <Badge variant={days < 0 ? 'danger' : days <= 3 ? 'warning' : 'success'} size="sm" className="mt-2">
                  {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                </Badge>
              )}
            </>
          ) : <p className="text-gray-400 text-sm">No active membership</p>}
        </Card>
        {/* Emergency Contact */}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium mb-2"><AlertTriangle className="h-4 w-4" />EMERGENCY CONTACT</div>
          {student.emergency_contact_name ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{student.emergency_contact_name}</p>
              <p className="text-xs text-gray-500">{student.emergency_contact_phone}</p>
              <p className="text-xs text-gray-400">{student.emergency_contact_relation}</p>
            </>
          ) : <p className="text-gray-400 text-sm">Not provided</p>}
        </Card>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 pt-4"><Tabs tabs={TABS} active={tab} onChange={setTab} /></div>
        <div className="p-5">
          {tab === 'overview' && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Date of Birth', formatDate(student.date_of_birth)],
                ['Gender', student.gender || '—'],
                ['Registered', formatDate(student.registered_at)],
                ['Activated', formatDate(student.activated_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 font-medium">{label}</p>
                  <p className="text-gray-800 mt-0.5 capitalize">{value}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-2">
              {student.payments?.length === 0 ? <p className="text-gray-500 text-sm">No payments recorded</p>
                : student.payments?.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.receipt_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(p.payment_date)} · {p.payment_method?.toUpperCase()}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(p.amount)}</p>
                  </div>
                ))}
            </div>
          )}

          {tab === 'complaints' && (
            <div className="space-y-2">
              {student.complaints?.length === 0 ? <p className="text-gray-500 text-sm">No complaints</p>
                : student.complaints?.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.subject}</p>
                      <p className="text-xs text-gray-500">{c.complaint_number} · {formatDate(c.created_at)}</p>
                    </div>
                    <Badge variant={c.status === 'open' ? 'danger' : c.status === 'resolved' ? 'success' : 'warning'} size="sm">
                      {c.status}
                    </Badge>
                  </div>
                ))}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {history?.length === 0 ? <p className="text-gray-500 text-sm">No activity recorded</p>
                : history?.map((log) => (
                  <div key={log.id} className="flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary-100 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 font-medium">{log.action.replace(/\./g, ' ')}</p>
                      <p className="text-xs text-gray-400">{formatDate(log.created_at, 'dd MMM yyyy, HH:mm')} · {log.user_role}</p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Renew membership modal */}
      <Modal
        open={renewModal}
        onClose={() => setRenewModal(false)}
        title="Renew Membership"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenewModal(false)}>Cancel</Button>
            <Button
              leftIcon={<RefreshCw className="h-4 w-4" />}
              loading={directRenewMutation.isPending}
              onClick={() => directRenewMutation.mutate({ planId: renewPlanId, startDate: renewStartDate })}
            >
              Renew Now
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {activeMembership && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              Current plan: <strong>{activeMembership.plan?.plan_name}</strong> · expires {formatDate(activeMembership.end_date)}
            </div>
          )}
          <Select
            label="Renewal Plan"
            value={renewPlanId}
            onChange={(e) => setRenewPlanId(e.target.value)}
            placeholder="Same as current plan"
            options={(plans || []).map((p) => ({ value: p.id, label: `${p.plan_name} — ${formatCurrency(p.price)}` }))}
          />
          <Input
            label="New Start Date"
            type="date"
            value={renewStartDate}
            onChange={(e) => setRenewStartDate(e.target.value)}
          />
        </div>
      </Modal>

      {/* Status modal */}
      <Modal open={statusModal} onClose={() => setStatusModal(false)} title="Change Student Status" size="sm"
        footer={<Button variant="secondary" onClick={() => setStatusModal(false)}>Cancel</Button>}>
        <div className="grid grid-cols-2 gap-2">
          {['active', 'inactive', 'suspended', 'pending'].map((s) => (
            <Button key={s} variant={student.status === s ? 'primary' : 'secondary'} size="sm"
              loading={statusMutation.isPending}
              onClick={() => statusMutation.mutate(s)}
              className="capitalize">{s}</Button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
