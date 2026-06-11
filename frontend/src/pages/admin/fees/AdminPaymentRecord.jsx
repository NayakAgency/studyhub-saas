import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card.jsx';
import Input from '../../../components/ui/Input.jsx';
import Select from '../../../components/ui/Select.jsx';
import Button from '../../../components/ui/Button.jsx';
import FileUpload from '../../../components/ui/FileUpload.jsx';
import SearchBar from '../../../components/ui/SearchBar.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import { formatCurrency } from '../../../lib/utils.js';
import { ArrowLeft, CreditCard, Search } from 'lucide-react';

export default function AdminPaymentRecord() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [form, setForm] = useState({
    amount: '', paymentMethod: 'cash', utrNumber: '', paymentDate: new Date().toISOString().split('T')[0],
    notes: '', sendReceipt: false,
  });
  const [screenshot, setScreenshot] = useState(null);

  const { data: students } = useQuery({
    queryKey: ['admin', 'students', 'search', studentSearch],
    queryFn: () => api.get('/admin/students', { params: { search: studentSearch, status: 'active', limit: 10 } }).then((r) => r.data.data),
    enabled: studentSearch.length > 1,
  });

  const mutation = useMutation({
    mutationFn: (formData) => api.post('/admin/payments/record', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => {
      toast.success('Payment recorded successfully!');
      qc.invalidateQueries(['admin', 'payments']);
      navigate('/admin/fees');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to record payment'),
  });

  const handleSubmit = () => {
    if (!selectedStudent) return toast.error('Select a student');
    if (!form.amount) return toast.error('Enter payment amount');
    if (form.paymentMethod === 'upi' && !form.utrNumber) return toast.error('Enter UTR number for UPI payments');

    const fd = new FormData();
    fd.append('studentId', selectedStudent.id);
    fd.append('amount', form.amount);
    fd.append('paymentMethod', form.paymentMethod);
    fd.append('paymentDate', form.paymentDate);
    fd.append('notes', form.notes);
    fd.append('sendReceipt', form.sendReceipt.toString());
    if (form.utrNumber) fd.append('utrNumber', form.utrNumber);
    if (screenshot) fd.append('paymentScreenshot', screenshot);

    mutation.mutate(fd);
  };

  const activeMembership = selectedStudent?.memberships?.find((m) => m.status === 'active');

  return (
    <div className="p-6 space-y-5 max-w-2xl pb-20 md:pb-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Record Payment</h1>
        <p className="text-sm text-gray-500 mt-0.5">Record a new fee payment for a student</p>
      </div>

      {/* Student selection */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Search className="h-4 w-4" />Select Student</h3></CardHeader>
        <CardBody className="space-y-3">
          {!selectedStudent ? (
            <>
              <SearchBar placeholder="Search student by name or phone…" onSearch={setStudentSearch} />
              {students && studentSearch.length > 1 && (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {students.length === 0 ? <p className="p-3 text-sm text-gray-500">No active students found</p>
                    : students.map((s) => (
                      <button key={s.id} onClick={() => setSelectedStudent(s)} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left">
                        <Avatar src={s.profile_photo_url} name={s.full_name} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.full_name}</p>
                          <p className="text-xs text-gray-500">{s.student_code} · {s.phone}</p>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-primary-50 rounded-lg border border-primary-100">
              <Avatar src={selectedStudent.profile_photo_url} name={selectedStudent.full_name} size="md" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{selectedStudent.full_name}</p>
                <p className="text-xs text-gray-500">{selectedStudent.student_code}</p>
                {activeMembership && (
                  <p className="text-xs text-primary-600 mt-0.5">{activeMembership.plan?.plan_name} — Due: {formatCurrency(activeMembership.plan?.price)}</p>
                )}
              </div>
              <Button variant="ghost" size="xs" onClick={() => setSelectedStudent(null)}>Change</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Payment details */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><CreditCard className="h-4 w-4" />Payment Details</h3></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount (₹)" required type="number" placeholder="1500"
              value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            <Input label="Payment Date" type="date" required
              value={form.paymentDate} onChange={(e) => setForm((f) => ({ ...f, paymentDate: e.target.value }))} />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Payment Method</label>
            <div className="flex gap-3 mt-2">
              {['cash', 'upi'].map((m) => (
                <button key={m} type="button"
                  onClick={() => setForm((f) => ({ ...f, paymentMethod: m }))}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all capitalize ${
                    form.paymentMethod === m ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {m === 'upi' ? '📲 UPI' : '💵 Cash'}
                </button>
              ))}
            </div>
          </div>

          {form.paymentMethod === 'upi' && (
            <>
              <Input label="UTR Number" required placeholder="UTR123456789012"
                value={form.utrNumber} onChange={(e) => setForm((f) => ({ ...f, utrNumber: e.target.value }))} />
              <FileUpload label="Payment Screenshot" accept="image/*,application/pdf"
                hint="Upload UPI payment screenshot" value={screenshot}
                onChange={setScreenshot} />
            </>
          )}

          <Input label="Notes (optional)" placeholder="Any notes…"
            value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.sendReceipt}
              onChange={(e) => setForm((f) => ({ ...f, sendReceipt: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600" />
            <span className="text-sm text-gray-700">Send receipt email to student</span>
          </label>
        </CardBody>
      </Card>

      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        <Button onClick={handleSubmit} loading={mutation.isPending} leftIcon={<CreditCard className="h-4 w-4" />}>
          Record Payment
        </Button>
      </div>
    </div>
  );
}
