// ============================================================
// Student: Notifications, Fees & Resources Routes
// ============================================================

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { markNotificationRead, markAllNotificationsRead } from '../../services/notification.service.js';

const router = Router();
router.use(authenticate, requireRole('student'));

// GET /api/student/notifications
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('student_id', req.user.student_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', req.user.student_id)
      .eq('is_read', false);

    res.json({
      data: data || [],
      unreadCount: unreadCount || 0,
      pagination: { page: +page, limit: +limit, total: count },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/student/notifications/read-all  — MUST come before /:id/read
router.patch('/read-all', async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user.student_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/student/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
  try {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    await markNotificationRead(id, req.user.student_id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/student/fees/history
router.get('/fees', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select('id, receipt_number, amount, payment_method, utr_number, payment_date, status, notes')
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .order('payment_date', { ascending: false });

    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

// GET /api/student/fees/receipt/:paymentId
router.get('/fees/receipt/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = z.object({ paymentId: z.string().uuid() }).parse(req.params);

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        student:students(full_name, student_code, phone),
        membership:memberships(start_date, end_date, seat:seats(seat_number), plan:subscription_plans(plan_name))
      `)
      .eq('id', paymentId)
      .eq('student_id', req.user.student_id)
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (!payment) return res.status(404).json({ error: 'Receipt not found' });

    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('hall_name, owner_phone, address, logo_url')
      .eq('id', req.user.tenant_id)
      .single();

    const { data: settings } = await supabaseAdmin
      .from('hall_settings')
      .select('currency_symbol')
      .eq('tenant_id', req.user.tenant_id)
      .single();

    res.json({ payment, tenant, currencySymbol: settings?.currency_symbol || '₹' });
  } catch (error) {
    next(error);
  }
});

// GET /api/student/resources
router.get('/resources', async (req, res, next) => {
  try {
    const { search } = req.query;
    let query = supabaseAdmin
      .from('study_resources')
      .select('id, title, description, file_url, file_size_bytes, subject_tag, created_at')
      .eq('tenant_id', req.user.tenant_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%,subject_tag.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    // Log resource access activity (fire-and-forget)
    if (data && data.length > 0) {
      supabaseAdmin.from('student_activity_logs').insert({
        tenant_id: req.user.tenant_id,
        student_id: req.user.student_id,
        activity_type: 'resource_access',
        activity_data: { search: search || null, count: data.length },
      }).catch(() => {/* non-critical */});
    }

    res.json(data || []);
  } catch (error) {
    next(error);
  }
});

export default router;
