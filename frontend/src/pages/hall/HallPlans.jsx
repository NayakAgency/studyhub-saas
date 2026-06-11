import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import { Check } from 'lucide-react';

export default function HallPlans() {
  const { slug } = useParams();

  const { data: hall } = useQuery({ queryKey: ['public', 'hall', slug], queryFn: () => api.get(`/public/${slug}`).then((r) => r.data) });
  const { data: plans, isLoading } = useQuery({ queryKey: ['public', 'plans', slug], queryFn: () => api.get(`/public/${slug}/plans`).then((r) => r.data) });

  const themeColor = hall?.tenant?.theme_color || '#2563EB';
  const typeFeatures = { full_day: ['Unlimited hours', 'Any available seat', 'Full day access'], slot_based: ['Fixed time slots', 'Choose your slot', 'Guaranteed seat'], open_hours: ['Pay per visit', 'Flexible schedule', 'Walk-in access'] };

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Membership Plans</h1>
        <p className="text-gray-500 mt-2">Choose a plan that fits your study schedule</p>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{[1,2,3].map((i) => <div key={i} className="h-64 rounded-2xl skeleton" />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(plans || []).map((plan) => (
            <div key={plan.id} className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:shadow-card-hover transition-all flex flex-col">
              <p className="text-lg font-bold text-gray-900">{plan.plan_name}</p>
              <p className="text-xs text-gray-500 mb-4 capitalize">{plan.plan_type?.replace('_', ' ')} · {plan.validity_type}</p>
              <p className="text-4xl font-bold font-display mb-1" style={{ color: themeColor }}>₹{plan.price}</p>
              <p className="text-xs text-gray-400 mb-6">/{plan.validity_type}</p>
              {plan.description && <p className="text-sm text-gray-600 mb-4">{plan.description}</p>}
              <ul className="space-y-2 mb-6 flex-1">
                {(typeFeatures[plan.plan_type] || []).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <Check className="h-4 w-4 flex-shrink-0" style={{ color: themeColor }} />{f}
                  </li>
                ))}
              </ul>
              <Link to={`/${slug}/register`}>
                <Button className="w-full" style={{ backgroundColor: themeColor }}>Book This Plan</Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
