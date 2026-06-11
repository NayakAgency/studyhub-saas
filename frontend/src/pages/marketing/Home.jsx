import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import {
  GraduationCap, Users, Armchair, CreditCard, BarChart3, Bell, Shield,
  ChevronDown, Check, Star, MapPin, Search, Building2, Smartphone,
  FileText, Zap, MessageSquare, BookOpen, TrendingUp, Globe, Package,
  ChevronRight, ExternalLink, Phone, Mail, CheckCircle,
} from 'lucide-react';

// ── Default data ─────────────────────────────────────────────

const DEFAULT_PLANS = [
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    features: [
      'Up to 100 seats',
      'Student self-registration portal',
      'Fee & payment management',
      'Seat booking & management',
      'Complaints & suggestions',
      'Basic reports',
      'In-app notifications',
      'Email support',
    ],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    features: [
      'Up to 500 seats',
      'Everything in Standard',
      'Advanced analytics & ML forecasting',
      'Churn risk analysis',
      'Custom hall branding & theme',
      'Gallery & resources management',
      'Real-time WebSocket dashboards',
      'Priority support',
    ],
    isActive: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      'Unlimited seats & students',
      'Everything in Premium',
      'Custom domain support',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
      'On-site onboarding & training',
    ],
    isActive: true,
  },
];

const STUDENT_FEATURES = [
  { icon: FileText, title: 'Digital ID Card', desc: 'Instant digital student ID card with QR code for verification and check-ins.' },
  { icon: Armchair, title: 'Live Seat Booking', desc: 'Book and view your assigned seat in real time. See occupancy at a glance.' },
  { icon: CreditCard, title: 'Fee Payments via UPI', desc: 'Pay fees digitally via UPI. Get instant receipts. Track your payment history.' },
  { icon: Bell, title: 'Real-time Notifications', desc: 'Receive fee reminders, announcements, and important updates instantly.' },
  { icon: BookOpen, title: 'Study Resources', desc: 'Access notes, PDFs, and study materials uploaded by your hall admin.' },
  { icon: MessageSquare, title: 'Complaint Management', desc: 'Raise complaints and track resolution status directly from your portal.' },
];

const OWNER_FEATURES = [
  { icon: Building2, title: 'Multi-tenant Management', desc: 'Manage multiple study halls under one platform with full data isolation.' },
  { icon: TrendingUp, title: 'Advanced Analytics & ML', desc: 'Revenue forecasting, occupancy trends, and student retention insights.' },
  { icon: Globe, title: 'Student Portal with Self-registration', desc: 'Each hall gets a public website. Students register themselves — you just approve.' },
  { icon: CreditCard, title: 'Fee & Payment Tracking', desc: 'Track all fee collections, overdue payments, and generate detailed reports.' },
  { icon: Zap, title: 'Real-time WebSocket Updates', desc: 'Live dashboards, instant notifications, and real-time seat availability.' },
  { icon: Bell, title: 'Automated Reminders', desc: 'Set up automatic fee reminders, renewal alerts, and custom announcements.' },
];

const WHY_US = [
  'Built specifically for Indian study halls — not a generic SaaS',
  'UPI & cash support out of the box',
  'Full student self-service portal — zero phone calls',
  'Row-level security — your data is completely isolated',
  'Setup in under 30 minutes with our guided wizard',
  'No hidden fees — transparent pricing, cancel anytime',
];

const FAQS = [
  { q: 'How long does setup take?', a: 'Most study halls are up and running in under 30 minutes using our setup wizard.' },
  { q: 'Can students register themselves?', a: 'Yes! Each hall gets a public website with self-registration. Admin approves applications.' },
  { q: 'Is my data secure?', a: 'Completely. Each hall is isolated via row-level security. No cross-tenant data leakage.' },
  { q: 'Do you offer a free trial?', a: "Contact us to get started. We'll set up your hall and walk you through the platform." },
  { q: 'Can I use my own domain?', a: 'Premium and Enterprise plans support custom domains and branding.' },
  { q: 'What payment methods work?', a: 'Cash and UPI are supported for student fee collection. More methods coming soon.' },
];

// ── Animated Study Illustration ──────────────────────────────

