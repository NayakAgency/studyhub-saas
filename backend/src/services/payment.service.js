// ============================================================
// Payment Service
// UPI (with UTR) and Cash — no external payment gateway
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';
import { sendPaymentReceiptEmail } from './email.service.js';
import { createNotification, NOTIFICATION_TYPES } from './notification.service.js';
import { broadcastPaymentUpdate } from './websocket.service.js';

// ── Allowed payment methods per role ─────────────────────────
export const STUDENT_PAYMENT_METHODS = ['upi'];
export const ADMIN_PAYMENT_METHODS   = ['upi', 'cash'];

// ── Validation helpers ────────────────────────────────────────

export const validatePaymentMethod = (method, role = 'student') => {
  const allowed = role === 'admin' ? ADMIN_PAYMENT_METHODS : STUDENT_PAYMENT_METHODS;
  if (!allowed.includes(method)) {
    throw new Error(
      `Invalid payment method "${method}". Allowed: ${allowed.join(', ')}`
    );
  }
};

// UPI payments require a UTR number
export const validateUTR = (method, utrNumber) => {
  if (method === 'upi' && !utrNumber?.trim()) {
    throw new Error('UTR number is required for UPI payments');
  }
  if (utrNumber && !/^[A-Z0-9]{12,22}$/i.test(utrNumber.trim())) {
    throw new Error('Invalid UTR number format (12–22 alphanumeric characters)');
  }
};

// ── Record a payment (admin) ───────────────────────────────────

export const recordAdminPayment = async ({
  tenantId,
  studentId,
  membershipId,
  amount,
  paymentMethod,   // 'upi' | 'cash'
  utrNumber,
  screenshotUrl,
  paymentDate,
  notes,
  adminId,
  sendReceipt = false,
}) => {
  validatePaymentMethod(paymentMethod, 'admin');
  validateUTR(paymentMethod, utrNumber);

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      tenant_id:              tenantId,
      student_id:             studentId,
      membership_id:          membershipId || null,
      amount,
      payment_method:         paymentMethod,
      utr_number:             utrNumber?.trim() || null,
      payment_screenshot_url: screenshotUrl || null,
      payment_date:           paymentDate || new Date().toISOString().split('T')[0],
      status:                 'verified',
      notes:                  notes || null,
      recorded_by:            adminId,
      metadata: { recorded_by_admin: true, admin_id: adminId },
    })
    .select(`
      *,
      student:students(full_name, email),
      tenant:tenants(hall_name, slug)
    `)
    .single();

  if (error) throw new Error(error.message);

  // Send receipt email
  if (sendReceipt && payment.student?.email) {
    const { data: settings } = await supabaseAdmin
      .from('hall_settings')
      .select('currency_symbol')
      .eq('tenant_id', tenantId)
      .single();

    await sendPaymentReceiptEmail({
      studentEmail:  payment.student.email,
      studentName:   payment.student.full_name,
      receiptNumber: payment.receipt_number,
      amount:        payment.amount,
      paymentMethod: paymentMethod === 'cash' ? 'Cash' : `UPI (UTR: ${utrNumber})`,
      hallName:      payment.tenant?.hall_name || 'Study Hall',
      currencySymbol: settings?.currency_symbol || '₹',
      paymentDate:   payment.payment_date,
      slug:          payment.tenant?.slug,
    });
  }

  // Notify student
  await createNotification({
    tenantId,
    studentId,
    type:  NOTIFICATION_TYPES.PAYMENT_SUCCESS,
    title: 'Payment Recorded',
    body:  `Your payment of ₹${amount} has been recorded successfully.`,
    referenceId:   payment.id,
    referenceType: 'payment',
  });

  // Broadcast live update
  broadcastPaymentUpdate(tenantId, {
    type:      'payment_recorded',
    paymentId: payment.id,
    studentId,
    amount,
  });

  return payment;
};

// ── Submit UPI payment request (student) ──────────────────────

