// ============================================================
// Audit Logging Middleware
// Non-blocking async audit trail for all data mutations
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';

// Log an audit event (non-blocking)
export const logAudit = async ({
  tenantId,
  userId,
  userRole,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  req,
}) => {
  // Fire and forget - don't await, don't block response
  setImmediate(async () => {
    try {
      await supabaseAdmin.from('audit_logs').insert({
        tenant_id: tenantId || null,
        user_id: userId || null,
        user_role: userRole || null,
        action,
        resource_type: resourceType || null,
        resource_id: resourceId || null,
        old_values: oldValues || null,
        new_values: newValues || null,
        ip_address: req ? (req.ip || req.headers['x-forwarded-for'] || null) : null,
        user_agent: req ? (req.headers['user-agent'] || null) : null,
      });
    } catch (error) {
      // Audit failures should never crash the app
      console.error('Audit log failed:', error.message);
    }
  });
};

// Express middleware to inject audit logger into req
export const auditMiddleware = (req, res, next) => {
  req.logAudit = ({ action, resourceType, resourceId, oldValues, newValues }) => {
    logAudit({
      tenantId: req.user?.tenant_id,
      userId: req.user?.id,
      userRole: req.user?.role,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      req,
    });
  };
  next();
};

// Audit action constants
export const AUDIT_ACTIONS = {
  // Auth
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password_change',
  
  // Students
  STUDENT_CREATE: 'student.create',
  STUDENT_UPDATE: 'student.update',
  STUDENT_DELETE: 'student.delete',
  STUDENT_STATUS_CHANGE: 'student.status_change',
  STUDENT_ACTIVATE: 'student.activate',
  STUDENT_SUSPEND: 'student.suspend',

  // Seats
  SEAT_CREATE: 'seat.create',
  SEAT_UPDATE: 'seat.update',
  SEAT_BLOCK: 'seat.block',
  SEAT_ASSIGN: 'seat.assign',
  SEAT_BULK_GENERATE: 'seat.bulk_generate',

  // Payments
  PAYMENT_RECORD: 'payment.record',
  PAYMENT_VERIFY: 'payment.verify',
  PAYMENT_REJECT: 'payment.reject',
  PAYMENT_UPDATE: 'payment.update',
  PAYMENT_DELETE: 'payment.delete',

  // Memberships
  MEMBERSHIP_CREATE: 'membership.create',
  MEMBERSHIP_RENEW: 'membership.renew',
  MEMBERSHIP_CANCEL: 'membership.cancel',
  MEMBERSHIP_EXPIRE: 'membership.expire',

  // Applications
  APPLICATION_APPROVE: 'application.approve',
  APPLICATION_REJECT: 'application.reject',

  // Complaints
  COMPLAINT_CREATE: 'complaint.create',
  COMPLAINT_UPDATE: 'complaint.update',
  COMPLAINT_RESOLVE: 'complaint.resolve',

  // Announcements
  ANNOUNCEMENT_CREATE: 'announcement.create',
  ANNOUNCEMENT_UPDATE: 'announcement.update',
  ANNOUNCEMENT_DELETE: 'announcement.delete',

  // Tenant
  TENANT_CREATE: 'tenant.create',
  TENANT_UPDATE: 'tenant.update',
  TENANT_SUSPEND: 'tenant.suspend',
  TENANT_ACTIVATE: 'tenant.activate',
  TENANT_DELETE: 'tenant.delete',
};
