// ============================================================
// Unified Login Page — /login
// Tabs: Admin Login | Student Login
// Auto-routes each role to their exact registered portal.
// ============================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { GraduationCap, Mail, Lock, Phone, Building2, Shield, ArrowLeft } from 'lucide-react';

// ── Schemas ───────────────────────────────────────────────────
const adminSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const studentSchema = z.object({
  phone: z.string().min(10, 'Enter a valid phone number'),
  hallSlug: z.string().min(1, 'Study hall slug is required'),
  password: z.string().min(1, 'Password is required'),
});

// ── Admin Login Form ──────────────────────────────────────────
function AdminLoginForm() {
  const { loginAdmin, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(adminSchema),
  });

  const onSubmit = async (data) => {
    try {
      const result = await loginAdmin(data.email, data.password);
      const { role } = result.user;

      if (role === 'super_admin') {
        navigate('/super-admin/dashboard', { replace: true });
        toast.success('Welcome back, Super Admin!');
      } else if (role === 'hall_admin') {
        navigate('/admin/dashboard', { replace: true });
        toast.success(`Welcome back, ${result.user.fullName || 'Admin'}!`);
      } else {
        // Student tried to log in via admin form — clear and show error
        useAuthStore.getState().clearAuth();
        toast.error('No admin account found for these credentials. Are you a student? Use the Student Login tab.');
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Login failed. Check your credentials.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Email Address"
        type="email"
        placeholder="admin@yourhall.com"
        leftIcon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        autoComplete="email"
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        leftIcon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        autoComplete="current-password"
        {...register('password')}
      />
      <Button type="submit" className="w-full" size="lg" loading={isLoading}>
        Sign In as Admin
      </Button>
      <p className="text-xs text-center text-gray-400 pt-1">
        Super Admins and Hall Admins share this login.
        You will be taken to your exact portal automatically.
      </p>
    </form>
  );
}

// ── Student Login Form ────────────────────────────────────────
function StudentLoginForm() {
  const { loginStudent, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(studentSchema),
  });

  const onSubmit = async (data) => {
    const slug = data.hallSlug.trim().toLowerCase();
    try {
      await loginStudent(data.phone, data.password, slug);
      navigate(`/${slug}/dashboard`, { replace: true });
      toast.success('Welcome back!');
    } catch (err) {
      const msg = err?.response?.data?.error || err.message || '';
      if (msg.includes('not found') || msg.includes('Study hall')) {
        toast.error(`Study hall "${slug}" not found. Check the hall ID and try again.`);
      } else if (msg.includes('Invalid phone') || msg.includes('password')) {
        toast.error('Wrong phone number or password. Please try again.');
      } else {
        toast.error(msg || 'Login failed. Check your details.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Study Hall ID"
        type="text"
        placeholder="e.g. sri-ramana, sunrise-hall"
        leftIcon={<Building2 className="h-4 w-4" />}
        error={errors.hallSlug?.message}
        autoComplete="off"
        autoCapitalize="none"
        hint="The unique ID of your study hall (from your registration confirmation)"
        {...register('hallSlug')}
      />
      <Input
        label="Phone Number"
        type="tel"
        placeholder="Enter your registered phone"
        leftIcon={<Phone className="h-4 w-4" />}
        error={errors.phone?.message}
        autoComplete="tel"
        {...register('phone')}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        leftIcon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        autoComplete="current-password"
        {...register('password')}
      />
      <Button type="submit" className="w-full" size="lg" loading={isLoading}>
        Sign In as Student
      </Button>
      <p className="text-xs text-center text-gray-400 pt-1">
        You will be taken directly to your study hall's student portal.
      </p>
    </form>
  );
}

// ── Main Unified Login ────────────────────────────────────────
export default function UnifiedLogin() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('role') === 'student' ? 'student' : 'admin';
  const [tab, setTab] = useState(defaultTab);

  const tabs = [
    { id: 'admin',   label: 'Hall Admin',  icon: Shield },
    { id: 'student', label: 'Student',     icon: GraduationCap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 flex flex-col items-center justify-center p-4">

      {/* Back to home */}
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors self-start max-w-md w-full mx-auto"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to StudyHub
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-8 py-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white font-display">StudyHub</h1>
            <p className="text-sm text-primary-200 mt-1">Sign in to your portal</p>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all
                  ${tab === id
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-white'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div className="px-8 py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, x: tab === 'admin' ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tab === 'admin' ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                {tab === 'admin' ? <AdminLoginForm /> : <StudentLoginForm />}
              </motion.div>
            </AnimatePresence>

            {/* Footer links */}
            <div className="mt-6 pt-5 border-t border-gray-100 space-y-2 text-center">
              {tab === 'student' && (
                <p className="text-sm text-gray-600">
                  New student?{' '}
                  <Link to="/" className="text-primary-600 font-medium hover:underline">
                    Browse halls & register
                  </Link>
                </p>
              )}
              <p className="text-xs text-gray-400">
                StudyHub · Built by NayakWorks
              </p>
            </div>
          </div>
        </div>

        {/* Helper cards below */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 text-center">
            <Shield className="h-5 w-5 text-primary-500 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-gray-700">Hall Admin?</p>
            <p className="text-xs text-gray-500 mt-0.5">Use the Admin tab with your registered email</p>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 text-center">
            <GraduationCap className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs font-semibold text-gray-700">Student?</p>
            <p className="text-xs text-gray-500 mt-0.5">Use the Student tab with your hall ID &amp; phone</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
