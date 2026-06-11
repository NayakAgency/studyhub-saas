// ============================================================
// Mobile API Routes - Optimized for Mobile Applications
// Lightweight responses, offline support, push notifications
// ============================================================

import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole, requireTenant } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { supabaseAdmin } from '../../config/supabase.js';
import { cacheOrFetch } from '../../services/cache.service.js';
import { createNotification, NOTIFICATION_TYPES } from '../../services/notification.service.js';

const router = express.Router();

// Mobile API middleware
router.use(authenticate);

// ============================================================
// MOBILE APP INFO & VERSION CHECK
// GET /api/mobile/app-info
// ============================================================

router.get('/app-info', async (req, res) => {
  try {
    const { version, platform } = req.query;
    
    // App configuration for mobile clients
    const appInfo = {
      current_version: '1.0.0',
      minimum_version: '1.0.0',
      update_required: false,
      update_url: {
        ios: 'https://apps.apple.com/app/studyhub',
        android: 'https://play.google.com/store/apps/details?id=com.studyhub.app',
      },
      features: {
        offline_mode: true,
        push_notifications: true,
        biometric_auth: true,
        dark_mode: true,
      },
      api: {
        base_url: process.env.API_URL || 'http://localhost:3001/api',
        websocket_url: process.env.WS_URL || 'ws://localhost:3001',
        timeout: 30000,
      },
    };

    // Check if update is required
    if (version && version < appInfo.minimum_version) {
      appInfo.update_required = true;
    }

    res.json({
      success: true,
      data: appInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get app info',
    });
  }
});

// ============================================================
// MOBILE STUDENT DASHBOARD (Optimized)
// GET /api/mobile/dashboard
// ============================================================

