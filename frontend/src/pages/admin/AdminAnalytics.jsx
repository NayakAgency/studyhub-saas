// ============================================================
// Admin Analytics Page
// Occupancy predictions, revenue forecast, churn risk, recommendations
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, AlertTriangle,
  Lightbulb, RefreshCw, ChevronRight, Target, Zap,
} from 'lucide-react';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { formatCurrency, formatDate, cn } from '../../lib/utils.js';

// ── Sub-components ──────────────────────────────────────────

function InsightCard({ icon: Icon, iconBg, iconColor, title, value, trend, trendLabel, loading }) {
  if (loading) return <Skeleton className="h-24 rounded-xl" />;
  const up = trend >= 0;
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500">{title}</p>
        <p className="text-xl font-bold text-gray-900 font-display">{value}</p>
      </div>
      {trend !== undefined && (
        <div className={cn('flex items-center gap-1 text-xs font-semibold',
          up ? 'text-emerald-600' : 'text-red-500')}>
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {Math.abs(trend).toFixed(1)}%
          {trendLabel && <span className="text-gray-400 font-normal ml-1">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }) {
  const priorityConfig = {
    critical: { dot: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50',    label: 'Critical' },
    high:     { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', label: 'High' },
    medium:   { dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50',  label: 'Medium' },
    low:      { dot: 'bg-blue-400',   text: 'text-blue-700',   bg: 'bg-blue-50',   label: 'Low' },
  };
  const p = priorityConfig[rec.priority] || priorityConfig.low;

  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-white space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0', p.bg, p.text)}>
          {p.label}
        </span>
      </div>
      <p className="text-xs text-gray-500">{rec.description}</p>
      {rec.actions?.length > 0 && (
        <ul className="space-y-1 pt-1">
          {rec.actions.map((action, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
              <ChevronRight className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
              {action}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChurnRiskRow({ student }) {
  const riskColor = student.risk_score >= 70 ? 'danger' : student.risk_score >= 40 ? 'warning' : 'success';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{student.student_name}</p>
        <p className="text-xs text-gray-400">
          {student.late_payments > 0 && `${student.late_payments} late payments · `}
          {student.days_since_last_login > 0 && `${student.days_since_last_login}d inactive`}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="flex items-center gap-1.5 justify-end">
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full', riskColor === 'danger' ? 'bg-red-500' : riskColor === 'warning' ? 'bg-amber-400' : 'bg-emerald-500')}
              style={{ width: `${student.risk_score}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-700 w-7 text-right">{student.risk_score}%</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">churn risk</p>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────

export default function AdminAnalytics() {
  const [occupancyDays, setOccupancyDays] = useState(30);
  const [revMonths, setRevMonths] = useState(6);

  const dashboardQ = useQuery({
    queryKey: ['admin', 'analytics', 'dashboard'],
    queryFn: () => api.get('/admin/analytics/dashboard').then(r => r.data.data),
    staleTime: 5 * 60 * 1000,
  });

  const occupancyQ = useQuery({
    queryKey: ['admin', 'analytics', 'occupancy', occupancyDays],
    queryFn: () => api.get('/admin/analytics/occupancy', { params: { days: occupancyDays } }).then(r => r.data.data),
    staleTime: 30 * 60 * 1000,
  });

  const revenueQ = useQuery({
    queryKey: ['admin', 'analytics', 'revenue', revMonths],
    queryFn: () => api.get('/admin/analytics/revenue', { params: { months: revMonths } }).then(r => r.data.data),
    staleTime: 30 * 60 * 1000,
  });

  const churnQ = useQuery({
    queryKey: ['admin', 'analytics', 'churn'],
    queryFn: () => api.get('/admin/analytics/churn').then(r => r.data.data),
    staleTime: 15 * 60 * 1000,
  });

  const d = dashboardQ.data;
  const isLoading = dashboardQ.isLoading;

  // Format occupancy chart data
  const occupancyChartData = (occupancyQ.data?.predictions || []).slice(0, 14).map(p => ({
    date: formatDate(p.date, 'dd MMM'),
    rate: parseFloat(p.predicted_occupancy_rate).toFixed(1),
    confidence: parseFloat((p.confidence * 100)).toFixed(0),
  }));

  // Format revenue chart data
  const revenueChartData = (revenueQ.data?.forecast || []).map(f => ({
    month: f.month,
    revenue: f.predicted_revenue,
    base: f.factors?.base,
    growth: f.factors?.growth,
  }));

  // Retention health score
  const healthScore = churnQ.data?.overall_health?.score ?? null;
  const healthLevel = churnQ.data?.overall_health?.level ?? 'unknown';
  const healthColor = { excellent: '#10B981', good: '#6EE7B7', fair: '#F59E0B', poor: '#EF4444' }[healthLevel] ?? '#9CA3AF';

  return (
    <div className="p-6 space-y-6 pb-20 md:pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Predictions, forecasts & actionable insights</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => {
            dashboardQ.refetch();
            occupancyQ.refetch();
            revenueQ.refetch();
            churnQ.refetch();
          }}
        >
          Refresh
        </Button>
      </div>

      {/* Overview insight cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InsightCard loading={isLoading} icon={TrendingUp} iconBg="bg-blue-50" iconColor="text-blue-600"
          title="Occupancy Trend"
          value={`${d?.overview?.occupancy_trend >= 0 ? '+' : ''}${d?.overview?.occupancy_trend?.toFixed(1) ?? '—'}%`}
          trend={d?.overview?.occupancy_trend}
          trendLabel="weekly" />
        <InsightCard loading={isLoading} icon={TrendingUp} iconBg="bg-emerald-50" iconColor="text-emerald-600"
          title="Revenue Growth"
          value={`${d?.overview?.revenue_growth >= 0 ? '+' : ''}${d?.overview?.revenue_growth?.toFixed(1) ?? '—'}%`}
          trend={d?.overview?.revenue_growth}
          trendLabel="monthly" />
        <InsightCard loading={isLoading} icon={Users} iconBg="bg-violet-50" iconColor="text-violet-600"
          title="Retention Health"
          value={`${d?.overview?.retention_health ?? '—'}/100`} />
        <InsightCard loading={isLoading} icon={Zap} iconBg="bg-amber-50" iconColor="text-amber-600"
          title="Optimization Score"
          value={`${d?.overview?.optimization_score ?? '—'} pts`} />
      </div>

      {/* Quick Insights */}
      {!isLoading && d?.quick_insights?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {d.quick_insights.map((insight, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'px-4 py-3 rounded-xl text-sm border',
                insight.status === 'positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                insight.status === 'negative' ? 'bg-red-50 border-red-200 text-red-800' :
                insight.status === 'warning'  ? 'bg-amber-50 border-amber-200 text-amber-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
              )}
            >
              {insight.message}
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Occupancy Prediction */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Occupancy Forecast (Next 14 Days)</h3>
            <div className="flex gap-1">
              {[14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setOccupancyDays(d)}
                  className={cn('px-2 py-0.5 text-xs rounded font-medium transition-colors',
                    occupancyDays === d ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100')}
                >{d}d</button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            {occupancyQ.isLoading
              ? <Skeleton className="h-48" />
              : occupancyChartData.length === 0
              ? <p className="text-sm text-gray-400 text-center py-12">Not enough historical data to forecast</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={occupancyChartData}>
                    <defs>
                      <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={2} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v, n) => [n === 'rate' ? `${v}%` : `${v}%`, n === 'rate' ? 'Predicted' : 'Confidence']} />
                    <Area type="monotone" dataKey="rate" stroke="#2563EB" strokeWidth={2} fill="url(#occGrad)" dot={false} />
                    <Line type="monotone" dataKey="confidence" stroke="#A5B4FC" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
            {occupancyQ.data?.trends && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Weekly change</p>
                  <p className={cn('text-sm font-bold', occupancyQ.data.trends.weeklyGrowth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {occupancyQ.data.trends.weeklyGrowth >= 0 ? '+' : ''}{occupancyQ.data.trends.weeklyGrowth}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Confidence</p>
                  <p className="text-sm font-bold text-gray-700">
                    {Math.round((occupancyQ.data.confidence || 0) * 100)}%
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Revenue Forecast */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Revenue Forecast</h3>
            <div className="flex gap-1">
              {[3, 6, 12].map(m => (
                <button
                  key={m}
                  onClick={() => setRevMonths(m)}
                  className={cn('px-2 py-0.5 text-xs rounded font-medium transition-colors',
                    revMonths === m ? 'bg-primary-600 text-white' : 'text-gray-500 hover:bg-gray-100')}
                >{m}m</button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="pt-2">
            {revenueQ.isLoading
              ? <Skeleton className="h-48" />
              : revenueChartData.length === 0
              ? <p className="text-sm text-gray-400 text-center py-12">Not enough data to forecast revenue</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Predicted Revenue']} />
                    <Bar dataKey="revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
            {revenueQ.data?.trends && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Growth rate</p>
                  <p className={cn('text-sm font-bold', revenueQ.data.trends.growth >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                    {revenueQ.data.trends.growth >= 0 ? '+' : ''}{revenueQ.data.trends.growth}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Confidence</p>
                  <p className="text-sm font-bold text-gray-700">
                    {Math.round((revenueQ.data.trends.confidence || 0) * 100)}%
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Churn + Recommendations row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Churn Risk */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-800">Churn Risk Analysis</h3>
              {healthScore !== null && (
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full',
                  healthLevel === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                  healthLevel === 'good'      ? 'bg-green-100 text-green-700' :
                  healthLevel === 'fair'      ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                )}>
                  Health: {healthScore}/100
                </span>
              )}
            </div>
            {churnQ.data?.at_risk_students?.length > 0 && (
              <Badge variant="danger" size="sm">{churnQ.data.at_risk_students.length} at risk</Badge>
            )}
          </CardHeader>
          <CardBody className="pt-0">
            {churnQ.isLoading
              ? <Skeleton className="h-40" />
              : !churnQ.data?.at_risk_students?.length
              ? (
                <div className="text-center py-10">
                  <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Great retention!</p>
                  <p className="text-xs text-gray-400 mt-1">No students flagged at high risk</p>
                </div>
              )
              : (
                <div>
                  {churnQ.data.at_risk_students.slice(0, 6).map((s, i) => (
                    <ChurnRiskRow key={s.student_id || i} student={s} />
                  ))}
                  {churnQ.data.at_risk_students.length > 6 && (
                    <p className="text-xs text-gray-400 pt-2 text-center">
                      +{churnQ.data.at_risk_students.length - 6} more students at risk
                    </p>
                  )}
                </div>
              )
            }
          </CardBody>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-800">Recommendations</h3>
          </CardHeader>
          <CardBody className="pt-0 space-y-3">
            {isLoading
              ? [1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)
              : !d?.action_items?.length
              ? (
                <div className="text-center py-10">
                  <Target className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No critical actions needed right now</p>
                </div>
              )
              : d.action_items.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} />
              ))
            }
          </CardBody>
        </Card>
      </div>
    </div>
  );
}