function StudyIllustration() {
  return (
    <div className="relative w-full h-72 md:h-80">
      {/* Desk */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-56 h-3 bg-amber-800 rounded-xl"
      />
      {/* Monitor */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4 }}
        className="absolute bottom-11 left-1/2 -translate-x-1/2 w-36 h-24 bg-gray-800 rounded-lg border-4 border-gray-700 flex items-center justify-center"
      >
        <div className="w-28 h-16 bg-primary-900 rounded flex flex-col gap-1 p-1.5 overflow-hidden">
          <div className="h-2 bg-primary-400 rounded-full w-20 opacity-80" />
          <div className="h-1.5 bg-primary-300 rounded-full w-14 opacity-60" />
          <div className="h-1.5 bg-primary-300 rounded-full w-16 opacity-60" />
          <div className="grid grid-cols-4 gap-0.5 mt-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-3 rounded-sm ${i % 3 === 0 ? 'bg-emerald-400' : i % 3 === 1 ? 'bg-blue-400' : 'bg-gray-600'} opacity-80`} />
            ))}
          </div>
        </div>
        {/* Monitor stand */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-2 h-4 bg-gray-700" />
      </motion.div>

      {/* Book stack */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="absolute bottom-11 left-[calc(50%-80px)] space-y-0.5"
      >
        <div className="w-12 h-2 bg-red-400 rounded-sm" />
        <div className="w-12 h-2 bg-blue-400 rounded-sm" />
        <div className="w-12 h-2 bg-emerald-400 rounded-sm" />
      </motion.div>

      {/* Coffee */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-11 right-[calc(50%-80px)]"
      >
        <div className="w-6 h-6 bg-amber-100 border-2 border-amber-300 rounded-b-full" />
      </motion.div>

      {/* Floating stats */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute top-4 left-4 bg-white rounded-xl shadow-card px-3 py-2 border border-gray-100"
      >
        <p className="text-xs font-bold text-gray-900">Seat Booked!</p>
        <p className="text-xs text-emerald-500 font-medium">Seat A-12 ✓</p>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 3.5, delay: 0.5 }}
        className="absolute top-4 right-4 bg-white rounded-xl shadow-card px-3 py-2 border border-gray-100"
      >
        <p className="text-xs font-bold text-gray-900">Fee Paid</p>
        <p className="text-xs text-primary-500 font-medium">₹999 via UPI ✓</p>
      </motion.div>

      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ repeat: Infinity, duration: 4, delay: 1 }}
        className="absolute bottom-28 right-6 bg-white rounded-xl shadow-card px-3 py-2 border border-gray-100"
      >
        <p className="text-xs font-bold text-gray-900">Students Online</p>
        <p className="text-xs text-blue-500 font-medium">47 active now</p>
      </motion.div>
    </div>
  );
}

// ── Location Banner ──────────────────────────────────────────

function LocationBanner() {
  const [locationState, setLocationState] = useState('idle'); // idle | loading | granted | denied
  const [nearestHall, setNearestHall] = useState(null);

  const fetchNearest = async (lat, lng) => {
    try {
      const res = await api.get(`/public/nearest?lat=${lat}&lng=${lng}`);
      const halls = res.data;
      if (halls && halls.length > 0) {
        setNearestHall(halls[0]);
      }
    } catch {
      // fallback silently
    }
    setLocationState('granted');
  };

  const requestLocation = () => {
    setLocationState('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchNearest(pos.coords.latitude, pos.coords.longitude),
      () => setLocationState('denied'),
    );
  };

  if (locationState === 'idle') {
    return (
      <div className="flex items-center justify-center gap-3 bg-primary-50 border border-primary-100 rounded-2xl px-5 py-3">
        <MapPin className="h-4 w-4 text-primary-600 flex-shrink-0" />
        <span className="text-sm text-primary-700">
          Find the nearest StudyHub centre to you.{' '}
          <button onClick={requestLocation} className="font-semibold underline">
            Allow location
          </button>
        </span>
      </div>
    );
  }

  if (locationState === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 bg-primary-50 border border-primary-100 rounded-2xl px-5 py-3">
        <div className="h-4 w-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-primary-700">Locating nearest centre…</span>
      </div>
    );
  }

  if (locationState === 'granted' && nearestHall) {
    return (
      <div className="flex items-center justify-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3">
        <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
        <span className="text-sm text-emerald-700">
          Nearest StudyHub centre:{' '}
          <strong>{nearestHall.hall_name}</strong>{' '}
          {nearestHall.city ? `— ${nearestHall.city}` : ''}
          {nearestHall.slug && (
            <Link to={`/${nearestHall.slug}`} className="ml-2 underline font-semibold">
              View Hall →
            </Link>
          )}
        </span>
      </div>
    );
  }

  if (locationState === 'denied') {
    return (
      <div className="flex items-center justify-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-3">
        <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="text-sm text-gray-500">Location access denied. Browse all halls below.</span>
      </div>
    );
  }

  return null;
}

