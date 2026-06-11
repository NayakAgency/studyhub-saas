import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Shield, Mail, Lock } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export default function SuperAdminLogin() {
  const { loginAdmin, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    try {
      const result = await loginAdmin(data.email, data.password);
      if (result.user.role !== 'super_admin') {
        toast.error('Not a super admin account');
        return;
      }
      navigate('/super-admin/dashboard');
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 px-8 py-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white font-display">StudyHub Admin</h1>
            <p className="text-sm text-primary-200 mt-1">Super Admin Console</p>
          </div>
          <div className="px-8 py-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input label="Email" type="email" placeholder="admin@studyhub.app" leftIcon={<Mail className="h-4 w-4" />}
                error={errors.email?.message} className="bg-gray-700 border-gray-600 text-white placeholder-gray-400" {...register('email')} />
              <Input label="Password" type="password" placeholder="Super admin password" leftIcon={<Lock className="h-4 w-4" />}
                error={errors.password?.message} className="bg-gray-700 border-gray-600 text-white" {...register('password')} />
              <Button type="submit" className="w-full bg-primary-600 hover:bg-primary-700" size="lg" loading={isLoading}>
                Sign In
              </Button>
            </form>
            <p className="text-center text-xs text-gray-500 mt-6">StudyHub v1.0 · NayakWorks</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
