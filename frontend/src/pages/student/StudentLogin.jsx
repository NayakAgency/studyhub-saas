import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import useAuthStore from '../../store/authStore.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Phone, Lock, GraduationCap } from 'lucide-react';

const schema = z.object({
  phone: z.string().min(10, 'Valid phone number required'),
  password: z.string().min(1, 'Password required'),
});

export default function StudentLogin() {
  const { slug } = useParams();
  const { loginStudent, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const { data: hall } = useQuery({
    queryKey: ['public', 'hall', slug],
    queryFn: () => api.get(`/public/${slug}`).then((r) => r.data),
  });

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    try {
      await loginStudent(data.phone, data.password, slug);
      navigate(`/${slug}/dashboard`);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Login failed');
    }
  };

  const hallName = hall?.tenant?.hall_name;
  const themeColor = hall?.tenant?.theme_color || '#2563EB';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-modal border border-gray-200 overflow-hidden">
          <div className="px-8 py-8 text-center" style={{ backgroundColor: themeColor }}>
            {hall?.tenant?.logo_url
              ? <img src={hall.tenant.logo_url} alt={hallName} className="h-14 w-14 rounded-xl object-contain mx-auto mb-3 bg-white p-1" />
              : <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center mx-auto mb-3"><GraduationCap className="h-7 w-7 text-white" /></div>
            }
            <h1 className="text-xl font-bold text-white font-display">{hallName || 'Study Hall'}</h1>
            <p className="text-sm text-white/80 mt-0.5">Student Portal</p>
          </div>

          <div className="px-8 py-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Phone Number"
                type="tel"
                placeholder="Enter your phone number"
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
              <Button type="submit" className="w-full" size="lg" loading={isLoading}>Sign In</Button>
            </form>

            <div className="mt-5 text-center space-y-2">
              <p className="text-sm text-gray-600">
                New here?{' '}
                <Link to={`/${slug}/register`} className="text-primary-600 font-medium hover:underline">Register your seat</Link>
              </p>
              <Link to={`/${slug}`} className="text-xs text-gray-400 hover:text-gray-600 block">← Back to hall website</Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
