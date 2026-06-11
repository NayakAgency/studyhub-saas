// ============================================================
// Admin: Fee & Payment Management Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { AUDIT_ACTIONS } from '../../middleware/audit.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadPaymentScreenshot } from '../../services/storage.service.js';
import { sendPaymentReceiptEmail } from '../../services/email.service.js';

const router = Router();
router.use(authenticate, requireRole('hall_admin', 'super_admin'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

const recordPaymentSchema = z.object({
  studentId: z.string().uuid(),
  membershipId: z.string().uuid().optional(),
  amount: z.number().positive(),
  paymentMethod: z.enum(['cash', 'upi']),
  utrNumber: z.string().optional(),
  paymentDate: z.string(),
  notes: z.string().optional(),
  sendReceipt: z.boolean().default(false),
});

// GET /api/admin/payments
router.get('/', validateQuery(z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
  studentId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { page, limit, studentId, from, to } = req.q;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('payments')
      .select(`
        *, 
        student:students(id, full_name, student_code, phone),
        membership:memberships(id, plan:subscription_plans(plan_name))
      `, { count: 'exact' })
      .eq('tenant_id', req.user.tenant_id)
      .order('payment_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (studentId) query = query.eq('student_id', studentId);
    if (from) query = query.gte('payment_date', from);
    if (to) query = query.lte('payment_date', to);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    res.json({ data, pagination: { page, limit, total: count, pages: Math.ceil(count / limit) } });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/fees/overview (fee status per student + total summary)
router.get('/overview', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;

    const [studentsRes, totalRes] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select(`
          id, full_name, student_code, phone, status,
          assigned_seat:seats!assigned_seat_id(seat_number),
          memberships(id, end_date, status, plan:subscription_plans(plan_name, price)),
          payments(payment_date, amount)
        `)
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('full_name'),
      supabaseAdmin
        .from('payments')
        .select('amount, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'verified'),
    ]);

    if (studentsRes.error) throw new Error(studentsRes.error.message);

    const totalCollected = (totalRes.data || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
    const payments = studentsRes.data || [];

    res.json({ students: payments, totalCollected });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/payments/record
// Accepts EITHER multipart/form-data (with screenshot) OR application/json
const uploadOptional = (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    upload.single('paymentScreenshot')(req, res, next);
  } else {
    next(); // JSON body — already parsed by express.json()
  }
};

const magicBytesOptional = async (req, res, next) => {
  if (req.file) return validateFileMagicBytes(req, res, next);
  next();
};

router.post('/record',
  uploadOptional,
  handleUploadError,
  magicBytesOptional,
  async (req, res, next) => {
    try {
      // Support both form-data and JSON body
      const raw = req.body;
      const parsed = recordPaymentSchema.parse({
        studentId:     raw.studentId,
        membershipId:  raw.membershipId   || undefined,
        amount:        typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount),
        paymentMethod: raw.paymentMethod,
        utrNumber:     raw.utrNumber      || undefined,
        paymentDate:   raw.paymentDate,
        notes:         raw.notes          || undefined,
        sendReceipt:   raw.sendReceipt === true || raw.sendReceipt === 'true',
      });

      const tenantId = req.user.tenant_id;
      let screenshotUrl = null;

      // Upload screenshot if provided
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(
          req.file.buffer,
          tenantId,
          req.file.validatedMime || req.file.mimetype
        );
        screenshotUrl = url;
      }

      // Create payment record
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('payments')
        .insert({
          tenant_id: tenantId,
          student_id: parsed.studentId,
          membership_id: parsed.membershipId || null,
          amount: parsed.amount,
          payment_method: parsed.paymentMethod,
          utr_number: parsed.utrNumber || null,
          payment_screenshot_url: screenshotUrl,
          payment_date: parsed.paymentDate,
          recorded_by: req.user.id,
          status: 'verified',
          notes: parsed.notes || null,
        })
        .select('*, student:students(full_name, email)')
        .single();

      if (paymentError) throw new Error(paymentError.message);

      // Send receipt email if requested
      if (parsed.sendReceipt && payment.student?.email) {
        const { data: tenant } = await supabaseAdmin
          .from('tenants').select('hall_name').eq('id', tenantId).single();
        const { data: settings } = await supabaseAdmin
          .from('hall_settings').select('currency_symbol').eq('tenant_id', tenantId).single();

        await sendPaymentReceiptEmail({
          studentEmail: payment.student.email,
          studentName: payment.student.full_name,
          receiptNumber: payment.receipt_number,
          amount: payment.amount,
          paymentMethod: payment.payment_method,
          hallName: tenant?.hall_name || 'Study Hall',
          currencySymbol: settings?.currency_symbol || '₹',
          paymentDate: payment.payment_date,
        });
      }

      req.logAudit({
        action: AUDIT_ACTIONS.PAYMENT_RECORD,
        resourceType: 'payments',
        resourceId: payment.id,
        newValues: { amount: payment.amount, method: payment.payment_method },
      });

      res.status(201).json(payment);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/admin/payments/:id
router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        student:students(id, full_name, student_code, phone, email),
        membership:memberships(*, plan:subscription_plans(*), seat:seats(seat_number))
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

// GET /api/admin/payments/:id/receipt (returns receipt data for PDF generation)
router.get('/:id/receipt', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        student:students(full_name, student_code, phone, email),
        membership:memberships(start_date, end_date, seat:seats(seat_number), plan:subscription_plans(plan_name))
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !payment) return res.status(404).json({ error: 'Payment not found' });

    const { data: tenant } = await supabaseAdmin
      .from('tenants').select('hall_name, owner_phone, address, logo_url').eq('id', req.user.tenant_id).single();

    const { data: settings } = await supabaseAdmin
      .from('hall_settings').select('currency_symbol').eq('tenant_id', req.user.tenant_id).single();

    res.json({
      payment,
      tenant,
      currencySymbol: settings?.currency_symbol || '₹',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

