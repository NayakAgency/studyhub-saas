import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { MembershipStatusBadge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import FileUpload from '../../components/ui/FileUpload.jsx';
import { formatDate, formatCurrency, daysRemaining } from '../../lib/utils.js';
import { RefreshCw, BookOpen } from 'lucide-react';

export default function StudentMembership() {
  const [renewModal, setRenewModal] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');

  const { data: current } = useQuery({
    queryKey: ['student', 'membership'],
    queryFn: () => api.get('/student/membership').then((r) => r.data),
  });

  const { data: history } = useQuery({
    queryKey: ['student', 'membership', 'history'],
    queryFn: () => api.get('/student/membership/history').then((r) => r.data),
  });

  const renewMutation = useMutation({
    mutationFn: (fd) => api.post('/student/membership/renew', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Renewal request submitted! Admin will process it shortly.');
      setRenewModal(false);
      setUtrNumber('');
      setScreenshot(null);
      setPayMethod('cash');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit renewal'),
  });

  const handleRenew = () => {
    if (payMethod === 'upi' && !utrNumber) return toast.error('Enter UTR number');
    const fd = new FormData();
    fd.append('paymentMethod', payMethod);
    if (utrNumber) fd.append('utrNumber', utrNumber);
    if (screenshot) fd.append('paymentScreenshot', screenshot);
    renewMutation.mutate(fd);
  };

  const days = current ? daysRemaining(current.end_date) : null;
  const pct = current ? Math.max(0, Math.min(100, (days / 30) * 100)) : 0;

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 font-display">Membership</h1>

      {current ? (
        <Card>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900">{current.plan?.plan_name}</p>
                <p className="text-sm text-gray-500 capitalize">{current.plan?.plan_type?.replace('_', ' ')} · {current.plan?.validity_type}</p>
              </div>
              <MembershipStatusBadge status={current.status} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Start Date</p><p className="font-medium">{formatDate(current.start_date)}</p></div>
              <div><p className="text-xs text-gray-500">End Date</p><p className="font-medium">{formatDate(current.end_date)}</p></div>
              <div><p className="text-xs text-gray-500">Seat</p><p className="font-medium">{current.seat?.seat_number || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Price</p><p className="font-semibold text-emerald-600">{formatCurrency(current.plan?.price)}</p></div>
            </div>

            {days !== null && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span className={days <= 7 ? 'text-red-500 font-semibold' : ''}>{days > 0 ? `${days} days remaining` : 'Expired'}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: days <= 7 ? '#EF4444' : '#10B981' }} />
                </div>
              </div>
            )}

            {current.status === 'active' && (
              <Button variant="outline" className="w-full" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => setRenewModal(true)}>
                Request Renewal
              </Button>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No active membership</p>
        </Card>
      )}

      {/* History */}
      {history?.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Membership History</h3></CardHeader>
          <div className="divide-y divide-gray-50">
            {history.map((m) => (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.plan?.plan_name}</p>
                  <p className="text-xs text-gray-500">{formatDate(m.start_date)} – {formatDate(m.end_date)}</p>
                </div>
                <MembershipStatusBadge status={m.status} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Renewal modal */}
      <Modal open={renewModal} onClose={() => setRenewModal(false)} title="Request Renewal" size="sm"
        footer={<><Button variant="secondary" onClick={() => setRenewModal(false)}>Cancel</Button><Button onClick={handleRenew} loading={renewMutation.isPending}>Submit Request</Button></>}>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Submit your renewal request with payment details. The admin will process it.</p>
          <div className="grid grid-cols-2 gap-2">
            {['cash', 'upi'].map((m) => (
              <button key={m} type="button" onClick={() => setPayMethod(m)}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${payMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600'}`}>
                {m === 'upi' ? '📲 UPI' : '💵 Cash'}
              </button>
            ))}
          </div>
          {payMethod === 'upi' && (
            <>
              <Input label="UTR Number" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} />
              <FileUpload label="Payment Screenshot" accept="image/*" value={screenshot} onChange={setScreenshot} />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
