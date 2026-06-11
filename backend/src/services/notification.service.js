// ============================================================
// Notification Service
// Creates in-app notifications for students
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';
import { broadcastNotification } from './websocket.service.js';

export const createNotification = async ({
  tenantId,
  studentId,
  type,
  title,
  body,
  referenceId = null,
  referenceType = null,
}) => {
  try {
    const { data, error } = await supabaseAdmin.from('notifications').insert({
      tenant_id: tenantId,
      student_id: studentId,
      type,
      title,
      body,
      reference_id: referenceId,
      reference_type: referenceType,
      is_read: false,
    }).select().single();

    if (error) throw error;

    // Broadcast real-time notification
    broadcastNotification(tenantId, studentId, data);

    return data;
  } catch (error) {
    console.error('Create notification failed:', error.message);
    return null;
  }
};

// Create notification for all students in a tenant (e.g., announcements)
export const createBroadcastNotification = async ({
  tenantId,
  type,
  title,
  body,
  referenceId = null,
  referenceType = null,
}) => {
  try {
    // Get all active students
    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (!students || students.length === 0) return;

    const notifications = students.map((student) => ({
      tenant_id: tenantId,
      student_id: student.id,
      type,
      title,
      body,
      reference_id: referenceId,
      reference_type: referenceType,
      is_read: false,
    }));

    // Insert in batches of 100
    for (let i = 0; i < notifications.length; i += 100) {
      await supabaseAdmin.from('notifications').insert(notifications.slice(i, i + 100));
    }
  } catch (error) {
    console.error('Broadcast notification failed:', error.message);
  }
};

// Mark notification as read
export const markNotificationRead = async (notificationId, studentId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('student_id', studentId);

  if (error) throw new Error(error.message);
};

// Mark all notifications as read for a student
export const markAllNotificationsRead = async (studentId) => {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('student_id', studentId)
    .eq('is_read', false);

  if (error) throw new Error(error.message);
};

// Get unread count for a student
export const getUnreadCount = async (studentId) => {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
};

export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: 'announcement',
  FEE_REMINDER: 'fee_reminder',
  SEAT_CHANGE: 'seat_change',
  COMPLAINT_UPDATE: 'complaint_update',
  MEMBERSHIP_EXPIRY: 'membership_expiry',
  MEMBERSHIP_SUSPENDED: 'membership_suspended',
  RENEWAL_REMINDER: 'renewal_reminder',
  PAYMENT_SUCCESS: 'payment_success',
  PAYMENT_FAILED: 'payment_failed',
  GENERAL: 'general',
};
