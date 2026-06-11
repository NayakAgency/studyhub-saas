// ============================================================
// Super Admin Analytics — Full platform-wide analytics
// Revenue MRR/ARR, tenant growth, plan distribution, top halls
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, Building2, Users, CreditCard, Activity,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody, StatCard } from '../../components/ui/Card.jsx';
import { formatCurrency } from '../../lib/utils.js';

const PIE_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'];

function DeltaBadge({ value }) {
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function SuperAdminAnalytics() {
  const [revPeriod, setRevPeriod] = useState(12);

  // Dashboard data (KPIs + charts)
  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: () => api.get('/super-admin/dashboard').then((r) => r.data),
    staleTime: 120_000,
  });

  // Per-hall student counts
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['super-admin', 'analytics'],
    queryFn: () => api.get('/super-admin/analytics').then((r) => r.data),
    staleTime: 120_000,
  });

  const kpis      = dash?.kpis      || {};
  const charts    = dash?.charts    || {};
  const revenueChart = (charts.revenue || []).slice(-revPeriod);
  const tenantChart  = charts.newTenants || [];
  const planDist     = charts.planDistribution || [];

  // Derived MRR / ARR from last month revenue
  const lastMonthRev = revenueChart[revenueChart.length - 1]?.amount || 0;
  const prevMonthRev = revenueChart[revenueChart.length - 2]?.amount || 0;
  const revenueGrowth = prevMonthRev > 0 ? ((lastMonthRev - prevMonthRev) / prevMonthRev) * 100 : 0;

  // Top halls by student count
  const topHalls = [...(analytics?.studentsPerHall || [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const isLoading = dashLoading || analyticsLoading;

  return (
    <div className="p-6 space-y-6 pb-20 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Platform Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Full platform-wide insights across all study halls</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Study Halls"
          value={kpis.totalHalls || 0}
          icon={<Building2 className="h-5 w-5" />}
          iconBg="bg-blue-100" iconColor="text-blue-600"
          loading={isLoading}
        />
        <StatCard
          title="Active Students"
          value={(kpis.activeStudents || 0).toLocaleString()}
          icon={<Users className="h-5 w-5" />}
          iconBg="bg-violet-100" iconColor="text-violet-600"
          loading={isLoading}
        />
        <StatCard
          title="MRR"
          value={formatCurrency(lastMonthRev)}
          icon={<CreditCard className="h-5 w-5" />}
          iconBg="bg-emerald-100" iconColor="text-emerald-600"
          loading={isLoading}
        />
        <StatCard
          title="ARR (Est.)"
          value={formatCurrency(lastMonthRev * 12)}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBg="bg-amber-100" iconColor="text-amber-600"
          loading={isLoading}
        />
      </div>

      {/* Revenue + Tenant Growth charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue area chart */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Platform Revenue</h3>
              {!isLoading && revenueGrowth !== 0 && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <DeltaBadge value={revenueGrowth} />
                  <span className="text-xs text-gray-400">vs last month</span>
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {[6, 12].map((m) => (
                <button key={m} onClick={() => setRevPeriod(m)}
                  className={`px-2 py-0.5 text-xs rounded font-medium transition-colors
                    ${revPeriod === m ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {m}m
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            {isLoading ? <div className="h-52 skeleton rounded" /> : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={revenueChart}>
                  <defs>
                    <linearGradient id="saRevGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
                  <Area type="monotone" dataKey="amount" stroke="#2563EB" strokeWidth={2}
                    fill="url(#saRevGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* New tenants bar chart */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-800">New Study Halls per Month</h3>
          </CardHeader>
          <CardBody className="pt-2">
            {isLoading ? <div className="h-52 skeleton rounded" /> : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={tenantChart.slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="New Halls" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Plan Distribution + Top Halls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan distribution pie */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-800">Plan Distribution</h3>
          </CardHeader>
          <CardBody className="flex flex-col items-center pt-2">
            {isLoading ? <div className="h-52 skeleton rounded w-full" /> : planDist.length === 0
              ? <p className="text-sm text-gray-400 py-16">No data</p>
              : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={planDist} dataKey="count" nameKey="plan"
                        cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                        label={({ plan, percent }) => `${plan} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {planDist.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {planDist.map((item, i) => (
                      <div key={item.plan} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize">{item.plan}</span>
                        <span className="font-semibold text-gray-800">({item.count})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </CardBody>
        </Card>

        {/* Top halls by students */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-gray-800">Top Halls by Active Students</h3>
          </CardHeader>
          <CardBody className="pt-2">
            {isLoading ? <div className="h-52 skeleton rounded" /> : topHalls.length === 0
              ? <p className="text-sm text-gray-400 py-16 text-center">No data</p>
              : (
                <ResponsiveContainer width="100%" height={210}>
                  <BarChart data={topHalls} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="hallName" tick={{ fontSize: 10 }} tickLine={false}
                      axisLine={false} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" name="Students" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </CardBody>
        </Card>
      </div>

      {/* Hall status breakdown */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-800">Platform Overview</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Active Halls',   value: kpis.activeHalls   || 0, color: 'text-emerald-600' },
              { label: 'Total Halls',    value: kpis.totalHalls    || 0, color: 'text-blue-600'    },
              { label: 'Total Students', value: kpis.totalStudents || 0, color: 'text-violet-600'  },
              { label: 'Total Revenue',  value: formatCurrency(kpis.totalRevenue || 0), color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-4 bg-gray-50 rounded-xl">
                <p className={`text-2xl font-bold font-display ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
