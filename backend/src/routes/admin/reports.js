// ============================================================
// Admin: Reports & Exports
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

// Helper: convert array to CSV
const toCSV = (data, columns) => {
  if (!data || data.length === 0) return '';
  const header = columns.map((c) => c.label).join(',');
  const rows = data.map((row) =>
    columns.map((c) => {
      const val = c.get ? c.get(row) : row[c.key];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [header, ...rows].join('\n');
};

// GET /api/admin/reports/students
router.get('/students', validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const { data, error } = await supabaseAdmin
      .from('students')
      .select(`
        student_code, full_name, phone, email, gender, date_of_birth,
        status, registered_at, activated_at,
        assigned_seat:seats!assigned_seat_id(seat_number, section:sections(name)),
        memberships(end_date, plan:subscription_plans(plan_name))
      `)
      .eq('tenant_id', tenantId)
      .order('student_code');

    if (error) throw new Error(error.message);

    if (req.query.format === 'csv') {
      const csv = toCSV(data, [
        { label: 'Student Code', key: 'student_code' },
        { label: 'Full Name', key: 'full_name' },
        { label: 'Phone', key: 'phone' },
        { label: 'Email', key: 'email' },
        { label: 'Gender', key: 'gender' },
        { label: 'Status', key: 'status' },
        { label: 'Seat', get: (r) => r.assigned_seat?.seat_number || '' },
        { label: 'Section', get: (r) => r.assigned_seat?.section?.name || '' },
        { label: 'Plan', get: (r) => r.memberships?.[0]?.plan?.plan_name || '' },
        { label: 'Expiry', get: (r) => r.memberships?.[0]?.end_date || '' },
        { label: 'Registered', key: 'registered_at' },
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=students.csv');
      return res.send(csv);
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/revenue
router.get('/revenue', validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const { from, to } = req.q;
    let query = supabaseAdmin
      .from('payments')
      .select(`
        receipt_number, amount, payment_method, utr_number, payment_date,
        status, notes,
        student:students(full_name, student_code)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'verified')
      .order('payment_date', { ascending: false });

    if (from) query = query.gte('payment_date', from);
    if (to) query = query.lte('payment_date', to);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const totalAmount = data.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const byCash = data.filter((p) => p.payment_method === 'cash').reduce((s, p) => s + parseFloat(p.amount), 0);
    const byUpi = data.filter((p) => p.payment_method === 'upi').reduce((s, p) => s + parseFloat(p.amount), 0);

    if (req.query.format === 'csv') {
      const csv = toCSV(data, [
        { label: 'Receipt No', key: 'receipt_number' },
        { label: 'Student', get: (r) => r.student?.full_name || '' },
        { label: 'Amount', key: 'amount' },
        { label: 'Method', key: 'payment_method' },
        { label: 'UTR', key: 'utr_number' },
        { label: 'Date', key: 'payment_date' },
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=revenue.csv');
      return res.send(csv);
    }

    res.json({ data, summary: { total: totalAmount, cash: byCash, upi: byUpi, count: data.length } });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/seats
router.get('/seats', validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('sections')
      .select(`
        name, color_code,
        seats(seat_number, status, seat_type,
          student:students!assigned_seat_id(full_name, student_code))
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/fee-pending
router.get('/fee-pending', validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .select(`
        end_date,
        student:students(full_name, student_code, phone, email),
        plan:subscription_plans(plan_name, price),
        seat:seats(seat_number)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'active')
      .lt('end_date', today)
      .order('end_date');

    if (error) throw new Error(error.message);

    if (req.query.format === 'csv') {
      const csv = toCSV(data, [
        { label: 'Student Code', get: (r) => r.student?.student_code || '' },
        { label: 'Name', get: (r) => r.student?.full_name || '' },
        { label: 'Phone', get: (r) => r.student?.phone || '' },
        { label: 'Seat', get: (r) => r.seat?.seat_number || '' },
        { label: 'Plan', get: (r) => r.plan?.plan_name || '' },
        { label: 'Amount Due', get: (r) => r.plan?.price || '' },
        { label: 'Expired On', key: 'end_date' },
      ]);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=fee-pending.csv');
      return res.send(csv);
    }

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/reports/subscriptions
router.get('/subscriptions', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select(`
        plan_name, plan_type, price, validity_type,
        memberships(count)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_active', true);

    if (error) throw new Error(error.message);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;