export const submitStudentPayment = async ({
  tenantId,
  studentId,
  membershipId,
  amount,
  utrNumber,
  screenshotUrl,
  description,
}) => {
  validatePaymentMethod('upi', 'student');
  validateUTR('upi', utrNumber);

  // Insert with status 'pending' — admin will verify
  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .insert({
      tenant_id:              tenantId,
      student_id:             studentId,
      membership_id:          membershipId || null,
      amount,
      payment_method:         'upi',
      utr_number:             utrNumber.trim(),
      payment_screenshot_url: screenshotUrl || null,
      payment_date:           new Date().toISOString().split('T')[0],
      status:                 'pending',
      description:            description || 'Membership payment',
      metadata:               { submitted_by_student: true },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return payment;
};

// ── Verify / reject a student-submitted payment (admin) ────────

export const verifyStudentPayment = async ({
  paymentId,
  tenantId,
  adminId,
  action,        // 'verify' | 'reject'
  rejectReason,
  sendReceipt = false,
}) => {
  if (!['verify', 'reject'].includes(action)) {
    throw new Error('Action must be "verify" or "reject"');
  }

  const newStatus = action === 'verify' ? 'verified' : 'rejected';

  const { data: payment, error } = await supabaseAdmin
    .from('payments')
    .update({
      status:         newStatus,
      verified_by:    adminId,
      verified_at:    new Date().toISOString(),
      reject_reason:  action === 'reject' ? (rejectReason || 'Rejected by admin') : null,
    })
    .eq('id', paymentId)
    .eq('tenant_id', tenantId)
    .select(`
      *,
      student:students(full_name, email),
      tenant:tenants(hall_name, slug)
    `)
    .single();

  if (error) throw new Error(error.message);

  const notifType = action === 'verify'
    ? NOTIFICATION_TYPES.PAYMENT_SUCCESS
    : NOTIFICATION_TYPES.PAYMENT_FAILED;

  const notifBody = action === 'verify'
    ? `Your payment of ₹${payment.amount} has been verified.`
    : `Your payment of ₹${payment.amount} was rejected. ${rejectReason ? `Reason: ${rejectReason}` : ''}`;

  await createNotification({
    tenantId,
    studentId:     payment.student_id,
    type:          notifType,
    title:         action === 'verify' ? 'Payment Verified' : 'Payment Rejected',
    body:          notifBody,
    referenceId:   payment.id,
    referenceType: 'payment',
  });

  // Send receipt on verification
  if (action === 'verify' && sendReceipt && payment.student?.email) {
    const { data: settings } = await supabaseAdmin
      .from('hall_settings')
      .select('currency_symbol')
      .eq('tenant_id', tenantId)
      .single();

    await sendPaymentReceiptEmail({
      studentEmail:  payment.student.email,
      studentName:   payment.student.full_name,
      receiptNumber: payment.receipt_number,
      amount:        payment.amount,
      paymentMethod: `UPI (UTR: ${payment.utr_number})`,
      hallName:      payment.tenant?.hall_name || 'Study Hall',
      currencySymbol: settings?.currency_symbol || '₹',
      paymentDate:   payment.payment_date,
      slug:          payment.tenant?.slug,
    });
  }

  broadcastPaymentUpdate(tenantId, {
    type:      `payment_${newStatus}`,
    paymentId: payment.id,
    studentId: payment.student_id,
    amount:    payment.amount,
  });

  return payment;
};

// ── Payment statistics (admin dashboard) ─────────────────────

export const getPaymentStats = async (tenantId, startDate, endDate) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_payment_stats', {
      p_tenant_id:  tenantId,
      p_start_date: startDate,
      p_end_date:   endDate,
    });
    if (error) throw error;
    return data?.[0] || { total_amount: 0, total_count: 0, successful_count: 0, failed_count: 0, average_amount: 0 };
  } catch {
    return { total_amount: 0, total_count: 0, successful_count: 0, failed_count: 0, average_amount: 0 };
  }
};

// ── Student payment summary ───────────────────────────────────

export const getStudentPaymentSummary = async (tenantId, studentId) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_student_payment_summary', {
      p_tenant_id:  tenantId,
      p_student_id: studentId,
    });
    if (error) throw error;
    return data?.[0] || { total_paid: 0, payment_count: 0, last_payment_date: null, pending_amount: 0 };
  } catch {
    return { total_paid: 0, payment_count: 0, last_payment_date: null, pending_amount: 0 };
  }
};