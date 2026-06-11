import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatCurrency, cn } from '../../lib/utils.js';
import { GraduationCap, CheckCircle, Wind, Thermometer, Box, AlertCircle } from 'lucide-react';

const STEPS = ['Personal Info', 'More Details', 'Choose Type', 'Choose Seat & Plan', 'Payment', 'Review'];

const CATEGORY_OPTIONS = [
  { value: 'ac', label: 'AC Hall', desc: 'Air-conditioned seating area', icon: Wind, color: 'border-blue-500 bg-blue-50 text-blue-700' },
  { value: 'non_ac', label: 'Non-AC Hall', desc: 'Regular seating area', icon: Thermometer, color: 'border-orange-400 bg-orange-50 text-orange-700' },
  { value: 'other', label: 'Other', desc: 'Cabin / private / special area', icon: Box, color: 'border-gray-400 bg-gray-50 text-gray-700' },
];

const step1Schema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  phone: z.string().min(10, 'Valid phone required'),
  password: z.string().min(8, 'Min 8 chars').regex(/[A-Z]/, 'Needs uppercase').regex(/[0-9]/, 'Needs number'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

const step2Schema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', '']).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

export default function StudentRegister() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [utrNumber, setUtrNumber] = useState('');
  const [utrStatus, setUtrStatus] = useState(null); // null | 'valid' | 'invalid' | 'checking'
  const [submitted, setSubmitted] = useState(false);

  const { data: hall } = useQuery({
    queryKey: ['public', 'hall', slug],
    queryFn: () => api.get(`/public/${slug}`).then((r) => r.data),
  });

  // Load plans filtered by selected category
  const { data: plans = [] } = useQuery({
    queryKey: ['public', 'plans', slug, selectedCategory],
    queryFn: () => api.get(`/public/${slug}/plans${selectedCategory ? `?category=${selectedCategory}` : ''}`).then((r) => r.data),
    enabled: step === 3 && !!selectedCategory,
  });

  // Load seats filtered by selected category
  const { data: seatsData } = useQuery({
    queryKey: ['public', 'seats', slug, selectedCategory],
    queryFn: () => api.get(`/public/${slug}/seats${selectedCategory ? `?category=${selectedCategory}` : ''}`).then((r) => r.data),
    enabled: step === 3 && !!selectedCategory,
  });

  const { register: r1, handleSubmit: h1, watch: w1, formState: { errors: e1 } } = useForm({ resolver: zodResolver(step1Schema) });
  const { register: r2, handleSubmit: h2, formState: { errors: e2 } } = useForm({ resolver: zodResolver(step2Schema) });
  const password = w1('password', '');

  const registerMutation = useMutation({
    mutationFn: (body) => api.post('/auth/register-student', body),
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error(e?.response?.data?.error || 'Registration failed'),
  });

  const validateUTR = async (utr) => {
    if (!utr || utr.length < 6) return;
    setUtrStatus('checking');
    try {
      const res = await api.post('/public/validate-utr', { utrNumber: utr });
      setUtrStatus(res.data.valid ? 'valid' : 'invalid');
      if (!res.data.valid) toast.error(res.data.message);
    } catch {
      setUtrStatus(null);
    }
  };

  const handleStep1 = (data) => { setFormData((f) => ({ ...f, ...data })); setStep(1); };
  const handleStep2 = (data) => { setFormData((f) => ({ ...f, ...data })); setStep(2); };
  const handleStep3 = () => {
    if (!selectedCategory) return toast.error('Please select a seating type');
    setSelectedSeat(null);
    setSelectedPlan(null);
    setStep(3);
  };
  const handleStep4 = () => {
    if (!selectedPlan) return toast.error('Please select a plan');
    setStep(4);
  };
  const handleStep5 = () => {
    if (paymentMethod === 'upi' && !utrNumber) return toast.error('Enter UTR number for UPI payment');
    if (paymentMethod === 'upi' && utrStatus === 'invalid') return toast.error('This UTR is already used. Please use a new transaction.');
    setStep(5);
  };

  const handleSubmit = () => {
    registerMutation.mutate({
      tenantSlug: slug,
      fullName: formData.fullName,
      phone: formData.phone,
      password: formData.password,
      email: formData.email || undefined,
      dateOfBirth: formData.dateOfBirth || undefined,
      gender: formData.gender || undefined,
      address: formData.address || undefined,
      emergencyContactName: formData.emergencyContactName || undefined,
      emergencyContactPhone: formData.emergencyContactPhone || undefined,
      emergencyContactRelation: formData.emergencyContactRelation || undefined,
      preferredSeatId: selectedSeat?.id,
      planId: selectedPlan?.id,
      paymentMethod,
      utrNumber: utrNumber || undefined,
      seatCategory: selectedCategory,
    });
  };

  const themeColor = hall?.tenant?.theme_color || '#2563EB';
  const hallName = hall?.tenant?.hall_name;

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-sm w-full text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Application Submitted!</h1>
          <p className="text-sm text-gray-600">
            Your registration has been submitted to <strong>{hallName}</strong>.
            {paymentMethod === 'upi' && utrNumber && (
              <> Your UTR <span className="font-mono font-semibold text-primary-600">{utrNumber}</span> has been recorded for verification.</>
            )}
          </p>
          <p className="text-xs text-gray-400">You will be notified once the admin verifies your payment and approves your seat.</p>
          <Link to={`/${slug}/login`}><Button className="w-full">Go to Login</Button></Link>
        </motion.div>
      </div>
    );
  }

  // Step progress bar
  const progress = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="px-6 py-5" style={{ backgroundColor: themeColor }}>
            <div className="flex items-center gap-2 mb-3">
              {hall?.tenant?.logo_url
                ? <img src={hall.tenant.logo_url} alt={hallName} className="h-8 w-8 rounded-lg object-contain bg-white/20 p-0.5" />
                : <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center"><GraduationCap className="h-4 w-4 text-white" /></div>
              }
              <p className="text-white font-bold">{hallName || 'StudyHub'}</p>
            </div>
            {/* Step labels */}
            <div className="flex items-center gap-1 mb-2">
              {STEPS.map((label, i) => (
                <div key={i} className={`flex-1 text-center text-[9px] font-medium truncate ${i === step ? 'text-white' : 'text-white/50'}`}>{label}</div>
              ))}
            </div>
            {/* Progress bar */}
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 min-h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >

                {/* Step 0 — Personal Info */}
                {step === 0 && (
                  <form onSubmit={h1(handleStep1)} className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                    <Input label="Full Name" required placeholder="Your full name" error={e1.fullName?.message} {...r1('fullName')} />
                    <Input label="Phone Number" required type="tel" placeholder="10-digit mobile number" error={e1.phone?.message} {...r1('phone')} />
                    <Input label="Password" type="password" required placeholder="Min 8 chars, 1 uppercase, 1 number" error={e1.password?.message} {...r1('password')} />
                    <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden">
                      <div className={`h-1 rounded-full transition-all ${
                        password.length === 0 ? 'w-0 bg-gray-300' :
                        password.length < 6 ? 'w-1/4 bg-red-400' :
                        password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password) ? 'w-2/4 bg-yellow-400' :
                        'w-full bg-emerald-500'
                      }`} />
                    </div>
                    <Input label="Confirm Password" type="password" required placeholder="Re-enter password" error={e1.confirmPassword?.message} {...r1('confirmPassword')} />
                    <Button type="submit" className="w-full">Next →</Button>
                  </form>
                )}

                {/* Step 1 — More Details */}
                {step === 1 && (
                  <form onSubmit={h2(handleStep2)} className="space-y-3">
                    <h2 className="text-lg font-semibold text-gray-900">Additional Details</h2>
                    <Input label="Email (optional)" type="email" placeholder="your@email.com" {...r2('email')} />
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Date of Birth" type="date" {...r2('dateOfBirth')} />
                      <Select label="Gender" placeholder="Select"
                        options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]}
                        {...r2('gender')} />
                    </div>
                    <Textarea label="Address" placeholder="Your home address" rows={2} {...r2('address')} />
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-gray-500 mb-2">Emergency Contact</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input label="Name" placeholder="Parent / Guardian" {...r2('emergencyContactName')} />
                        <Input label="Phone" placeholder="Contact number" {...r2('emergencyContactPhone')} />
                        <Input label="Relation" placeholder="e.g. Father" {...r2('emergencyContactRelation')} />
                      </div>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(0)}>← Back</Button>
                      <Button type="submit" className="flex-1">Next →</Button>
                    </div>
                  </form>
                )}

                {/* Step 2 — Choose Seating Type */}
                {step === 2 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Choose Seating Type</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Select the type of seat you want to book</p>
                    </div>
                    <div className="space-y-3">
                      {CATEGORY_OPTIONS.map(({ value, label, desc, icon: Icon, color }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setSelectedCategory(value)}
                          className={cn(
                            'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
                            selectedCategory === value
                              ? color + ' border-opacity-100 shadow-sm scale-[1.01]'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          )}
                        >
                          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0',
                            selectedCategory === value ? 'bg-white/60' : 'bg-gray-100')}>
                            <Icon className={`h-5 w-5 ${selectedCategory === value ? '' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{label}</p>
                            <p className="text-xs text-gray-500">{desc}</p>
                          </div>
                          {selectedCategory === value && (
                            <CheckCircle className="h-5 w-5 ml-auto flex-shrink-0 text-current" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                      <Button className="flex-1" onClick={handleStep3}>Next →</Button>
                    </div>
                  </div>
                )}

                {/* Step 3 — Choose Seat & Plan */}
                {step === 3 && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Choose Seat & Plan</h2>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Showing {CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label} options
                      </p>
                    </div>

                    {/* Plans */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Select Plan <span className="text-red-500">*</span></p>
                      {plans.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3 text-center">No plans available for this category</p>
                      ) : (
                        <div className="space-y-2">
                          {plans.map((plan) => (
                            <label key={plan.id}
                              className={cn('flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all',
                                selectedPlan?.id === plan.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300')}>
                              <input type="radio" name="plan" className="sr-only" onChange={() => setSelectedPlan(plan)} />
                              <div className="flex-1">
                                <p className="text-sm font-semibold">{plan.plan_name}</p>
                                <p className="text-xs text-gray-500 capitalize">
                                  {plan.plan_type?.replace('_', ' ')} · {plan.validity_type}
                                  {plan.validity_days ? ` (${plan.validity_days} days)` : ''}
                                </p>
                              </div>
                              <p className="text-base font-bold text-primary-600">{formatCurrency(plan.price)}</p>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Seat Grid */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1.5">
                        Select Seat <span className="text-gray-400 font-normal">(optional)</span>
                      </p>
                      {(seatsData?.sections || []).filter(s => s.seats?.length > 0).map((section) => (
                        <div key={section.id} className="mb-3">
                          <p className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: section.color_code || '#6366f1' }} />
                            {section.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {section.seats?.filter(s => s.status === 'available').map(seat => (
                              <button key={seat.id} type="button"
                                onClick={() => setSelectedSeat(selectedSeat?.id === seat.id ? null : seat)}
                                className={cn('h-9 min-w-[48px] px-2 rounded-lg border-2 text-xs font-semibold transition-all',
                                  selectedSeat?.id === seat.id
                                    ? 'border-primary-600 bg-primary-500 text-white scale-105'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:scale-105')}>
                                {seat.seat_number}
                              </button>
                            ))}
                            {section.seats?.filter(s => s.status === 'reserved').map(seat => (
                              <div key={seat.id} className="h-9 min-w-[48px] px-2 rounded-lg border-2 border-amber-300 bg-amber-50 text-xs font-semibold text-amber-600 flex items-center justify-center cursor-not-allowed">
                                {seat.seat_number}
                              </div>
                            ))}
                            {section.seats?.filter(s => !['available', 'reserved'].includes(s.status)).map(seat => (
                              <div key={seat.id} className="h-9 min-w-[48px] px-2 rounded-lg border-2 border-gray-200 bg-gray-100 text-xs font-semibold text-gray-400 flex items-center justify-center cursor-not-allowed">
                                {seat.seat_number}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-emerald-50 border border-emerald-300 inline-block" />Available</span>
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-50 border border-amber-300 inline-block" />Pending</span>
                        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-gray-100 border border-gray-200 inline-block" />Occupied</span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                      <Button className="flex-1" onClick={handleStep4}>Next →</Button>
                    </div>
                  </div>
                )}

                {/* Step 4 — Payment */}
                {step === 4 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Payment Details</h2>
                    {selectedPlan && (
                      <div className="p-3 bg-primary-50 rounded-xl border border-primary-100">
                        <p className="text-sm font-semibold text-primary-800">{selectedPlan.plan_name}</p>
                        <p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedPlan.price)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: 'cash', label: '💵 Cash', desc: 'Pay at the hall' },
                          { value: 'upi', label: '📲 UPI', desc: 'Pay online' },
                        ].map((m) => (
                          <button key={m.value} type="button"
                            onClick={() => { setPaymentMethod(m.value); setUtrStatus(null); setUtrNumber(''); }}
                            className={cn('py-3 px-4 rounded-xl border-2 text-sm font-semibold text-left transition-all',
                              paymentMethod === m.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                            <p>{m.label}</p>
                            <p className="text-xs font-normal">{m.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {paymentMethod === 'upi' && (
                      <div className="space-y-2">
                        <div className="relative">
                          <Input
                            label="UTR / Transaction Reference Number"
                            required
                            placeholder="12-digit UTR from your UPI app"
                            value={utrNumber}
                            onChange={(e) => { setUtrNumber(e.target.value.toUpperCase()); setUtrStatus(null); }}
                            onBlur={() => validateUTR(utrNumber)}
                          />
                          {utrStatus === 'checking' && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <span className="h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                              Validating UTR…
                            </p>
                          )}
                          {utrStatus === 'valid' && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5" /> UTR is valid
                            </p>
                          )}
                          {utrStatus === 'invalid' && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" /> This UTR has already been used
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg p-2">
                          ℹ️ Enter the exact UTR/Reference ID from your UPI payment. Admin will verify before approving your seat.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>← Back</Button>
                      <Button className="flex-1" onClick={handleStep5}>Next →</Button>
                    </div>
                  </div>
                )}

                {/* Step 5 — Review */}
                {step === 5 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
                    <div className="space-y-0 rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      {[
                        ['Name', formData.fullName],
                        ['Phone', formData.phone],
                        ['Email', formData.email || '—'],
                        ['Seating Type', CATEGORY_OPTIONS.find(c => c.value === selectedCategory)?.label || '—'],
                        ['Selected Seat', selectedSeat?.seat_number || 'Admin will assign'],
                        ['Plan', selectedPlan?.plan_name],
                        ['Amount', formatCurrency(selectedPlan?.price)],
                        ['Payment', paymentMethod.toUpperCase()],
                        paymentMethod === 'upi' && utrNumber ? ['UTR', <span className="font-mono text-xs">{utrNumber}</span>] : null,
                      ].filter(Boolean).map(([label, value]) => (
                        <div key={label} className="flex justify-between px-4 py-2.5">
                          <span className="text-sm text-gray-500">{label}</span>
                          <span className="font-semibold text-gray-900 text-sm">{value}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg p-3">
                      ⚠️ Your application will be reviewed by the hall admin.
                      {paymentMethod === 'upi' && ' UTR will be verified before seat assignment.'}
                    </p>
                    <div className="flex gap-3">
                      <Button variant="secondary" className="flex-1" onClick={() => setStep(4)}>← Back</Button>
                      <Button className="flex-1" onClick={handleSubmit} loading={registerMutation.isPending}>
                        Submit Application
                      </Button>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>

          <div className="px-6 pb-5 text-center border-t border-gray-50 pt-4">
            <p className="text-xs text-gray-400">
              Already registered?{' '}
              <Link to={`/${slug}/login`} className="text-primary-600 hover:underline font-medium">Sign in here</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