// ── Study Halls Section ───────────────────────────────────────

function StudyHallsSection() {
  const { data: halls, isLoading } = useQuery({
    queryKey: ['public', 'halls'],
    queryFn: () => api.get('/public/halls').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-gray-100 animate-pulse rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!halls || halls.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">
        No study halls listed yet. Be the first to{' '}
        <Link to="/super-admin/login" className="text-primary-600 font-semibold underline">
          join the platform
        </Link>
        .
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {halls.map((hall, i) => (
        <motion.div
          key={hall.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.05 }}
          className="bg-white rounded-2xl border border-gray-200 hover:shadow-card-hover transition-all overflow-hidden group"
        >
          {/* Color header */}
          <div
            className="h-16 flex items-center justify-center relative"
            style={{ backgroundColor: hall.theme_color || '#6366f1' }}
          >
            {hall.logo_url ? (
              <img src={hall.logo_url} alt={hall.hall_name} className="h-10 w-10 rounded-full object-cover border-2 border-white/50" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
            )}
          </div>

          <div className="p-4">
            <h3 className="font-bold text-gray-900 mb-0.5">{hall.hall_name}</h3>
            {hall.city && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                <MapPin className="h-3 w-3" /> {hall.city}
              </p>
            )}
            {hall.minPrice && (
              <p className="text-sm font-semibold text-primary-600 mb-3">
                From ₹{Number(hall.minPrice).toLocaleString('en-IN')}/month
              </p>
            )}
            <div className="flex gap-2">
              <Link to={`/${hall.slug}`} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full">View Hall</Button>
              </Link>
              <Link to={`/${hall.slug}/register`} className="flex-1">
                <Button size="sm" className="w-full">Book Seat</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Pricing Plans (for Hall Owners) ──────────────────────────

function OwnerPlansSection({ billingCycle, setBillingCycle }) {
  const { data: plansData } = useQuery({
    queryKey: ['super-admin', 'saas-plans'],
    queryFn: () => api.get('/super-admin/saas-plans').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const plans = (plansData && plansData.length > 0 ? plansData : DEFAULT_PLANS).filter((p) => p.isActive !== false);

  return (
    <div className="space-y-6">
      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-white/10 backdrop-blur-sm rounded-xl p-1 gap-1">
          {['monthly', 'yearly'].map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                billingCycle === cycle
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {cycle}
              {cycle === 'yearly' && (
                <span className="ml-1.5 text-xs bg-emerald-400/30 text-emerald-100 px-1.5 py-0.5 rounded-full">
                  Save 17%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          const isPop = plan.name === 'premium' || plan.name === 'Premium';

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-7 ${
                isPop
                  ? 'bg-white text-gray-900 shadow-2xl'
                  : 'bg-white/10 text-white border border-white/20'
              }`}
            >
              {isPop && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-gray-900 text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}
              <p className={`text-lg font-bold capitalize mb-1 ${isPop ? 'text-gray-900' : 'text-white'}`}>
                {plan.name}
              </p>
              <div className="my-4">
                {price ? (
                  <>
                    <span className={`text-4xl font-bold font-display ${isPop ? 'text-gray-900' : 'text-white'}`}>
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-sm ml-1 ${isPop ? 'text-gray-400' : 'text-white/60'}`}>
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </>
                ) : (
                  <span className={`text-2xl font-bold ${isPop ? 'text-gray-900' : 'text-white'}`}>Custom</span>
                )}
              </div>
              <ul className="space-y-2 mb-7">
                {(plan.features || []).map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${isPop ? 'text-gray-600' : 'text-white/80'}`}>
                    <Check className={`h-4 w-4 flex-shrink-0 ${isPop ? 'text-primary-500' : 'text-emerald-400'}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/super-admin/login">
                <button
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isPop
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  {!price ? 'Contact Sales' : 'Get Started'}
                </button>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Owner Request Form ────────────────────────────────────────

function OwnerRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    ownerName: '', ownerEmail: '', ownerPhone: '',
    hallName: '', city: '', seatCount: '', message: '', planInterest: 'standard',
  });

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const mutation = useMutation({
    mutationFn: (body) => api.post('/public/inquire', body),
    onSuccess: () => setSubmitted(true),
    onError: (e) => toast.error(e?.response?.data?.error || 'Submission failed. Please try again.'),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.ownerName || !form.ownerEmail || !form.ownerPhone || !form.hallName) {
      return toast.error('Please fill in all required fields');
    }
    mutation.mutate({
      ownerName: form.ownerName,
      ownerEmail: form.ownerEmail,
      ownerPhone: form.ownerPhone,
      hallName: form.hallName,
      city: form.city || undefined,
      seatCount: form.seatCount ? Number(form.seatCount) : undefined,
      message: form.message || undefined,
      planInterest: form.planInterest || undefined,
    });
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
        <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Request Received!</h3>
        <p className="text-gray-600 text-sm max-w-sm mx-auto">
          Thank you! Our team will review your request and contact you within 24 hours to complete your onboarding.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-card p-8 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Your Full Name" required placeholder="Ramesh Patel"
          value={form.ownerName} onChange={e => f('ownerName', e.target.value)} />
        <Input label="Email Address" required type="email" placeholder="owner@yourhall.com"
          value={form.ownerEmail} onChange={e => f('ownerEmail', e.target.value)} />
        <Input label="Phone Number" required type="tel" placeholder="9876543210"
          value={form.ownerPhone} onChange={e => f('ownerPhone', e.target.value)} />
        <Input label="Study Hall Name" required placeholder="Sunrise Study Hall"
          value={form.hallName} onChange={e => f('hallName', e.target.value)} />
        <Input label="City" placeholder="Mumbai"
          value={form.city} onChange={e => f('city', e.target.value)} />
        <Input label="Number of Seats" type="number" placeholder="50"
          value={form.seatCount} onChange={e => f('seatCount', e.target.value)} />
      </div>
      <Select
        label="Interested Plan"
        value={form.planInterest}
        onChange={e => f('planInterest', e.target.value)}
        options={[
          { value: 'standard', label: 'Standard — ₹999/month' },
          { value: 'premium', label: 'Premium — ₹1999/month' },
          { value: 'enterprise', label: 'Enterprise — Custom pricing' },
        ]}
      />
      <Textarea label="Message / Questions (optional)" rows={3}
        placeholder="Tell us about your study hall, any questions, or requirements…"
        value={form.message} onChange={e => f('message', e.target.value)} />
      <Button type="submit" size="lg" className="w-full" loading={mutation.isPending}>
        Submit Request — Get Onboarded in 24 Hours →
      </Button>
      <p className="text-center text-xs text-gray-400">
        No credit card required. We'll set everything up for you.
      </p>
    </form>
  );
}

// ── Main Home Component ───────────────────────────────────────

export default function MarketingHome() {
  const [openFaq, setOpenFaq] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [slugSearch, setSlugSearch] = useState('');
  const navigate = useNavigate();
  const appName = localStorage.getItem('appName') || 'StudyHub';

  const handleSlugSearch = (e) => {
    e.preventDefault();
    if (slugSearch.trim()) {
      navigate(`/${slugSearch.trim().toLowerCase()}`);
    }
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-body">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900 font-display">{appName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            <button onClick={() => scrollTo('halls')} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              Study Halls
            </button>
            <button onClick={() => scrollTo('for-students')} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              For Students
            </button>
            <button onClick={() => scrollTo('for-owners')} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              For Hall Owners
            </button>
            <button onClick={() => scrollTo('faq')} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              FAQ
            </button>
          </nav>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => scrollTo('for-students')} className="hidden sm:block px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
              For Students
            </button>
            <button onClick={() => scrollTo('get-started')} className="hidden sm:block px-3 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
              List Your Hall →
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="py-16 px-4 bg-gradient-to-b from-primary-50 via-white to-white overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-5">
                <Star className="h-3.5 w-3.5" /> Trusted by 100+ study halls across India
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 font-display mb-4 leading-tight">
                Find Your<br />
                <span className="text-primary-600">Perfect Study Space</span>
              </h1>
              <p className="text-lg text-gray-600 mb-7 leading-relaxed">
                {appName} connects students with the best study halls nearby. Seat booking, fee payments, and everything else — all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => scrollTo('halls')}
                  className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors"
                >
                  Browse Study Halls
                </button>
                <button
                  onClick={() => scrollTo('get-started')}
                  className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  List My Study Hall →
                </button>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <StudyIllustration />
            </motion.div>
          </div>

          {/* Location banner */}
          <div className="mt-8 max-w-xl mx-auto">
            <LocationBanner />
          </div>
        </div>
      </section>

      {/* ── Study Halls Showcase ── */}
      <section id="halls" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 font-display">Study Halls Near You</h2>
            <p className="text-gray-500 mt-2">Browse and book seats at premium study spaces</p>
          </div>
          <StudyHallsSection />
        </div>
      </section>

      {/* ── For Students ── */}
      <section id="for-students" className="py-20 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Users className="h-3.5 w-3.5" /> For Students
            </div>
            <h2 className="text-3xl font-bold text-gray-900 font-display">Everything You Need to Study Smarter</h2>
            <p className="text-gray-500 mt-2 max-w-xl mx-auto">
              Your complete student experience — from booking a seat to paying fees — all digital, all seamless.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {STUDENT_FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-white border border-gray-200 hover:border-emerald-200 hover:shadow-card-hover transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center mb-4 transition-colors">
                  <Icon className="h-5 w-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Student Portal CTA / Search ── */}
      <section className="py-16 px-4 bg-emerald-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white font-display mb-2">Already a student?</h2>
          <p className="text-emerald-200 mb-6">Enter your hall's URL slug to access your portal.</p>
          <form onSubmit={handleSlugSearch} className="flex gap-2 max-w-md mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={slugSearch}
                onChange={(e) => setSlugSearch(e.target.value.toLowerCase())}
                placeholder="e.g., sunrise-study-hall"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/30 bg-white text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-white text-emerald-700 font-semibold rounded-xl hover:bg-emerald-50 transition-colors text-sm"
            >
              Go to Hall
            </button>
          </form>
        </div>
      </section>

      {/* ── For Hall Owners ── */}
      <section id="for-owners" className="py-20 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary-800/60 text-primary-300 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Building2 className="h-3.5 w-3.5" /> For Hall Owners
            </div>
            <h2 className="text-3xl font-bold text-white font-display">Run Your Study Hall Like a Business</h2>
            <p className="text-gray-400 mt-2 max-w-xl mx-auto">
              The complete management platform — built specifically for Indian study halls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {OWNER_FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-gray-800 border border-gray-700 hover:border-primary-700 transition-all group"
              >
                <div className="h-11 w-11 rounded-xl bg-primary-900/50 group-hover:bg-primary-900 flex items-center justify-center mb-4 transition-colors">
                  <Icon className="h-5 w-5 text-primary-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Why Only Us */}
          <div className="bg-gray-800 rounded-2xl p-8 mb-16">
            <h3 className="text-xl font-bold text-white mb-6 text-center">Why Only Us?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {WHY_US.map((point, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-5 w-5 rounded-full bg-primary-600/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary-400" />
                  </div>
                  <p className="text-sm text-gray-300">{point}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-1">Simple, Transparent Pricing</h3>
            <p className="text-gray-400 text-sm">Start for free, scale as you grow</p>
          </div>

          <OwnerPlansSection billingCycle={billingCycle} setBillingCycle={setBillingCycle} />
        </div>
      </section>

      {/* ── Owner Request / Partner Form ── */}
      <section id="get-started" className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Building2 className="h-3.5 w-3.5" /> Get Started Today
            </div>
            <h2 className="text-3xl font-bold text-gray-900 font-display">List Your Study Hall on {appName}</h2>
            <p className="text-gray-500 mt-2">Fill in your details and we'll onboard you within 24 hours.</p>
          </div>
          <OwnerRequestForm />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 font-display">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <p className="text-sm font-semibold text-gray-900">{faq.q}</p>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-gray-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 px-4 bg-primary-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white font-display mb-3">Start managing your hall today</h2>
          <p className="text-primary-200 mb-7">Join 100+ study halls already using {appName}.</p>
          <button
            onClick={() => scrollTo('get-started')}
            className="px-8 py-3.5 bg-white text-primary-700 font-bold rounded-xl hover:bg-primary-50 transition-colors text-sm"
          >
            Get Started — List Your Hall →
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-400 py-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary-600 flex items-center justify-center">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <span className="text-white font-bold font-display">{appName}</span>
            </div>
            <div className="flex gap-6 text-sm">
              {['Privacy Policy', 'Terms of Service', 'Contact'].map((item) => (
                <a key={item} href="#" className="hover:text-white transition-colors">{item}</a>
              ))}
            </div>
            <p className="text-sm">
              Built by <span className="text-white font-semibold">NayakWorks</span> © 2024
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
