// ============================================================
// Admin Payment Routes
// UPI (UTR) + Cash recording, verify/reject student submissions,
// statistics, export, history
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { upload, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadPaymentScreenshot } from '../../services/storage.service.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import {
  recordAdminPayment,
  verifyStudentPayment,
  getPaymentStats,
  ADMIN_PAYMENT_METHODS,
} from '../../services/payment.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

const uploadOptional = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    upload.single('screenshot')(req, res, next);
  } else {
    next();
  }
};
const magicOptional = (req, res, next) => {
  if (req.file) return validateFileMagicBytes(req, res, next);
  next();
};

// ============================================================
// LIST PAYMENTS
// GET /api/admin/payments
// ============================================================

router.get('/',
  validateQuery(z.object({
    page:          z.coerce.number().min(1).default(1),
    limit:         z.coerce.number().min(1).max(100).default(20),
    status:        z.enum(['pending', 'verified', 'rejected']).optional(),
    method:        z.enum(['upi', 'cash']).optional(),
    studentId:     z.string().uuid().optional(),
    from:          z.string().optional(),
    to:            z.string().optional(),
    sortBy:        z.enum(['payment_date', 'amount', 'created_at']).default('payment_date'),
    sortOrder:     z.enum(['asc', 'desc']).default('desc'),
  })),
  async (req, res, next) => {
    try {
      const { page, limit, status, method, studentId, from, to, sortBy, sortOrder } = req.q;
      const tenantId = req.user.tenant_id;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('payments')
        .select(`
          id, receipt_number, amount, payment_method, utr_number,
          payment_date, status, description, notes, reject_reason, created_at,
          student:students(id, full_name, student_code, phone)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (status)    query = query.eq('status', status);
      if (method)    query = query.eq('payment_method', method);
      if (studentId) query = query.eq('student_id', studentId);
      if (from)      query = query.gte('payment_date', from);
      if (to)        query = query.lte('payment_date', to);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);

      res.json({
        data: data || [],
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// PAYMENT STATISTICS
// GET /api/admin/payments/stats?period=month
// ============================================================

router.get('/stats',
  validateQuery(z.object({
    period:    z.enum(['week', 'month', 'year', 'custom']).default('month'),
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
  })),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenant_id;
      const { period, startDate, endDate } = req.q;

      const today = new Date();
      const periodStarts = {
        week:  new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
        month: new Date(today.getFullYear(), today.getMonth(), 1),
        year:  new Date(today.getFullYear(), 0, 1),
      };

      const from = startDate || (periodStarts[period] || periodStarts.month).toISOString().split('T')[0];
      const to   = endDate   || today.toISOString().split('T')[0];

      const stats = await getPaymentStats(tenantId, from, to);

      // Method breakdown
      const { data: methodRows } = await supabaseAdmin
        .from('payments')
        .select('payment_method, amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'verified')
        .gte('payment_date', from)
        .lte('payment_date', to);

      const methodStats = { upi: { count: 0, total: 0 }, cash: { count: 0, total: 0 } };
      methodRows?.forEach(r => {
        const m = r.payment_method;
        if (methodStats[m]) {
          methodStats[m].count++;
          methodStats[m].total += parseFloat(r.amount);
        }
      });

      // Daily trend
      const { data: trendRows } = await supabaseAdmin
        .from('payments')
        .select('payment_date, amount')
        .eq('tenant_id', tenantId)
        .eq('status', 'verified')
        .gte('payment_date', from)
        .lte('payment_date', to)
        .order('payment_date');

      const trendData = {};
      trendRows?.forEach(r => {
        if (!trendData[r.payment_date]) trendData[r.payment_date] = { count: 0, total: 0 };
        trendData[r.payment_date].count++;
        trendData[r.payment_date].total += parseFloat(r.amount);
      });

      // Pending count
      const { count: pendingCount } = await supabaseAdmin
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'pending');

      res.json({ stats, methodStats, trendData, pendingCount: pendingCount || 0, period: { from, to } });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// PENDING PAYMENTS (waiting for verification)
// GET /api/admin/payments/pending
// ============================================================

router.get('/pending', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        id, amount, utr_number, payment_date, description,
        payment_screenshot_url, created_at,
        student:students(id, full_name, student_code, phone)
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }); // oldest first

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// VERIFY OR REJECT A STUDENT-SUBMITTED PAYMENT
// POST /api/admin/payments/:id/verify
// Body: { action: 'verify' | 'reject', rejectReason?, sendReceipt? }
// ============================================================

const verifySchema = z.object({
  action:       z.enum(['verify', 'reject']),
  rejectReason: z.string().max(300).optional(),
  sendReceipt:  z.boolean().default(false),
});

router.post('/:id/verify',
  validateParams(uuidSchema),
  validateBody(verifySchema),
  async (req, res, next) => {
    try {
      const payment = await verifyStudentPayment({
        paymentId:    req.params.id,
        tenantId:     req.user.tenant_id,
        adminId:      req.user.id,
        action:       req.body.action,
        rejectReason: req.body.rejectReason,
        sendReceipt:  req.body.sendReceipt,
      });

      req.logAudit?.({
        action:       req.body.action === 'verify' ? AUDIT_ACTIONS.PAYMENT_VERIFY : AUDIT_ACTIONS.PAYMENT_REJECT,
        resourceType: 'payments',
        resourceId:   payment.id,
        newValues:    { status: payment.status, action: req.body.action },
      });

      res.json({ success: true, payment });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// RECORD PAYMENT (Admin-side: cash or UPI)
// POST /api/admin/payments/record
// ============================================================

const recordSchema = z.object({
  studentId:    z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  amount:       z.coerce.number().positive(),
  paymentMethod: z.enum(ADMIN_PAYMENT_METHODS),
  utrNumber:    z.string().min(12).max(22).regex(/^[A-Z0-9]+$/i).optional(),
  paymentDate:  z.string(),
  notes:        z.string().max(500).optional(),
  sendReceipt:  z.boolean().default(false),
}).refine(
  (d) => d.paymentMethod !== 'upi' || !!d.utrNumber,
  { message: 'UTR number is required for UPI payments', path: ['utrNumber'] }
);

router.post('/record',
  uploadOptional, handleUploadError, magicOptional,
  async (req, res, next) => {
    try {
      const raw = req.body;
      const parsed = recordSchema.parse({
        studentId:     raw.studentId,
        membershipId:  raw.membershipId  || undefined,
        amount:        raw.amount,
        paymentMethod: raw.paymentMethod,
        utrNumber:     raw.utrNumber     || undefined,
        paymentDate:   raw.paymentDate,
        notes:         raw.notes         || undefined,
        sendReceipt:   raw.sendReceipt === true || raw.sendReceipt === 'true',
      });

      let screenshotUrl = null;
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(
          req.file.buffer,
          req.user.tenant_id,
          req.file.validatedMime || req.file.mimetype
        );
        screenshotUrl = url;
      }

      const payment = await recordAdminPayment({
        tenantId:      req.user.tenant_id,
        studentId:     parsed.studentId,
        membershipId:  parsed.membershipId,
        amount:        parsed.amount,
        paymentMethod: parsed.paymentMethod,
        utrNumber:     parsed.utrNumber,
        screenshotUrl,
        paymentDate:   parsed.paymentDate,
        notes:         parsed.notes,
        adminId:       req.user.id,
        sendReceipt:   parsed.sendReceipt,
      });

      req.logAudit?.({
        action:       AUDIT_ACTIONS.PAYMENT_RECORD,
        resourceType: 'payments',
        resourceId:   payment.id,
        newValues:    { amount: payment.amount, method: payment.payment_method },
      });

      res.status(201).json(payment);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0].message });
      }
      next(error);
    }
  }
);

// ============================================================
// GET SINGLE PAYMENT
// GET /api/admin/payments/:id
// ============================================================

router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, email),
        membership:memberships(id, start_date, end_date, status,
          plan:subscription_plans(plan_name, price),
          seat:seats(seat_number, section:sections(name))
        )
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Payment not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

// ============================================================
// EXPORT PAYMENTS AS CSV
// GET /api/admin/payments/export?from=&to=
// ============================================================

router.get('/export',
  validateQuery(z.object({
    from:   z.string().optional(),
    to:     z.string().optional(),
    status: z.enum(['pending', 'verified', 'rejected']).optional(),
  })),
  async (req, res, next) => {
    try {
      const { from, to, status } = req.q;
      let query = supabaseAdmin
        .from('payments')
        .select(`
          receipt_number, amount, payment_method, utr_number,
          payment_date, status, description, notes, reject_reason,
          student:students(full_name, student_code, phone)
        `)
        .eq('tenant_id', req.user.tenant_id)
        .order('payment_date', { ascending: false });

      if (from)   query = query.gte('payment_date', from);
      if (to)     query = query.lte('payment_date', to);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const headers = ['Receipt No', 'Student Name', 'Code', 'Phone', 'Amount', 'Method', 'UTR Number', 'Date', 'Status', 'Notes'];
      const rows = (data || []).map(p => [
        p.receipt_number || '',
        p.student?.full_name || '',
        p.student?.student_code || '',
        p.student?.phone || '',
        p.amount,
        p.payment_method,
        p.utr_number || '',
        p.payment_date,
        p.status,
        p.notes || '',
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${Date.now()}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

export default router;