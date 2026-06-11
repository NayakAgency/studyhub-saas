import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { MapPin, Clock, Phone, Wifi, Wind, Camera, Shield, BookOpen } from 'lucide-react';

const AMENITIES = [
  { icon: Wind, label: 'Air Conditioned' },
  { icon: Wifi, label: 'High-Speed WiFi' },
  { icon: Camera, label: 'CCTV Security' },
  { icon: Shield, label: 'Safe & Clean' },
  { icon: BookOpen, label: 'Study Materials' },
  { icon: Clock, label: 'Flexible Timings' },
];

export default function HallHome() {
  const { slug } = useParams();

  const { data: hall } = useQuery({
    queryKey: ['public', 'hall', slug],
    queryFn: () => api.get(`/public/${slug}`).then((r) => r.data),
  });

  const { data: plans } = useQuery({
    queryKey: ['public', 'plans', slug],
    queryFn: () => api.get(`/public/${slug}/plans`).then((r) => r.data),
  });

  const tenant = hall?.tenant;
  const settings = hall?.settings;
  const themeColor = tenant?.theme_color || '#2563EB';

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-4" style={{ background: `linear-gradient(135deg, ${themeColor}15 0%, ${themeColor}30 100%)` }}>
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 font-display mb-4">
              {tenant?.hall_name || 'Study Hall'}
            </h1>
            <p className="text-lg text-gray-600 mb-3">
              Your perfect study destination — quiet, focused, and productive
            </p>
            {tenant?.address && (
              <p className="flex items-center justify-center gap-1.5 text-gray-500 text-sm mb-2">
                <MapPin className="h-4 w-4" />{tenant.address}
              </p>
            )}
            {settings?.hall_open_time && (
              <p className="flex items-center justify-center gap-1.5 text-gray-500 text-sm mb-8">
                <Clock className="h-4 w-4" />Open {settings.hall_open_time} – {settings.hall_close_time}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to={`/${slug}/register`}>
                <Button size="lg" style={{ backgroundColor: themeColor }}>Book Your Seat →</Button>
              </Link>
              <Link to={`/${slug}/plans`}>
                <Button size="lg" variant="secondary">View Plans</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Amenities */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 font-display text-center mb-10">Why Choose Us</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {AMENITIES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: themeColor + '20' }}>
                  <Icon className="h-6 w-6" style={{ color: themeColor }} />
                </div>
                <p className="text-sm font-medium text-gray-700">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans preview */}
      {plans?.length > 0 && (
        <section className="py-16 px-4 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 font-display text-center mb-3">Membership Plans</h2>
            <p className="text-gray-500 text-center mb-10">Choose the plan that works best for you</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.slice(0, 3).map((plan) => (
                <div key={plan.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card hover:shadow-card-hover transition-all text-center">
                  <p className="text-base font-bold text-gray-900 mb-1">{plan.plan_name}</p>
                  <p className="text-sm text-gray-500 mb-4 capitalize">{plan.plan_type?.replace('_', ' ')} · {plan.validity_type}</p>
                  <p className="text-3xl font-bold font-display mb-4" style={{ color: themeColor }}>₹{plan.price}</p>
                  <Link to={`/${slug}/register`}>
                    <Button size="sm" className="w-full" style={{ backgroundColor: themeColor }}>Book Now</Button>
                  </Link>
                </div>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link to={`/${slug}/plans`} className="text-sm font-medium hover:underline" style={{ color: themeColor }}>View all plans →</Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-4" style={{ backgroundColor: themeColor }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white font-display mb-3">Ready to start?</h2>
          <p className="text-white/80 mb-6">Join {tenant?.hall_name} and level up your study game.</p>
          <Link to={`/${slug}/register`}>
            <Button size="lg" className="bg-white font-semibold" style={{ color: themeColor }}>
              Register Now — It's Easy
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