router.get('/dashboard', requireRole('student'), async (req, res) => {
  try {
    const { user } = req;
    const cacheKey = `mobile_dashboard:${user.student_id}`;

    const dashboardData = await cacheOrFetch(cacheKey, async () => {
      // Optimized query with only essential data for mobile
      const { data: student, error } = await supabaseAdmin
        .from('students')
        .select(`
          id, full_name, student_code, profile_photo_url,
          assigned_seat:seats!assigned_seat_id(seat_number, section:sections(name)),
          tenant:tenants!inner(hall_name, logo_url, theme_color)
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Get active membership (simplified)
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select(`
          id, end_date, status,
          plan:subscription_plans(plan_name, price)
        `)
        .eq('student_id', student.id)
        .eq('status', 'active')
        .single();

      // Get unread notifications count
      const { count: unreadCount } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .eq('is_read', false);

      // Calculate days remaining
      const daysRemaining = membership?.end_date
        ? Math.ceil((new Date(membership.end_date) - new Date()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        student: {
          id: student.id,
          name: student.full_name,
          code: student.student_code,
          photo_url: student.profile_photo_url,
        },
        hall: {
          name: student.tenant.hall_name,
          logo_url: student.tenant.logo_url,
          theme_color: student.tenant.theme_color,
        },
        seat: student.assigned_seat ? {
          number: student.assigned_seat.seat_number,
          section: student.assigned_seat.section?.name,
        } : null,
        membership: membership ? {
          id: membership.id,
          plan_name: membership.plan.plan_name,
          price: membership.plan.price,
          end_date: membership.end_date,
          days_remaining: daysRemaining,
          status: daysRemaining > 7 ? 'active' : daysRemaining > 0 ? 'expiring' : 'expired',
        } : null,
        notifications: {
          unread_count: unreadCount || 0,
        },
      };
    }, 300); // 5-minute cache

    res.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('Mobile dashboard error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load dashboard',
    });
  }
});

// ============================================================
// MOBILE NOTIFICATIONS (Paginated & Optimized)
// GET /api/mobile/notifications
// ============================================================

const notificationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
  unread_only: z.coerce.boolean().default(false),
});

router.get('/notifications', requireRole('student'), validateRequest(notificationsQuerySchema, 'query'), async (req, res) => {
  try {
    const { user } = req;
    const { page, limit, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notifications')
      .select('id, type, title, body, is_read, created_at', { count: 'exact' })
      .eq('student_id', user.student_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unread_only) {
      query = query.eq('is_read', false);
    }

    const { data: notifications, error, count } = await query;

    if (error) throw error;

    // Format for mobile consumption
    const formattedNotifications = (notifications || []).map(notification => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      is_read: notification.is_read,
      time_ago: getTimeAgo(notification.created_at),
      created_at: notification.created_at,
    }));

    res.json({
      success: true,
      data: {
        notifications: formattedNotifications,
        pagination: {
          page,
          limit,
          total: count || 0,
          has_more: (count || 0) > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error('Mobile notifications error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load notifications',
    });
  }
});

// ============================================================
// MARK NOTIFICATIONS AS READ (Batch)
// POST /api/mobile/notifications/mark-read
// ============================================================

const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).optional(),
  mark_all: z.boolean().default(false),
});

router.post('/notifications/mark-read', requireRole('student'), validateRequest(markReadSchema), async (req, res) => {
  try {
    const { user } = req;
    const { notification_ids, mark_all } = req.body;

    let query = supabaseAdmin
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('student_id', user.student_id)
      .eq('is_read', false);

    if (mark_all) {
      // mark_all: query already scoped to tenant student + is_read=false, execute as-is
    } else if (notification_ids && notification_ids.length > 0) {
      query = query.in('id', notification_ids);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either notification_ids or mark_all must be provided',
      });
    }

    const { error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      message: 'Notifications marked as read',
    });
  } catch (error) {
    console.error('Mark notifications read error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
    });
  }
});

// ============================================================
// MOBILE PAYMENT HISTORY (Lightweight)
// GET /api/mobile/payments
// ============================================================

const paymentsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(20).default(10),
});

router.get('/payments', requireRole('student'), validateRequest(paymentsQuerySchema, 'query'), async (req, res) => {
  try {
    const { user } = req;
    const { page, limit } = req.query;
    const offset = (page - 1) * limit;

    const { data: payments, error, count } = await supabaseAdmin
      .from('payments')
      .select('id, amount, payment_method, payment_date, status, receipt_number', { count: 'exact' })
      .eq('student_id', user.student_id)
      .order('payment_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Format for mobile
    const formattedPayments = (payments || []).map(payment => ({
      id: payment.id,
      amount: payment.amount,
      method: payment.payment_method,
      date: payment.payment_date,
      status: payment.status,
      receipt: payment.receipt_number,
      time_ago: getTimeAgo(payment.payment_date),
    }));

    res.json({
      success: true,
      data: {
        payments: formattedPayments,
        pagination: {
          page,
          limit,
          total: count || 0,
          has_more: (count || 0) > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error('Mobile payments error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load payments',
    });
  }
});

// ============================================================
// PUSH NOTIFICATION REGISTRATION
// POST /api/mobile/push-token
// ============================================================

const pushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  device_id: z.string().min(1),
});

router.post('/push-token', validateRequest(pushTokenSchema), async (req, res) => {
  try {
    const { user } = req;
    const { token, platform, device_id } = req.body;

    // Store push token (create table if needed)
    const { error } = await supabaseAdmin
      .from('push_tokens')
      .upsert({
        user_id: user.id,
        student_id: user.student_id,
        tenant_id: user.tenant_id,
        token,
        platform,
        device_id,
        is_active: true,
        last_used: new Date().toISOString(),
      }, {
        onConflict: 'user_id,device_id',
      });

    if (error) throw error;

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    console.error('Push token registration error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to register push token',
    });
  }
});

// ============================================================
// QUICK ACTIONS FOR MOBILE
// GET /api/mobile/quick-actions
// ============================================================

router.get('/quick-actions', requireRole('student'), async (req, res) => {
  try {
    const { user } = req;

    // Get student's current status and generate relevant quick actions
    const { data: student } = await supabaseAdmin
      .from('students')
      .select(`
        id, status,
        memberships!inner(id, status, end_date),
        complaints(id, status)
      `)
      .eq('user_id', user.id)
      .single();

    const quickActions = [];

    // Add relevant actions based on student status
    if (student) {
      const activeMembership = student.memberships?.find(m => m.status === 'active');
      
      if (activeMembership) {
        const daysLeft = Math.ceil((new Date(activeMembership.end_date) - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysLeft <= 7) {
          quickActions.push({
            id: 'renew_membership',
            title: 'Renew Membership',
            description: `Expires in ${daysLeft} days`,
            icon: 'refresh',
            action: 'navigate',
            target: '/membership/renew',
            priority: 'high',
          });
        }
      }

      // Add complaint action if no recent complaints
      const recentComplaints = student.complaints?.filter(c => c.status === 'open');
      if (!recentComplaints || recentComplaints.length === 0) {
        quickActions.push({
          id: 'raise_complaint',
          title: 'Raise Complaint',
          description: 'Report an issue',
          icon: 'alert-circle',
          action: 'navigate',
          target: '/complaints/new',
          priority: 'medium',
        });
      }

      // Common actions
      quickActions.push(
        {
          id: 'payment_history',
          title: 'Payment History',
          description: 'View your payments',
          icon: 'credit-card',
          action: 'navigate',
          target: '/payments',
          priority: 'low',
        },
        {
          id: 'contact_admin',
          title: 'Contact Admin',
          description: 'Get support',
          icon: 'phone',
          action: 'contact',
          target: 'admin',
          priority: 'low',
        }
      );
    }

    res.json({
      success: true,
      data: {
        actions: quickActions,
      },
    });
  } catch (error) {
    console.error('Quick actions error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load quick actions',
    });
  }
});

// ============================================================
// OFFLINE DATA SYNC
// GET /api/mobile/sync
// ============================================================

router.get('/sync', requireRole('student'), async (req, res) => {
  try {
    const { user } = req;
    const { last_sync } = req.query;

    // Get all data needed for offline mode
    const syncData = await Promise.all([
      // Student profile
      supabaseAdmin
        .from('students')
        .select(`
          id, full_name, student_code, phone, email, profile_photo_url,
          assigned_seat:seats!assigned_seat_id(seat_number, section:sections(name))
        `)
        .eq('user_id', user.id)
        .single(),

      // Active membership
      supabaseAdmin
        .from('memberships')
        .select(`
          id, start_date, end_date, status,
          plan:subscription_plans(plan_name, price, duration_months)
        `)
        .eq('student_id', user.student_id)
        .eq('status', 'active')
        .single(),

      // Recent notifications (last 50)
      supabaseAdmin
        .from('notifications')
        .select('id, type, title, body, is_read, created_at')
        .eq('student_id', user.student_id)
        .order('created_at', { ascending: false })
        .limit(50),

      // Hall settings
      supabaseAdmin
        .from('hall_settings')
        .select('currency_symbol, contact_phone, contact_email')
        .eq('tenant_id', user.tenant_id)
        .single(),
    ]);

    const [studentRes, membershipRes, notificationsRes, settingsRes] = syncData;

    res.json({
      success: true,
      data: {
        student: studentRes.data,
        membership: membershipRes.data,
        notifications: notificationsRes.data || [],
        hall_settings: settingsRes.data,
        sync_timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Sync error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to sync data',
    });
  }
});

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
  return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
}

export default router;