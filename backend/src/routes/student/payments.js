// ============================================================
// Student Payment Routes
// UPI payments with UTR number only
// Submit → Admin verifies → Receipt sent
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { enforceTenantActive } from '../../middleware/tenant-status.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { upload, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadPaymentScreenshot } from '../../services/storage.service.js';
import { submitStudentPayment, getStudentPaymentSummary } from '../../services/payment.service.js';
import { supabaseAdmin } from '../../config/supabase.js';

const router = Router();
router.use(authenticate, requireRole('student'), requireTenant, enforceTenantActive);

const uuidSchema = z.object({ id: z.string().uuid() });

// Screenshot upload — optional multipart helper
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
// SUBMIT UPI PAYMENT
// POST /api/student/payments/submit
// Body: { amount, utrNumber, membershipId?, description? }
// Optional multipart: screenshot file
// ============================================================

const submitSchema = z.object({
  amount:       z.coerce.number().positive('Amount must be positive'),
  utrNumber:    z.string().min(12, 'UTR must be at least 12 characters')
                          .max(22, 'UTR must be at most 22 characters')
                          .regex(/^[A-Z0-9]+$/i, 'UTR must be alphanumeric'),
  membershipId: z.string().uuid().optional(),
  description:  z.string().max(200).optional(),
});

router.post('/submit',
  uploadOptional, handleUploadError, magicOptional,
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenant_id;
      const studentId = req.user.student_id;

      // Parse body (supports both JSON and form-data)
      const parsed = submitSchema.parse({
        amount:       req.body.amount,
        utrNumber:    req.body.utrNumber,
        membershipId: req.body.membershipId,
        description:  req.body.description,
      });

      // Check for duplicate UTR within the same tenant
      const { count: dupCount } = await supabaseAdmin
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('utr_number', parsed.utrNumber.toUpperCase())
        .in('status', ['pending', 'verified']);

      if (dupCount > 0) {
        return res.status(409).json({ error: 'This UTR number has already been submitted' });
      }

      // Upload screenshot if provided
      let screenshotUrl = null;
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(
          req.file.buffer,
          tenantId,
          req.file.validatedMime || req.file.mimetype
        );
        screenshotUrl = url;
      }

      const payment = await submitStudentPayment({
        tenantId,
        studentId,
        membershipId: parsed.membershipId,
        amount:       parsed.amount,
        utrNumber:    parsed.utrNumber.toUpperCase(),
        screenshotUrl,
        description:  parsed.description,
      });

      res.status(201).json({
        success: true,
        payment: {
          id:             payment.id,
          amount:         payment.amount,
          utr_number:     payment.utr_number,
          status:         payment.status,
          payment_date:   payment.payment_date,
          receipt_number: payment.receipt_number,
        },
        message: 'Payment submitted for verification. You will be notified once verified.',
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.errors[0].message });
      }
      next(error);
    }
  }
);

// ============================================================
// GET PAYMENT HISTORY
// GET /api/student/payments?page=1&limit=10&status=
// ============================================================

router.get('/',
  validateQuery(z.object({
    page:   z.coerce.number().min(1).default(1),
    limit:  z.coerce.number().min(1).max(50).default(10),
    status: z.enum(['pending', 'verified', 'rejected']).optional(),
  })),
  async (req, res, next) => {
    try {
      const tenantId = req.user.tenant_id;
      const studentId = req.user.student_id;
      const { page, limit, status } = req.q;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from('payments')
        .select(
          'id, receipt_number, amount, payment_method, utr_number, payment_date, status, description, payment_screenshot_url, reject_reason, created_at',
          { count: 'exact' }
        )
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) query = query.eq('status', status);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);

      res.json({
        payments: data || [],
        pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================================
// GET PAYMENT SUMMARY
// GET /api/student/payments/summary
// ============================================================

router.get('/summary', async (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id;
    const studentId = req.user.student_id;

    const [summary, recent] = await Promise.all([
      getStudentPaymentSummary(tenantId, studentId),
      supabaseAdmin
        .from('payments')
        .select('id, amount, payment_date, status, description, payment_method')
        .eq('tenant_id', tenantId)
        .eq('student_id', studentId)
        .order('payment_date', { ascending: false })
        .limit(5)
        .then(r => r.data || []),
    ]);

    res.json({ summary, recentPayments: recent });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GET SINGLE PAYMENT DETAIL
// GET /api/student/payments/:id
// ============================================================

router.get('/:id', validateParams(uuidSchema), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', req.params.id)
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Payment not found' });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
