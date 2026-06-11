import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../../lib/api.js';
import { Card } from '../../components/ui/Card.jsx';
import { MembershipStatusBadge, Badge } from '../../components/ui/Badge.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import Button from '../../components/ui/Button.jsx';
import { formatDate, formatCurrency, daysRemaining } from '../../lib/utils.js';
import { Armchair, BookOpen, CreditCard, Bell, BadgeCheck, MessageSquare, ArrowRight, Library, RefreshCw } from 'lucide-react';
import { useStudentWebSocket } from '../../lib/hooks/useWebSocket.js';

const TYPE_COLORS = { general: 'default', holiday: 'success', maintenance: 'danger', fee_reminder: 'warning', urgent: 'danger' };

export default function StudentDashboard() {
  const { slug } = useParams();

  // Real-time updates: notifications, membership, seat changes
  useStudentWebSocket();

  const { data, isLoading } = useQuery({
    queryKey: ['student', 'dashboard'],
    queryFn: () => api.get('/student/dashboard').then((r) => r.data),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl skeleton" />)}
      </div>
    );
  }

  const { student, activeMembership, daysRemaining: days, announcements, unreadNotifications } = data || {};
  const membershipPct = activeMembership
    ? Math.max(0, Math.min(100, (days / 30) * 100))
    : 0;

  return (
    <div className="p-5 space-y-5 max-w-2xl">
      {/* Welcome card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <Avatar src={student?.profile_photo_url} name={student?.full_name} size="lg" />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 font-display truncate">Hi, {student?.full_name?.split(' ')[0]}!</p>
              <p className="text-xs text-gray-500 font-mono">{student?.student_code}</p>
              <MembershipStatusBadge status={student?.status} />
            </div>
            {unreadNotifications > 0 && (
              <Link to={`/${slug}/notifications`} className="relative">
                <Bell className="h-6 w-6 text-gray-500" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              </Link>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Seat */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="p-4 text-center">
            <Armchair className="h-6 w-6 text-primary-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">MY SEAT</p>
            <p className="text-2xl font-bold text-gray-900 font-display mt-1">
              {student?.assigned_seat?.seat_number || '—'}
            </p>
            <p className="text-xs text-gray-400">{student?.assigned_seat?.section?.name || 'Not assigned'}</p>
          </Card>
        </motion.div>

        {/* Membership */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4">
            <BookOpen className="h-5 w-5 text-violet-500 mb-2" />
            <p className="text-xs text-gray-500 font-medium">MEMBERSHIP</p>
            {activeMembership ? (
              <>
                <p className="text-sm font-bold text-gray-900 mt-1 truncate">{activeMembership.plan?.plan_name}</p>
                <p className="text-xs text-gray-500">Exp: {formatDate(activeMembership.end_date)}</p>
                <div className="mt-2">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all"
                      style={{ width: `${membershipPct}%`, backgroundColor: days <= 7 ? '#EF4444' : '#10B981' }} />
                  </div>
                  <p className={`text-xs mt-1 font-semibold ${days <= 7 ? 'text-red-500' : 'text-gray-500'}`}>
                    {days > 0 ? `${days} days left` : 'Expired'}
                  </p>
                </div>
              </>
            ) : <p className="text-sm text-gray-400 mt-1">No active plan</p>}
          </Card>
        </motion.div>

        {/* Fee status */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4">
            <CreditCard className="h-5 w-5 text-emerald-500 mb-2" />
            <p className="text-xs text-gray-500 font-medium">FEE STATUS</p>
            <div className="mt-1">
              {activeMembership ? (
                <Badge variant={days > 0 ? 'success' : 'danger'} dot size="md">{days > 0 ? 'Paid' : 'Overdue'}</Badge>
              ) : <p className="text-sm text-gray-400">—</p>}
              <p className="text-xs text-gray-400 mt-1">{formatCurrency(activeMembership?.plan?.price)}</p>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Announcements */}
      {announcements?.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Announcements</p>
            <Link to={`/${slug}/notifications`} className="text-xs text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex items-start gap-3 px-4 py-3">
                <Badge variant={TYPE_COLORS[ann.type] || 'default'} size="sm" className="capitalize flex-shrink-0 mt-0.5">
                  {ann.type?.replace('_', ' ')}
                </Badge>
                <p className="text-sm text-gray-700">{ann.title}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: `/${slug}/id-card`, icon: BadgeCheck, label: 'My ID Card', color: 'bg-purple-50 text-purple-600' },
          { to: `/${slug}/seat`, icon: Armchair, label: 'Change Seat', color: 'bg-blue-50 text-blue-600' },
          { to: `/${slug}/complaints`, icon: MessageSquare, label: 'Submit Complaint', color: 'bg-orange-50 text-orange-600' },
          { to: `/${slug}/resources`, icon: Library, label: 'Study Resources', color: 'bg-emerald-50 text-emerald-600' },
        ].map(({ to, icon: Icon, label, color }) => (
          <Link key={to} to={to}>
            <Card interactive className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1">{label}</span>
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
