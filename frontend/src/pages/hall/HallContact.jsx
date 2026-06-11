import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { api } from '../../lib/api.js';
import Input, { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Phone, Mail, MapPin, Send, CheckCircle } from 'lucide-react';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2, 'Name required'),
  phone: z.string().min(10, 'Valid phone required'),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().min(10, 'Please write a message'),
});

export default function HallContact() {
  const { slug } = useParams();
  const [sent, setSent] = useState(false);

  const { data: hall } = useQuery({ queryKey: ['public', 'hall', slug], queryFn: () => api.get(`/public/${slug}`).then((r) => r.data) });
  const tenant = hall?.tenant;
  const themeColor = tenant?.theme_color || '#2563EB';

  const { register, handleSubmit, formState: { errors }, reset } = useForm({ resolver: zodResolver(schema) });

  const sendMutation = useMutation({
    mutationFn: (body) => api.post(`/public/${slug}/contact`, body),
    onSuccess: () => { setSent(true); reset(); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Failed to send'),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Contact Us</h1>
        <p className="text-gray-500 mt-2">We'd love to hear from you</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact info */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Get In Touch</h2>
          {[
            tenant?.owner_phone && { icon: Phone, label: 'Phone', value: tenant.owner_phone },
            tenant?.owner_email && { icon: Mail, label: 'Email', value: tenant.owner_email },
            tenant?.address && { icon: MapPin, label: 'Address', value: tenant.address },
          ].filter(Boolean).map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex gap-4">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeColor + '20' }}>
                <Icon className="h-5 w-5" style={{ color: themeColor }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase">{label}</p>
                <p className="text-sm text-gray-800 mt-0.5">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="bg-gray-50 rounded-2xl p-6">
          {sent ? (
            <div className="flex flex-col items-center text-center py-8 space-y-3">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <h3 className="text-lg font-bold text-gray-900">Message Sent!</h3>
              <p className="text-sm text-gray-500">We'll get back to you soon.</p>
              <Button variant="secondary" size="sm" onClick={() => setSent(false)}>Send Another</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => sendMutation.mutate(d))} className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900">Send a Message</h3>
              <Input label="Your Name" required placeholder="Full name" error={errors.name?.message} {...register('name')} />
              <Input label="Phone" required placeholder="Mobile number" error={errors.phone?.message} {...register('phone')} />
              <Input label="Email (optional)" placeholder="your@email.com" {...register('email')} />
              <Textarea label="Message" required rows={4} placeholder="How can we help you?" error={errors.message?.message} {...register('message')} />
              <Button type="submit" className="w-full" loading={sendMutation.isPending} style={{ backgroundColor: themeColor }}
                leftIcon={<Send className="h-4 w-4" />}>
                Send Message
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
