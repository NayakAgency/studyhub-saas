import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { GraduationCap, Phone, Mail, MapPin } from 'lucide-react';

export default function HallAbout() {
  const { slug } = useParams();
  const { data: hall } = useQuery({ queryKey: ['public', 'hall', slug], queryFn: () => api.get(`/public/${slug}`).then((r) => r.data) });
  const tenant = hall?.tenant;
  const themeColor = tenant?.theme_color || '#2563EB';

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">About Us</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
        <div>
          <div className="h-20 w-20 rounded-2xl mb-6 flex items-center justify-center" style={{ backgroundColor: themeColor }}>
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={tenant.hall_name} className="h-full w-full rounded-2xl object-contain p-2 bg-white" />
              : <GraduationCap className="h-10 w-10 text-white" />
            }
          </div>
          <h2 className="text-2xl font-bold text-gray-900 font-display mb-3">{tenant?.hall_name}</h2>
          <p className="text-gray-600 leading-relaxed">
            We are dedicated to providing a productive study environment for students of all backgrounds. Our facility is designed to help you focus and achieve your academic goals.
          </p>
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>
          {[
            tenant?.owner_phone && { icon: Phone, value: tenant.owner_phone },
            tenant?.owner_email && { icon: Mail, value: tenant.owner_email },
            tenant?.address && { icon: MapPin, value: `${tenant.address}${tenant.city ? ', ' + tenant.city : ''}` },
          ].filter(Boolean).map(({ icon: Icon, value }) => (
            <div key={value} className="flex items-center gap-3 text-sm text-gray-700">
              <Icon className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
