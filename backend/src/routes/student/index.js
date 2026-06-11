// ============================================================
// Student Routes — Combined Router
// Mounts all student sub-routes cleanly
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadPaymentScreenshot } from '../../services/storage.service.js';

// Sub-routes
import paymentsRouter      from './payments.js';
import profileRouter       from './profile.js';
import membershipRouter    from './membership.js';
import notificationsRouter from './notifications.js';
import complaintsRouter    from './complaints.js';

const router = Router();
router.use(authenticate, requireRole('student'));

// ── Mount Sub-Routers ─────────────────────────────────────────
router.use('/payments',      paymentsRouter);      // /api/student/payments/*
router.use('/profile',       profileRouter);       // /api/student/profile, /photo, /change-password
router.use('/membership',    membershipRouter);    // /api/student/membership, /history, /renew
router.use('/notifications', notificationsRouter); // /api/student/notifications, /:id/read, /read-all
router.use('/complaints',    complaintsRouter);    // /api/student/complaints

// ── Suggestions (direct routes, separate from complaints) ─────
// The complaintsRouter registers /suggestions internally but that
// would make the path /complaints/suggestions; we re-expose them
// directly at /suggestions for the frontend.
router.get('/suggestions', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('suggestions')
      .select('id, subject, status, is_anonymous, created_at')
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_anonymous', false)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) { next(err); }
});

