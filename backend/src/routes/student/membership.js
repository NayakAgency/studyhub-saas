// ============================================================
// Student: Membership & Seat Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { upload, validateFileMagicBytes, handleUploadError } from '../../middleware/upload.js';
import { uploadPaymentScreenshot } from '../../services/storage.service.js';

const router = Router();
router.use(authenticate, requireRole('student'));

// GET /api/student/membership
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .select(`
        *,
        plan:subscription_plans(*),
        seat:seats(seat_number, section:sections(name))
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('student_id', req.user.student_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    res.json(data || null);
  } catch (error) {
    next(error);
  }
});

// GET /api/student/membership/history
router.get('/history', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('memberships')
      .select(`
        *,
        plan:subscription_plans(plan_name, plan_type, price),
        seat:seats(seat_number, section:sections(name))
      `)
      .eq('tenant_id', req.user.tenant_id)
      .eq('student_id', req.user.student_id)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// POST /api/student/renewal/request
router.post('/renew',
  upload.single('paymentScreenshot'),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      const schema = z.object({
        planId: z.string().uuid().optional(),
        paymentMethod: z.enum(['cash', 'upi']).optional(),
        utrNumber: z.string().optional(),
      });
      const body = schema.parse(req.body);

      // Get current active membership
      const { data: currentMembership } = await supabaseAdmin
        .from('memberships')
        .select('id, plan_id')
        .eq('student_id', req.user.student_id)
        .eq('status', 'active')
        .single();

      let screenshotUrl = null;
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(
          req.file.buffer, req.user.tenant_id,
          req.file.validatedMime || req.file.mimetype
        );
        screenshotUrl = url;
      }

      const { data, error } = await supabaseAdmin
        .from('renewal_requests')
        .insert({
          tenant_id: req.user.tenant_id,
          student_id: req.user.student_id,
          current_membership_id: currentMembership?.id || null,
          requested_plan_id: body.planId || currentMembership?.plan_id || null,
          payment_method: body.paymentMethod || null,
          utr_number: body.utrNumber || null,
          payment_screenshot_url: screenshotUrl,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/student/seat
router.get('/seat', async (req, res, next) => {
  try {
    const { data: student } = await supabaseAdmin
      .from('students')
      .select('assigned_seat_id')
      .eq('user_id', req.user.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (!student?.assigned_seat_id) return res.json(null);

    const { data: seat } = await supabaseAdmin
      .from('seats')
      .select('*, section:sections(*)')
      .eq('id', student.assigned_seat_id)
      .single();

    // Also get section layout
    const { data: allSeats } = await supabaseAdmin
      .from('seats')
      .select('id, seat_number, status, section_id, row_position, col_position')
      .eq('tenant_id', req.user.tenant_id)
      .order('seat_number');

    res.json({ currentSeat: seat, layoutSeats: allSeats || [] });
  } catch (error) {
    next(error);
  }
});

// POST /api/student/seat/change-request
router.post('/seat/change-request', async (req, res, next) => {
  try {
    const schema = z.object({
      requestedSeatId: z.string().uuid(),
      reason: z.string().min(10, 'Please provide a reason'),
    });
    const body = schema.parse(req.body);

    const { data: student } = await supabaseAdmin
      .from('students')
      .select('id, assigned_seat_id')
      .eq('user_id', req.user.id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    // Check no pending request
    const { count } = await supabaseAdmin
      .from('seat_change_requests')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', student.id)
      .eq('status', 'pending');

    if (count > 0) {
      return res.status(400).json({ error: 'You already have a pending seat change request' });
    }

    const { data, error } = await supabaseAdmin
      .from('seat_change_requests')
      .insert({
        tenant_id: req.user.tenant_id,
        student_id: student.id,
        current_seat_id: student.assigned_seat_id,
        requested_seat_id: body.requestedSeatId,
        reason: body.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
});

// POST /api/student/book-seat (for students without a seat)
router.post('/book-seat',
  upload.single('paymentScreenshot'),
  handleUploadError,
  validateFileMagicBytes,
  async (req, res, next) => {
    try {
      const schema = z.object({
        seatId: z.string().uuid(),
        planId: z.string().uuid(),
        paymentMethod: z.enum(['cash', 'upi']).optional(),
        utrNumber: z.string().optional(),
      });
      const body = schema.parse(req.body);

      let screenshotUrl = null;
      if (req.file) {
        const { url } = await uploadPaymentScreenshot(
          req.file.buffer, req.user.tenant_id,
          req.file.validatedMime || req.file.mimetype
        );
        screenshotUrl = url;
      }

      const { data, error } = await supabaseAdmin
        .from('seat_booking_requests')
        .insert({
          tenant_id: req.user.tenant_id,
          student_id: req.user.student_id,
          requested_seat_id: body.seatId,
          plan_id: body.planId,
          utr_number: body.utrNumber || null,
          payment_screenshot_url: screenshotUrl,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
