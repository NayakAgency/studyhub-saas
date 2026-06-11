import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import FileUpload from '../../components/ui/FileUpload.jsx';
import { formatCurrency, cn } from '../../lib/utils.js';
import { CheckCircle } from 'lucide-react';

export default function StudentBookSeat() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod] = useState('cash');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [done, setDone] = useState(false);

  const { data: seatsData } = useQuery({
    queryKey: ['student', 'seats', 'available'],
    queryFn: () => api.get(`/public/${slug}/seats`).then((r) => r.data),
  });

  const { data: plans } = useQuery({
    queryKey: ['student', 'plans'],
    queryFn: () => api.get(`/public/${slug}/plans`).then((r) => r.data),
  });

  const bookMutation = useMutation({
    mutationFn: (fd) => api.post('/student/book-seat', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => setDone(true),
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to submit booking'),
  });

  const handleSubmit = () => {
    if (!selectedPlan) return toast.error('Select a plan');
    if (!selectedSeat) return toast.error('Select a seat');
    if (payMethod === 'upi' && !utrNumber) return toast.error('Enter UTR number');
    const fd = new FormData();
    fd.append('seatId', selectedSeat.id);
    fd.append('planId', selectedPlan.id);
    fd.append('paymentMethod', payMethod);
    if (utrNumber) fd.append('utrNumber', utrNumber);
    if (screenshot) fd.append('paymentScreenshot', screenshot);
    bookMutation.mutate(fd);
  };

  if (done) {
    return (
      <div className="p-5 flex flex-col items-center text-center space-y-4 max-w-sm mx-auto pt-16">
        <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 font-display">Request Submitted!</h2>
        <p className="text-sm text-gray-600">Your seat booking request has been submitted. The admin will process it shortly.</p>
        <Button onClick={() => navigate(`/${slug}/dashboard`)}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 font-display">Book a Seat</h1>

      {/* Plan selection */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">1. Select Plan</p>
        <div className="space-y-2">
          {(plans || []).map((plan) => (
            <label key={plan.id} className={cn('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
              selectedPlan?.id === plan.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}>
              <input type="radio" name="plan" className="sr-only" onChange={() => setSelectedPlan(plan)} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{plan.plan_name}</p>
                <p className="text-xs text-gray-500 capitalize">{plan.plan_type?.replace('_', ' ')} · {plan.validity_type}</p>
              </div>
              <p className="text-base font-bold text-primary-600">{formatCurrency(plan.price)}</p>
            </label>
          ))}
        </div>
      </Card>

      {/* Seat selection */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">2. Choose Seat</p>
        {(seatsData?.sections || []).map((section) => (
          <div key={section.id}>
            <p className="text-xs font-medium text-gray-500 mb-1.5">{section.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {(section.seats || []).filter((s) => s.status === 'available').map((seat) => (
                <button key={seat.id} type="button"
                  onClick={() => setSelectedSeat(selectedSeat?.id === seat.id ? null : seat)}
                  className={cn('h-9 min-w-[44px] px-1.5 rounded-lg border-2 text-xs font-semibold transition-all',
                    selectedSeat?.id === seat.id ? 'border-primary-600 bg-primary-500 text-white scale-105' : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:scale-105')}>
                  {seat.seat_number}
                </button>
              ))}
              {(section.seats || []).filter((s) => s.status === 'reserved').map((seat) => (
                <div key={seat.id} title="Pending application"
                  className="h-9 min-w-[44px] px-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-xs font-semibold text-amber-600 flex items-center justify-center cursor-not-allowed">
                  {seat.seat_number}
                </div>
              ))}
              {(section.seats || []).filter((s) => !['available','reserved'].includes(s.status)).map((seat) => (
                <div key={seat.id} className="h-9 min-w-[44px] px-1.5 rounded-lg border-2 border-gray-200 bg-gray-100 text-xs font-semibold text-gray-400 flex items-center justify-center cursor-not-allowed">
                  {seat.seat_number}
                </div>
              ))}
            </div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex gap-3 text-xs pt-1">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-50 border border-emerald-300" />Available</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-50 border border-amber-300" />Pending</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-100 border border-gray-200" />Occupied</span>
        </div>
        {selectedSeat && <p className="text-xs text-primary-600">Selected: <strong>{selectedSeat.seat_number}</strong></p>}
      </Card>

      {/* Payment */}
      <Card className="p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-800">3. Payment</p>
        <div className="grid grid-cols-2 gap-2">
          {['cash', 'upi'].map((m) => (
            <button key={m} type="button" onClick={() => setPayMethod(m)}
              className={cn('py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                payMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
              {m === 'upi' ? '📲 UPI' : '💵 Cash'}
            </button>
          ))}
        </div>
        {payMethod === 'upi' && (
          <>
            <Input label="UTR Number" value={utrNumber} onChange={(e) => setUtrNumber(e.target.value)} placeholder="UTR reference number" />
            <FileUpload label="Payment Screenshot" accept="image/*" value={screenshot} onChange={setScreenshot} />
          </>
        )}
      </Card>

      <Button className="w-full" size="lg" onClick={handleSubmit} loading={bookMutation.isPending}>
        Submit Booking Request
      </Button>
    </div>
  );
}
