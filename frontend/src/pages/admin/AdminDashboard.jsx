import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Users, Armchair, CreditCard, AlertCircle,
  RefreshCw, Clock, CheckCircle, Bell, X, Wifi, WifiOff
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/ui/Card.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Badge, MembershipStatusBadge } from '../../components/ui/Badge.jsx';
import { formatCurrency, formatDate, daysRemaining } from '../../lib/utils.js';
import Button from '../../components/ui/Button.jsx';
import { useState } from 'react';
import { useAdminWebSocket, useWsStatus } from '../../lib/hooks/useWebSocket.js';

const CHART_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AdminDashboard() {
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState([]);

  // Real-time updates via WebSocket
  useAdminWebSocket();
  const wsStatus = useWsStatus();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => api.get('/admin/dashboard/stats').then((r) => r.data),
    refetchInterval: 120_000,
  });

  const { data: platformAnnouncements } = useQuery({
    queryKey: ['admin', 'platform-announcements'],
    queryFn: () => api.get('/admin/dashboard/platform-announcements').then((r) => r.data),
  });

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const recentPayments = data?.recentPayments || [];
  const expiringMemberships = data?.expiringMemberships || [];

  const visibleAnnouncements = (platformAnnouncements || []).filter(
    (a) => !dismissedAnnouncements.includes(a.id)
  );

  const announcementStyle = { info: 'bg-blue-50 border-blue-200 text-blue-800', warning: 'bg-amber-50 border-amber-200 text-amber-800', maintenance: 'bg-red-50 border-red-200 text-red-800', update: 'bg-purple-50 border-purple-200 text-purple-800' };

  return (
    <div className="p-6 space-y-6 pb-20 md:pb-6">
      {/* Platform Announcements Banner */}
      {visibleAnnouncements.map((ann) => (
        <div key={ann.id} className={`flex items-start gap-3 p-4 rounded-xl border ${announcementStyle[ann.type] || announcementStyle.info}`}>
          <Bell className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{ann.title}</p>
            <p className="text-sm mt-0.5 opacity-80">{ann.content}</p>
          </div>
          <button onClick={() => setDismissedAnnouncements((d) => [...d, ann.id])} className="opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back — here's what's happening</p>
        </div>
        <div className="flex items-center gap-2">
          {/* WebSocket live indicator */}
          <span title={wsStatus === 'open' ? 'Live updates active' : 'Connecting...'} className="flex items-center gap-1 text-xs text-gray-400">
            {wsStatus === 'open'
              ? <Wifi className="h-3.5 w-3.5 text-emerald-500" />
              : <WifiOff className="h-3.5 w-3.5 text-gray-400" />}
            <span className="hidden sm:inline">{wsStatus === 'open' ? 'Live' : 'Offline'}</span>
          </span>
          <Link to="/admin/payments/record">
            <Button size="sm" leftIcon={<CreditCard className="h-4 w-4" />}>Record Payment</Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { title: 'Total Seats',         value: stats.totalSeats || 0,          icon: <Armchair className="h-5 w-5" />, iconBg: 'bg-blue-100',    iconColor: 'text-blue-600' },
          { title: 'Occupied',            value: stats.occupiedSeats || 0,        icon: <CheckCircle className="h-5 w-5" />, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
          { title: 'Vacant',              value: stats.availableSeats || 0,       icon: <Armchair className="h-5 w-5" />, iconBg: 'bg-gray-100',    iconColor: 'text-gray-600' },
          { title: 'Active Students',     value: stats.activeStudents || 0,       icon: <Users className="h-5 w-5" />,    iconBg: 'bg-violet-100',  iconColor: 'text-violet-600' },
          { title: 'Pending Applications',value: stats.pendingApplications || 0,  icon: <Clock className="h-5 w-5" />,    iconBg: 'bg-amber-100',   iconColor: 'text-amber-600' },
          { title: 'Renewals Due',        value: stats.renewalsDue || 0,          icon: <RefreshCw className="h-5 w-5" />, iconBg: 'bg-orange-100',  iconColor: 'text-orange-600' },
        ].map((card, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <StatCard {...card} loading={isLoading} />
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue AreaChart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-800">Revenue (Last 6 Months)</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={charts.revenue || []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={2} fill="url(#revenueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Section Occupancy BarChart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-800">Section Occupancy</h3>
          </CardHeader>
          <CardBody className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.sectionOccupancy || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="occupied" name="Occupied" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" name="Available" fill="#D1FAE5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Bottom tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring memberships */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Expiring Soon (7 days)</h3>
            <Link to="/admin/renewals" className="text-xs text-primary-600 hover:underline">View all</Link>
          </CardHeader>
          <div className="divide-y divide-gray-50">
            {expiringMemberships.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No memberships expiring soon</p>
            ) : expiringMemberships.slice(0, 5).map((m) => {
              const days = daysRemaining(m.end_date);
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.student?.full_name}</p>
                    <p className="text-xs text-gray-500">{m.seat?.seat_number} · {m.plan?.plan_name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={days <= 1 ? 'danger' : days <= 3 ? 'warning' : 'orange'} size="sm">
                      {days}d left
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent payments */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Recent Payments</h3>
            <Link to="/admin/fees" className="text-xs text-primary-600 hover:underline">View all</Link>
          </CardHeader>
          <div className="divide-y divide-gray-50">
            {recentPayments.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No payments recorded yet</p>
            ) : recentPayments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{p.student?.full_name}</p>
                  <p className="text-xs text-gray-500">{formatDate(p.payment_date)} · {p.payment_method?.toUpperCase()}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{formatCurrency(p.amount)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
