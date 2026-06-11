import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../../lib/api.js';
import { StatCard } from '../../components/ui/Card.jsx';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { formatCurrency, formatDate } from '../../lib/utils.js';
import { Building2, Users, CreditCard, MessageSquare, Inbox, ChevronRight } from 'lucide-react';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6'];

export default function SuperAdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: () => api.get('/super-admin/dashboard').then((r) => r.data),
    refetchInterval: 120_000,
  });

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};
  const recentTenants = data?.recentTenants || [];
  const pendingRequests = data?.pendingRequests || [];
  const pendingRequestsCount = data?.pendingRequestsCount || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Platform Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">StudyHub SaaS — NayakWorks</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Study Halls',  value: kpis.totalHalls || 0,  icon: <Building2 className="h-5 w-5" />, iconBg: 'bg-blue-100',    iconColor: 'text-blue-600'    },
          { title: 'Active Students',    value: kpis.activeStudents?.toLocaleString() || 0, icon: <Users className="h-5 w-5" />, iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
          { title: 'Monthly Revenue',    value: formatCurrency(kpis.monthlyRevenue || 0), icon: <CreditCard className="h-5 w-5" />, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
          { title: 'Pending Requests',   value: pendingRequestsCount, icon: <Inbox className="h-5 w-5" />, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
        ].map((card, i) => <StatCard key={i} {...card} loading={isLoading} />)}
      </div>

      {/* Pending requests alert */}
      {pendingRequestsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {pendingRequestsCount} new hall owner request{pendingRequestsCount > 1 ? 's' : ''} pending
              </p>
              <p className="text-xs text-amber-700">Review and onboard interested study hall owners</p>
            </div>
          </div>
          <Link to="/super-admin/requests" className="flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-900 flex-shrink-0">
            View All <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Revenue (Last 12 Months)</h3></CardHeader>
          <CardBody className="pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={charts.revenue || []}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v/1000}k`} />
                <Tooltip formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, 'Revenue']} />
                <Area type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-gray-800">Plan Distribution</h3></CardHeader>
          <CardBody className="flex items-center justify-center pt-2">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={charts.planDistribution || []} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={70} label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}>
                  {(charts.planDistribution || []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Recent Study Halls</h3>
            <Link to="/super-admin/tenants" className="text-xs text-primary-600 hover:underline">View all</Link>
          </CardHeader>
          <div className="divide-y divide-gray-50">
            {recentTenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t.hall_name}</p>
                  <p className="text-xs text-gray-400">{t.city || '—'} · {formatDate(t.created_at)}</p>
                </div>
                <Link to={`/super-admin/tenants/${t.id}`} className="text-xs text-primary-600 hover:underline">View</Link>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">New Hall Requests</h3>
            <Link to="/super-admin/requests" className="text-xs text-primary-600 hover:underline">View all</Link>
          </CardHeader>
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No pending requests</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingRequests.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.hall_name}</p>
                    <p className="text-xs text-gray-400">{r.owner_name} · {r.city || '—'} · {r.plan_interest || 'standard'}</p>
                  </div>
                  <Badge variant="warning" size="sm">New</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* New Tenants chart */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-gray-800">New Study Halls (Monthly)</h3></CardHeader>
        <CardBody className="pt-2">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={charts.newTenants || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563EB" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  );
}
