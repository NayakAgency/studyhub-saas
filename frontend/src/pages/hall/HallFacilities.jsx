import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { Wind, Wifi, Camera, Shield, BookOpen, Clock, Coffee, Zap, Lock, Printer } from 'lucide-react';

const FACILITIES = [
  { icon: Wind, title: 'Air Conditioning', desc: 'Fully air-conditioned study halls for maximum comfort' },
  { icon: Wifi, title: 'High-Speed WiFi', desc: 'Reliable, fast internet connection throughout the hall' },
  { icon: Camera, title: 'CCTV Security', desc: '24/7 surveillance for your safety and peace of mind' },
  { icon: Lock, title: 'Locker Storage', desc: 'Personal lockers to store your belongings safely' },
  { icon: Zap, title: 'Charging Points', desc: 'Individual power sockets at every seat' },
  { icon: Clock, title: 'Flexible Hours', desc: 'Extended operating hours to suit your schedule' },
  { icon: Coffee, title: 'Break Area', desc: 'Designated relaxation zone for short breaks' },
  { icon: Printer, title: 'Print & Scan', desc: 'Access to printing and scanning services' },
  { icon: Shield, title: 'Safe Environment', desc: 'Strict no-phone policy in study zones' },
];

export default function HallFacilities() {
  const { slug } = useParams();
  const { data: hall } = useQuery({ queryKey: ['public', 'hall', slug], queryFn: () => api.get(`/public/${slug}`).then((r) => r.data) });
  const themeColor = hall?.tenant?.theme_color || '#2563EB';

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Our Facilities</h1>
        <p className="text-gray-500 mt-2">Everything you need for a productive study session</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {FACILITIES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card hover:shadow-card-hover transition-all">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: themeColor + '20' }}>
              <Icon className="h-6 w-6" style={{ color: themeColor }} />
            </div>
            <p className="text-base font-semibold text-gray-900 mb-1">{title}</p>
            <p className="text-sm text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
