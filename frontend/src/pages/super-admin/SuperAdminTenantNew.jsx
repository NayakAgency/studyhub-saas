import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Stepper from '../../components/ui/Stepper.jsx';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import {
  ArrowLeft, CheckCircle, Building2, User, Package, ClipboardList,
  Check, ExternalLink, Copy
} from 'lucide-react';
import { slugify, formatCurrency } from '../../lib/utils.js';

const STEPS = [
  { label: 'Hall Details' },
  { label: 'Owner Info' },
  { label: 'Plan Selection' },
  { label: 'Review & Create' },
];

const DEFAULT_PLANS = [
  {
    id: 'standard',
    name: 'standard',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    maxSeats: 100,
    maxStudents: 150,
    features: ['Up to 100 seats', 'Student portal', 'Fee management', 'Basic reports', 'Email support'],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'premium',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    maxSeats: 500,
    maxStudents: 750,
    features: ['Up to 500 seats', 'Everything in Standard', 'Advanced analytics', 'Custom branding', 'Priority support', 'PDF receipts'],
    isActive: true,
  },
  {
    id: 'enterprise',
    name: 'enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    maxSeats: -1,
    maxStudents: -1,
    features: ['Unlimited seats', 'Everything in Premium', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'On-site training'],
    isActive: true,
  },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperAdminTenantNew() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = location.state?.prefill || {};

  const [step, setStep] = useState(0);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [selectedPlanId, setSelectedPlanId] = useState(prefill.planType || null);
  const [form, setForm] = useState({
    hallName:   prefill.hallName   || '',
    slug:       prefill.hallName   ? slugify(prefill.hallName).toLowerCase() : '',
    city:       prefill.city       || '',
    address:    '',
    ownerName:  prefill.ownerName  || '',
    ownerEmail: prefill.ownerEmail || '',
    ownerPhone: prefill.ownerPhone || '',
  });
  const [created, setCreated] = useState(null);

  const { data: plansData } = useQuery({
    queryKey: ['super-admin', 'saas-plans'],
    queryFn: () => api.get('/super-admin/saas-plans').then((r) => r.data),
    placeholderData: DEFAULT_PLANS,
    retry: false,
  });

  const plans = (plansData && plansData.length > 0 ? plansData : DEFAULT_PLANS).filter((p) => p.isActive);
  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const f = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const getPlanPrice = (plan) => {
    if (!plan) return null;
    if (billingCycle === 'yearly') return plan.yearlyPrice;
    return plan.monthlyPrice;
  };

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/super-admin/tenants', body),
    onSuccess: (res) => setCreated(res.data),
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to create hall'),
  });

  const validateStep = () => {
    if (step === 0) {
      if (!form.hallName.trim()) { toast.error('Hall name is required'); return false; }
      if (!form.slug.trim()) { toast.error('URL slug is required'); return false; }
      if (!/^[a-z0-9-]+$/.test(form.slug)) { toast.error('Slug must be lowercase letters, numbers, and hyphens only'); return false; }
      return true;
    }
    if (step === 1) {
      if (!form.ownerName.trim()) { toast.error('Owner name is required'); return false; }
      if (!form.ownerEmail.trim()) { toast.error('Owner email is required'); return false; }
      if (!EMAIL_REGEX.test(form.ownerEmail)) { toast.error('Please enter a valid email address'); return false; }
      if (!form.ownerPhone.trim()) { toast.error('Owner phone is required'); return false; }
      return true;
    }
    if (step === 2) {
      if (!selectedPlanId) { toast.error('Please select a plan'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    // Submit
    const price = getPlanPrice(selectedPlan);
    createMutation.mutate({
      hallName: form.hallName,
      slug: form.slug.toLowerCase(),
      city: form.city,
      address: form.address,
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPhone: form.ownerPhone,
      planType: selectedPlan?.name || 'standard',
      billingType: billingCycle === 'yearly' ? 'yearly' : 'monthly',
      billingAmount: price || undefined,
      sendWelcomeEmail: false,
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied!'));
  };

  if (created) {
    const adminUrl = `${window.location.origin}/admin/login`;
    const studentUrl = `${window.location.origin}/${created.tenant?.slug}`;

    return (
      <div className="p-6 max-w-lg mx-auto">
        <Card className="overflow-hidden">
          <div className="bg-emerald-600 px-8 pt-8 pb-6 text-center">
            <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white font-display">Hall Created Successfully!</h2>
            <p className="text-emerald-200 text-sm mt-1">{created.tenant?.hall_name}</p>
          </div>

          <CardBody className="space-y-4">
            {created.tempPassword && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wide">Temporary Admin Password</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-base font-mono font-bold text-amber-900 flex-1">{created.tempPassword}</code>
                  <button onClick={() => copyToClipboard(created.tempPassword)} className="text-amber-600 hover:text-amber-800">
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-amber-600 mt-1">Share this password with the hall owner securely.</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Portal Links</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">Admin Login URL</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{adminUrl}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => copyToClipboard(adminUrl)} className="p-1 text-gray-400 hover:text-gray-600">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a href={adminUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-gray-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
                  <div>
                    <p className="text-xs text-gray-500">Student Portal URL</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{studentUrl}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => copyToClipboard(studentUrl)} className="p-1 text-gray-400 hover:text-gray-600">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <a href={studentUrl} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-gray-600">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => navigate('/super-admin/tenants')}>
                Back to Halls
              </Button>
              <Button className="flex-1" onClick={() => navigate(`/super-admin/tenants/${created.tenant?.id}`)}>
                View Hall
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-5">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-2xl font-bold text-gray-900 font-display mb-6">Add New Study Hall</h1>
      <div className="mb-8">
        <Stepper steps={STEPS} currentStep={step} />
      </div>

      <Card>
        <CardBody>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Hall Details */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-5 w-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">Hall Details</h2>
                  </div>
                  <Input
                    label="Hall Name"
                    required
                    placeholder="Sunrise Study Hall"
                    value={form.hallName}
                    onChange={(e) => {
                      const name = e.target.value;
                      f('hallName', name);
                      f('slug', slugify(name).toLowerCase());
                    }}
                  />
                  <Input
                    label="URL Slug"
                    required
                    placeholder="sunrise-study-hall"
                    value={form.slug}
                    onChange={(e) => f('slug', slugify(e.target.value.toLowerCase()).toLowerCase())}
                    hint={`Your hall URL: ${window.location.origin}/${form.slug || 'your-slug'}`}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="City"
                      placeholder="Mumbai"
                      value={form.city}
                      onChange={(e) => f('city', e.target.value)}
                    />
                    <Input
                      label="Address"
                      placeholder="123 Main St"
                      value={form.address}
                      onChange={(e) => f('address', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Owner Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-5 w-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">Owner Information</h2>
                  </div>
                  <Input
                    label="Owner Name"
                    required
                    placeholder="Ramesh Patel"
                    value={form.ownerName}
                    onChange={(e) => f('ownerName', e.target.value)}
                  />
                  <Input
                    label="Owner Email"
                    required
                    type="email"
                    placeholder="owner@example.com"
                    value={form.ownerEmail}
                    onChange={(e) => f('ownerEmail', e.target.value)}
                  />
                  <Input
                    label="Owner Phone"
                    required
                    type="tel"
                    placeholder="9876543210"
                    value={form.ownerPhone}
                    onChange={(e) => f('ownerPhone', e.target.value)}
                  />
                </div>
              )}

              {/* Step 2: Plan Selection */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="h-5 w-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">Select Plan</h2>
                  </div>

                  {/* Billing cycle toggle */}
                  <div className="flex justify-center">
                    <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
                      {['monthly', 'yearly'].map((cycle) => (
                        <button
                          key={cycle}
                          onClick={() => setBillingCycle(cycle)}
                          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                            billingCycle === cycle
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {cycle}
                          {cycle === 'yearly' && (
                            <span className="ml-1.5 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-semibold">
                              Save 17%
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {plans.map((plan) => {
                      const price = getPlanPrice(plan);
                      const isSelected = selectedPlanId === plan.id;

                      return (
                        <button
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-gray-900 capitalize">{plan.name}</p>
                                {plan.name === 'premium' && (
                                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mb-2">
                                {plan.maxSeats === -1 ? 'Unlimited' : `Up to ${plan.maxSeats}`} seats ·{' '}
                                {plan.maxStudents === -1 ? 'Unlimited' : `Up to ${plan.maxStudents}`} students
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {plan.features.slice(0, 3).map((feat) => (
                                  <span key={feat} className="inline-flex items-center gap-1 text-xs text-gray-600">
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {price ? (
                                <>
                                  <p className="text-xl font-bold text-gray-900">₹{price.toLocaleString('en-IN')}</p>
                                  <p className="text-xs text-gray-400">/{billingCycle === 'yearly' ? 'year' : 'month'}</p>
                                </>
                              ) : (
                                <p className="text-sm font-bold text-gray-900">Custom</p>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <div className="mt-2 pt-2 border-t border-primary-200">
                              <div className="flex flex-wrap gap-x-3 gap-y-1">
                                {plan.features.map((feat) => (
                                  <span key={feat} className="inline-flex items-center gap-1 text-xs text-primary-700">
                                    <Check className="h-3 w-3" />
                                    {feat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Review & Create */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="h-5 w-5 text-primary-600" />
                    <h2 className="text-base font-semibold text-gray-900">Review & Create</h2>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-0 text-sm divide-y divide-gray-100">
                    {[
                      ['Hall Name', form.hallName],
                      ['Slug', `/${form.slug}`],
                      ['City', form.city || '—'],
                      ['Address', form.address || '—'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-2">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 space-y-0 text-sm divide-y divide-gray-100">
                    {[
                      ['Owner', form.ownerName],
                      ['Email', form.ownerEmail],
                      ['Phone', form.ownerPhone],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between py-2">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>

                  {selectedPlan && (
                    <div className="bg-primary-50 border border-primary-100 rounded-xl p-4">
                      <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide mb-2">Selected Plan</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900 capitalize">{selectedPlan.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{billingCycle} billing</p>
                        </div>
                        <div className="text-right">
                          {getPlanPrice(selectedPlan) ? (
                            <>
                              <p className="text-lg font-bold text-primary-700">
                                ₹{getPlanPrice(selectedPlan).toLocaleString('en-IN')}
                              </p>
                              <p className="text-xs text-gray-400">/{billingCycle === 'yearly' ? 'year' : 'month'}</p>
                            </>
                          ) : (
                            <p className="font-bold text-gray-900">Custom Pricing</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-400 text-center">
                    A temporary password will be generated. No welcome email will be sent.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-3 justify-between mt-6 pt-4 border-t border-gray-100">
            <Button
              variant="secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Back
            </Button>
            <Button onClick={handleNext} loading={createMutation.isPending}>
              {step === 3 ? 'Create Hall' : 'Next →'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
