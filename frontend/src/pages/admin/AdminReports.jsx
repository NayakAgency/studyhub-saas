// ============================================================
// Admin Reports — Revenue, Students, Seats, Fee Pending
// All tabs respect date range · revenue tab has bar chart
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Tabs } from '../../components/ui/Tabs.jsx';
import { formatCurrency, formatDate, downloadCSV } from '../../lib/utils.js';
import { Download, Users, CreditCard, BarChart3, Clock, AlertCircle } from 'lucide-react';

const PIE_COLORS = ['#2563EB', '#10B981'];

const TABS = [
  { value: 'revenue',  label: 'Revenue'       },
  { value: 'students', label: 'Students'      },
  { value: 'seats',    label: 'Seat Occupancy'},
  { value: 'fees',     label: 'Fee Pending'   },
];

export default function AdminReports() {
  const [tab,  setTab]  = useState('revenue');
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');

  // Revenue report
  const { data: revenue, isLoading: revLoading } = useQuery({
    queryKey: ['admin', 'reports', 'revenue', from, to],
    queryFn: () => api.get('/admin/reports/revenue', {
      params: { ...(from && { from }), ...(to && { to }) },
    }).then((r) => r.data),
    enabled: tab === 'revenue',
  });

  // Students report
  const { data: students, isLoading: stuLoading } = useQuery({
    queryKey: ['admin', 'reports', 'students', from, to],
    queryFn: () => api.get('/admin/reports/students', {
      params: { ...(from && { from }), ...(to && { to }) },
    }).then((r) => r.data),
    enabled: tab === 'students',
  });

  // Seats report
  const { data: seats, isLoading: seatsLoading } = useQuery({
    queryKey: ['admin', 'reports', 'seats'],
    queryFn: () => api.get('/admin/reports/seats').then((r) => r.data),
    enabled: tab === 'seats',
  });

  // Fee pending report
  const { data: feePending, isLoading: feeLoading } = useQuery({
    queryKey: ['admin', 'reports', 'fee-pending', from, to],
    queryFn: () => api.get('/admin/reports/fee-pending', {
      params: { ...(from && { from }), ...(to && { to }) },
    }).then((r) => r.data),
    enabled: tab === 'fees',
  });

  const isLoading = revLoading || stuLoading || seatsLoading || feeLoading;

  // Revenue chart — daily totals grouped by month
  const revenueChartData = (() => {
    const byMonth = {};
    (revenue?.data || []).forEach((p) => {
      const m = p.payment_date?.substring(0, 7);
      if (!m) return;
      if (!byMonth[m]) byMonth[m] = { month: m, amount: 0, count: 0 };
      byMonth[m].amount += parseFloat(p.amount || 0);
      byMonth[m].count++;
    });
    return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
  })();

  // Seat pie data
  const seatsPieData = (() => {
    let occupied = 0, available = 0;
    (seats || []).forEach((sec) => {
      (sec.seats || []).forEach((s) => {
        if (s.status === 'occupied') occupied++;
        else if (s.status === 'available') available++;
      });
    });
    return [
      { name: 'Occupied',  value: occupied  },
      { name: 'Available', value: available },
    ];
  })();

  const handleExport = async () => {
    try {
      const res = await api.get(`/admin/reports/${tab}`, {
        params: {
          format: 'csv',
          ...(from && { from }),
          ...(to   && { to   }),
        },
        responseType: 'text',
      });
      downloadCSV(res.data, `${tab}-report-${Date.now()}.csv`);
    } catch {
      // Fallback: build CSV client-side from current data
      let csv = '';
      if (tab === 'revenue' && revenue?.data) {
        csv = ['Receipt,Student,Code,Amount,Method,Date',
          ...(revenue.data.map((p) =>
            `${p.receipt_number},"${p.student?.full_name}",${p.student?.student_code},${p.amount},${p.payment_method},${p.payment_date}`
          ))].join('\n');
      } else if (tab === 'students' && students) {
        csv = ['Code,Name,Phone,Seat,Plan,Status,Expiry',
          ...students.map((s) => {
            const m = s.memberships?.[0];
            return `${s.student_code},"${s.full_name}",${s.phone},${s.assigned_seat?.seat_number || ''},${m?.plan?.plan_name || ''},${s.status},${m?.end_date || ''}`;
          })].join('\n');
      } else if (tab === 'fees' && feePending) {
        csv = ['Code,Name,Phone,Seat,Plan,Amount,Expired',
          ...feePending.map((i) =>
            `${i.student?.student_code},"${i.student?.full_name}",${i.student?.phone},${i.seat?.seat_number || ''},${i.plan?.plan_name || ''},${i.plan?.price || ''},${i.end_date}`
          )].join('\n');
      }
      if (csv) downloadCSV(csv, `${tab}-report.csv`);
    }
  };

  return (
    <div className="p-6 space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate and export data reports</p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleExport}>
          Export CSV
        </Button>
      </div>

      {/* Date range filter */}
      <Card>
        <CardBody className="flex flex-col sm:flex-row gap-3 items-end">
          <Input label="From Date" type="date" value={from}
            onChange={(e) => setFrom(e.target.value)} containerClassName="flex-1" />
          <Input label="To Date"   type="date" value={to}
            onChange={(e) => setTo(e.target.value)}   containerClassName="flex-1" />
          {(from || to) && (
            <Button variant="ghost" size="md" onClick={() => { setFrom(''); setTo(''); }}>
              Clear
            </Button>
          )}
        </CardBody>
      </Card>

      {/* Tab bar */}
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── REVENUE ─────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="space-y-4">
          {/* Summary stats */}
          {revenue && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Collected', value: formatCurrency(revenue.summary?.total   || 0), color: 'text-emerald-600' },
                { label: 'Cash',            value: formatCurrency(revenue.summary?.cash    || 0), color: 'text-gray-800'    },
                { label: 'UPI',             value: formatCurrency(revenue.summary?.upi     || 0), color: 'text-blue-600'    },
                { label: 'Transactions',    value: revenue.summary?.count || 0,                   color: 'text-gray-800'    },
              ].map(({ label, value, color }) => (
                <Card key={label} className="p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold font-display ${color}`}>{value}</p>
                </Card>
              ))}
            </div>
          )}

          {/* Revenue bar chart */}
          {revenueChartData.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-gray-800">Revenue by Month</h3>
              </CardHeader>
              <CardBody className="pt-2">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} />
                    <Bar dataKey="amount" name="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          )}

          {/* Payments table */}
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-800">
                Payment Records ({revenue?.summary?.count || 0})
              </h3>
            </CardHeader>
            {revLoading ? (
              <div className="p-6 space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-10 skeleton rounded" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-gray-50">
                    <tr>{['Receipt','Student','Amount','Method','Date'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(revenue?.data || []).map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-xs font-mono text-gray-400">{p.receipt_number}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{p.student?.full_name}</p>
                          <p className="text-xs text-gray-400">{p.student?.student_code}</p>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-emerald-700">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-2.5 uppercase text-xs text-gray-600">{p.payment_method}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{formatDate(p.payment_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!revenue?.data?.length && (
                  <div className="text-center py-12 text-gray-400 text-sm">No payments in this period</div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── STUDENTS ────────────────────────────────────────── */}
      {tab === 'students' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              All Students ({students?.length || 0})
            </h3>
          </CardHeader>
          {stuLoading ? (
            <div className="p-6 space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-10 skeleton rounded" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Code','Name','Phone','Seat','Plan','Status','Expiry'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(students || []).map((s) => {
                    const m = s.memberships?.find((mb) => mb.status === 'active') || s.memberships?.[0];
                    return (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{s.student_code}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{s.full_name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{s.phone}</td>
                        <td className="px-4 py-2.5">{s.assigned_seat?.seat_number || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-600">{m?.plan?.plan_name || '—'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs font-medium capitalize px-2 py-0.5 rounded-full
                            ${s.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                              s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{m ? formatDate(m.end_date) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!students?.length && (
                <div className="text-center py-12 text-gray-400 text-sm">No students found</div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── SEATS ───────────────────────────────────────────── */}
      {tab === 'seats' && (
        <div className="space-y-4">
          {/* Pie chart overview */}
          {!seatsLoading && (seatsPieData[0].value + seatsPieData[1].value) > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-800">Overall Occupancy</h3></CardHeader>
                <CardBody className="flex items-center justify-center pt-0">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={seatsPieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}>
                        {seatsPieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><h3 className="text-sm font-semibold text-gray-800">Summary</h3></CardHeader>
                <CardBody className="space-y-3 pt-0">
                  {[
                    { label: 'Total Seats',     value: seatsPieData.reduce((s, i) => s + i.value, 0) },
                    { label: 'Occupied Seats',  value: seatsPieData[0].value, color: 'text-blue-600' },
                    { label: 'Available Seats', value: seatsPieData[1].value, color: 'text-emerald-600' },
                    { label: 'Occupancy Rate',  value: `${seatsPieData.reduce((s, i) => s + i.value, 0) > 0 ? Math.round((seatsPieData[0].value / seatsPieData.reduce((s, i) => s + i.value, 0)) * 100) : 0}%`, color: 'text-primary-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">{label}</span>
                      <span className={`text-sm font-bold ${color || 'text-gray-900'}`}>{value}</span>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>
          )}

          {/* Per-section bars */}
          {seatsLoading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
          ) : (seats || []).map((section) => {
            const total    = section.seats?.length || 0;
            const occupied = section.seats?.filter((s) => s.status === 'occupied').length || 0;
            const pct      = total ? Math.round((occupied / total) * 100) : 0;
            return (
              <Card key={section.id || section.name} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: section.color_code || '#2563EB' }} />
                    <p className="text-sm font-semibold text-gray-800">{section.name}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className="h-2.5 rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: section.color_code || '#2563EB' }} />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  {occupied} occupied · {total - occupied} available · {total} total
                </p>
              </Card>
            );
          })}

          {!seatsLoading && !seats?.length && (
            <div className="text-center py-12 text-gray-400 text-sm">No seats data available</div>
          )}
        </div>
      )}

      {/* ── FEE PENDING ─────────────────────────────────────── */}
      {tab === 'fees' && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-800">
                Overdue / Expired Memberships ({feePending?.length || 0})
              </h3>
            </div>
          </CardHeader>
          {feeLoading ? (
            <div className="p-6 space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 skeleton rounded" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[580px] text-sm">
                <thead className="bg-gray-50">
                  <tr>{['Code','Name','Phone','Seat','Plan','Amount','Expired On'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(feePending || []).map((item, i) => (
                    <tr key={item.id || i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{item.student?.student_code}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{item.student?.full_name}</td>
                      <td className="px-4 py-2.5 text-gray-500">{item.student?.phone}</td>
                      <td className="px-4 py-2.5">{item.seat?.seat_number || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">{item.plan?.plan_name}</td>
                      <td className="px-4 py-2.5 font-semibold text-red-600">{formatCurrency(item.plan?.price)}</td>
                      <td className="px-4 py-2.5 text-xs text-red-500 font-medium">{formatDate(item.end_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!feePending?.length && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No overdue memberships — great!
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
