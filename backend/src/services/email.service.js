// ============================================================
// Email Service — Supabase Auth (built-in) + In-App only
//
// Transactional auth emails (password reset, signup confirm,
// magic links) are handled entirely by Supabase Auth using
// the built-in email templates configured in the Supabase
// Dashboard → Authentication → Email Templates.
//
// Application notification emails (fee reminders, receipts,
// etc.) are delivered as in-app notifications only.
// No third-party email SDK (Resend, SendGrid, etc.) is used.
//
// To customise email templates:
//   Supabase Dashboard → Authentication → Email Templates
// To configure SMTP:
//   Supabase Dashboard → Authentication → Settings → SMTP
// ============================================================

// ── Dev helper — logs email intent to console ─────────────────
const devLog = (to, subject) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[EMAIL-INTENT] ${subject} → ${to} (delivered as in-app notification)`);
  }
};

// ── Tenant Welcome ────────────────────────────────────────────
// Supabase automatically sends a "Confirm signup" email when
// the hall admin account is created. The temp password is
// returned to the super-admin UI directly — no email needed.
export const sendTenantWelcomeEmail = async ({
  ownerEmail, ownerName, hallName,
}) => {
  devLog(ownerEmail, `Welcome — ${hallName} is live`);
  // Supabase Auth handles the confirmation email automatically.
};

// ── Student Application Approved ─────────────────────────────
// Approval notification is sent as an in-app notification
// via notification.service.js (NOTIFICATION_TYPES.GENERAL).
export const sendStudentApprovedEmail = async ({
  studentEmail, studentName, hallName,
}) => {
  if (studentEmail) devLog(studentEmail, `Seat approved at ${hallName}`);
};

// ── Renewal Reminder ──────────────────────────────────────────
// Delivered as in-app notification via renewal-reminder cron.
export const sendRenewalReminderEmail = async ({
  studentEmail, hallName, daysLeft,
}) => {
  if (studentEmail) devLog(studentEmail, `Renewal reminder — ${daysLeft}d — ${hallName}`);
};

// ── Fee Reminder ──────────────────────────────────────────────
// Delivered as in-app notification via fee-reminder cron.
export const sendFeeReminderEmail = async ({
  studentEmail, hallName, isOverdue, daysUntilDue,
}) => {
  if (studentEmail) {
    const subject = isOverdue
      ? `Fee overdue — ${hallName}`
      : `Fee due in ${daysUntilDue}d — ${hallName}`;
    devLog(studentEmail, subject);
  }
};

// ── Contact Inquiry (to hall admin) ──────────────────────────
// Delivered as in-app notification + visible in admin panel.
export const sendContactInquiryNotification = async ({
  adminEmail, inquiryName, hallName,
}) => {
  if (adminEmail) devLog(adminEmail, `New contact inquiry — ${hallName} from ${inquiryName}`);
};

// ── Payment Receipt ───────────────────────────────────────────
// Receipt is available in-app at /:slug/fees.
// Delivered as in-app payment success notification.
export const sendPaymentReceiptEmail = async ({
  studentEmail, receiptNumber, hallName,
}) => {
  if (studentEmail) devLog(studentEmail, `Receipt #${receiptNumber} — ${hallName}`);
};

// ── Admin-created Student Welcome ────────────────────────────
// Supabase Auth sends a confirm email. Temp password shown
// in the admin UI — no separate email required.
export const sendStudentWelcomeEmail = async ({
  studentEmail, hallName,
}) => {
  if (studentEmail) devLog(studentEmail, `Account ready at ${hallName}`);
};
