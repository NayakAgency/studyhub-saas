// ============================================================
// StudyHub — Shared Constants
// Used by both frontend and backend (via copy or npm workspace)
// ============================================================

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  HALL_ADMIN:  'hall_admin',
  STUDENT:     'student',
};

export const SEAT_STATUSES = {
  AVAILABLE:   'available',
  OCCUPIED:    'occupied',
  BLOCKED:     'blocked',
  RESERVED:    'reserved',
  MAINTENANCE: 'maintenance',
};

export const STUDENT_STATUSES = {
  PENDING:   'pending',
  ACTIVE:    'active',
  INACTIVE:  'inactive',
  SUSPENDED: 'suspended',
  REJECTED:  'rejected',
};

export const MEMBERSHIP_STATUSES = {
  ACTIVE:    'active',
  EXPIRED:   'expired',
  CANCELLED: 'cancelled',
  PENDING:   'pending',
};

export const PAYMENT_METHODS = {
  CASH: 'cash',
  UPI:  'upi',
};

export const PLAN_TYPES = {
  SLOT_BASED:  'slot_based',
  FULL_DAY:    'full_day',
  OPEN_HOURS:  'open_hours',
};

export const VALIDITY_TYPES = {
  DAILY:   'daily',
  WEEKLY:  'weekly',
  MONTHLY: 'monthly',
  CUSTOM:  'custom',
};

export const COMPLAINT_STATUSES = {
  OPEN:        'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED:    'resolved',
  CLOSED:      'closed',
};

export const COMPLAINT_CATEGORIES = {
  SEAT:        'seat',
  FACILITY:    'facility',
  STAFF:       'staff',
  PAYMENT:     'payment',
  CLEANLINESS: 'cleanliness',
  OTHER:       'other',
};

export const TENANT_STATUSES = {
  ACTIVE:    'active',
  SUSPENDED: 'suspended',
  TRIAL:     'trial',
  PENDING:   'pending',
};

export const PLAN_TIERS = {
  STANDARD:   'standard',
  PREMIUM:    'premium',
  ENTERPRISE: 'enterprise',
};

export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT:     'announcement',
  FEE_REMINDER:     'fee_reminder',
  SEAT_CHANGE:      'seat_change',
  COMPLAINT_UPDATE: 'complaint_update',
  MEMBERSHIP_EXPIRY: 'membership_expiry',
  RENEWAL_REMINDER: 'renewal_reminder',
  GENERAL:          'general',
};

export const BOOKING_STATUSES = {
  PENDING:   'pending',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  CANCELLED: 'cancelled',
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE:  1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT:     100,
};

// File upload limits
export const FILE_LIMITS = {
  IMAGE_MAX_BYTES: 5 * 1024 * 1024,   // 5 MB
  PDF_MAX_BYTES:   10 * 1024 * 1024,  // 10 MB
  GALLERY_MAX:     10,                 // max images per upload
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOC_TYPES:   ['application/pdf'],
};

// Password policy
export const PASSWORD_POLICY = {
  MIN_LENGTH:         8,
  REQUIRE_UPPERCASE:  true,
  REQUIRE_NUMBER:     true,
};

// Auth lockout
export const AUTH_LOCKOUT = {
  MAX_ATTEMPTS:    5,
  LOCKOUT_MINUTES: 15,
};