router.post('/suggestions', async (req, res, next) => {
  try {
    const schema = z.object({
      subject: z.string().min(5),
      description: z.string().min(10),
      isAnonymous: z.boolean().default(false),
    });
    const body = schema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('suggestions').insert({
      tenant_id: req.user.tenant_id,
      student_id: body.isAnonymous ? null : req.user.student_id,
      subject: body.subject,
      description: body.description,
      is_anonymous: body.isAnonymous,
      status: 'received',
    }).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// Optional multipart helper (used for seat booking)
const uploadOptional = (fieldName) => (req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) upload.single(fieldName)(req, res, next);
  else next();
};
const magicBytesOptional = (req, res, next) => {
  if (req.file) return validateFileMagicBytes(req, res, next);
  next();
};

// ============================================================
// GET /api/student/dashboard
// ============================================================
router.get('/dashboard', async (req, res, next) => {
  try {
    const { data: student, error } = await supabaseAdmin
      .from('students')
      .select(`
        id, full_name, student_code, phone, status, profile_photo_url,
        assigned_seat:seats!assigned_seat_id(seat_number, section:sections(name, color_code)),
        memberships(id, start_date, end_date, status, plan:subscription_plans(plan_name, plan_type, price)),
        tenant:tenants(hall_name, logo_url, theme_color, owner_phone)
      `)
      .eq('user_id', req.user.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error || !student) return res.status(404).json({ error: 'Student not found' });

    const { data: announcements } = await supabaseAdmin
      .from('announcements')
      .select('id, title, type, is_pinned, created_at')
      .eq('tenant_id', req.user.tenant_id)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('is_read', false);

    const activeMembership = student.memberships?.find((m) => m.status === 'active');
    const daysRemaining = activeMembership
      ? Math.ceil((new Date(activeMembership.end_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null;

    res.json({
      student,
      activeMembership: activeMembership || null,
      daysRemaining,
      announcements: announcements || [],
      unreadNotifications: unreadCount || 0,
    });
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/student/seat
// ============================================================
router.get('/seat', async (req, res, next) => {
  try {
    const { data: student } = await supabaseAdmin
      .from('students').select('assigned_seat_id')
      .eq('user_id', req.user.id).eq('tenant_id', req.user.tenant_id).single();

    if (!student?.assigned_seat_id) return res.json({ currentSeat: null, layoutSeats: [] });

    const [{ data: seat }, { data: allSeats }] = await Promise.all([
      supabaseAdmin.from('seats').select('*, section:sections(*)').eq('id', student.assigned_seat_id).single(),
      supabaseAdmin.from('seats')
        .select('id, seat_number, status, section_id, row_position, col_position, section:sections(name)')
        .eq('tenant_id', req.user.tenant_id).order('seat_number'),
    ]);

    res.json({ currentSeat: seat, layoutSeats: allSeats || [] });
  } catch (err) { next(err); }
});

// ============================================================
// POST /api/student/seat/change-request
// ============================================================
router.post('/seat/change-request', async (req, res, next) => {
  try {
    const schema = z.object({ requestedSeatId: z.string().uuid(), reason: z.string().min(10) });
    const body = schema.parse(req.body);

    const { data: student } = await supabaseAdmin
      .from('students').select('id, assigned_seat_id')
      .eq('user_id', req.user.id).eq('tenant_id', req.user.tenant_id).single();

    const { count } = await supabaseAdmin
      .from('seat_change_requests').select('*', { count: 'exact', head: true })
      .eq('student_id', student.id).eq('status', 'pending');

    if (count > 0) return res.status(400).json({ error: 'You already have a pending seat change request' });

    const { data, error } = await supabaseAdmin.from('seat_change_requests').insert({
      tenant_id: req.user.tenant_id, student_id: student.id,
      current_seat_id: student.assigned_seat_id, requested_seat_id: body.requestedSeatId,
      reason: body.reason, status: 'pending',
    }).select().single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) { next(err); }
});

// ============================================================
// POST /api/student/book-seat
// ============================================================
router.post('/book-seat',
  uploadOptional('paymentScreenshot'), handleUploadError, magicBytesOptional,
  async (req, res, next) => {
    try {
      const schema = z.object({
        seatId: z.string().uuid(), planId: z.string().uuid(),
        paymentMethod: z.enum(['cash', 'upi']).optional(), utrNumber: z.string().optional(),
      });
      const body = schema.parse(req.body);

      let screenshotUrl = null;
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(req.file.buffer, req.user.tenant_id, req.file.validatedMime || req.file.mimetype);
        screenshotUrl = url;
      }

      const { data, error } = await supabaseAdmin.from('seat_booking_requests').insert({
        tenant_id: req.user.tenant_id, student_id: req.user.student_id,
        requested_seat_id: body.seatId, plan_id: body.planId,
        utr_number: body.utrNumber || null, payment_screenshot_url: screenshotUrl, status: 'pending',
      }).select().single();

      if (error) throw new Error(error.message);
      res.status(201).json(data);
    } catch (err) { next(err); }
  }
);

// ============================================================
// GET /api/student/fees
// ============================================================
router.get('/fees', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('id, receipt_number, amount, payment_method, utr_number, payment_date, status, notes')
      .eq('student_id', req.user.student_id).eq('tenant_id', req.user.tenant_id)
      .order('payment_date', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/student/fees/receipt/:paymentId
// ============================================================
router.get('/fees/receipt/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = z.object({ paymentId: z.string().uuid() }).parse(req.params);
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*, student:students(full_name, student_code, phone), membership:memberships(start_date, end_date, seat:seats(seat_number), plan:subscription_plans(plan_name))')
      .eq('id', paymentId).eq('student_id', req.user.student_id).eq('tenant_id', req.user.tenant_id).single();
    if (!payment) return res.status(404).json({ error: 'Receipt not found' });

    const [tenantRes, settingsRes] = await Promise.all([
      supabaseAdmin.from('tenants').select('hall_name, owner_phone, address, logo_url').eq('id', req.user.tenant_id).single(),
      supabaseAdmin.from('hall_settings').select('currency_symbol').eq('tenant_id', req.user.tenant_id).single(),
    ]);
    res.json({ payment, tenant: tenantRes.data, currencySymbol: settingsRes.data?.currency_symbol || '₹' });
  } catch (err) { next(err); }
});

// ============================================================
// GET /api/student/resources
// ============================================================
router.get('/resources', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = supabaseAdmin
      .from('study_resources')
      .select('id, title, description, file_url, file_size_bytes, subject_tag, created_at')
      .eq('tenant_id', req.user.tenant_id).eq('is_active', true)
      .order('created_at', { ascending: false });
    if (search) query = query.or(`title.ilike.%${search}%,subject_tag.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (err) { next(err); }
});

export default router;
