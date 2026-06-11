import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { SEAT_STATUS, cn } from '../../lib/utils.js';

export default function HallSeats() {
  const { slug } = useParams();

  const { data: hall } = useQuery({ queryKey: ['public', 'hall', slug], queryFn: () => api.get(`/public/${slug}`).then((r) => r.data) });
  const { data: seatsData, isLoading } = useQuery({
    queryKey: ['public', 'seats', slug],
    queryFn: () => api.get(`/public/${slug}/seats`).then((r) => r.data),
    refetchInterval: 30_000, // refresh every 30s for live availability
  });

  const themeColor = hall?.tenant?.theme_color || '#2563EB';

  if (seatsData?.message) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">{seatsData.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 font-display">Live Seat Availability</h1>
        <p className="text-gray-500 mt-2">Real-time seat map — updated every 30 seconds</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {[
          { color: 'bg-emerald-100 border-emerald-300', label: 'Available' },
          { color: 'bg-amber-100 border-amber-300',     label: 'Pending Application' },
          { color: 'bg-blue-100 border-blue-300',       label: 'Occupied' },
          { color: 'bg-gray-100 border-gray-300',       label: 'Blocked' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-sm">
            <div className={cn('h-4 w-4 rounded border-2', color)} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-6">{[1,2].map((i) => <div key={i} className="h-40 rounded-2xl skeleton" />)}</div>
      ) : (
        <div className="space-y-6">
          {(seatsData?.sections || []).map((section) => {
            const total     = section.seats?.length || 0;
            const available = section.seats?.filter((s) => s.status === 'available').length || 0;
            const pending   = section.seats?.filter((s) => s.status === 'reserved').length || 0;
            return (
              <div key={section.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: section.color_code }} />
                    <h3 className="text-base font-bold text-gray-800">{section.name}</h3>
                  </div>
                  <div className="text-sm flex items-center gap-2">
                    <span className="text-emerald-600 font-semibold">{available} available</span>
                    {pending > 0 && <span className="text-amber-500 font-semibold">{pending} pending</span>}
                    <span className="text-gray-400">/ {total} total</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div className="h-2 rounded-full" style={{ width: `${total ? ((total - available) / total) * 100 : 0}%`, backgroundColor: section.color_code || themeColor }} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(section.seats || []).sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true })).map((seat) => {
                    if (seat.status === 'available') {
                      return (
                        <Link key={seat.id} to={`/${slug}/register`} title="Book this seat">
                          <div className="h-9 min-w-[44px] px-1.5 rounded-lg border-2 border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer">
                            {seat.seat_number}
                          </div>
                        </Link>
                      );
                    }
                    if (seat.status === 'reserved') {
                      return (
                        <div key={seat.id} title="Pending application" className="h-9 min-w-[44px] px-1.5 rounded-lg border-2 border-amber-300 bg-amber-50 text-xs font-semibold text-amber-600 flex items-center justify-center cursor-not-allowed">
                          {seat.seat_number}
                        </div>
                      );
                    }
                    return (
                      <div key={seat.id} title={seat.status} className="h-9 min-w-[44px] px-1.5 rounded-lg border-2 border-gray-200 bg-gray-100 text-xs font-semibold text-gray-400 flex items-center justify-center cursor-not-allowed">
                        {seat.seat_number}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 text-center">
        <p className="text-gray-500 text-sm mb-3">See an available seat? Book it now.</p>
        <Link to={`/${slug}/register`}>
          <button className="px-6 py-2.5 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity" style={{ backgroundColor: themeColor }}>
            Register &amp; Book a Seat →
          </button>
        </Link>
      </div>
    </div>
  );
}
