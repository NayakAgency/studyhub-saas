// ============================================================
// StudyHub — Shared JSDoc Type Definitions
// These are used as documentation / intellisense hints
// Not TypeScript — pure JSDoc for JS projects
// ============================================================

/**
 * @typedef {Object} Tenant
 * @property {string} id
 * @property {string} hall_name
 * @property {string} slug
 * @property {string} owner_name
 * @property {string} owner_email
 * @property {string} owner_phone
 * @property {string} [address]
 * @property {string} [city]
 * @property {string} [logo_url]
 * @property {string} theme_color
 * @property {'active'|'suspended'|'trial'|'pending'} status
 * @property {'standard'|'premium'|'enterprise'} plan_type
 * @property {string} created_at
 */

/**
 * @typedef {Object} Student
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} user_id
 * @property {string} student_code
 * @property {string} full_name
 * @property {string} phone
 * @property {string} [email]
 * @property {'pending'|'active'|'inactive'|'suspended'|'rejected'} status
 * @property {string} [profile_photo_url]
 * @property {string} [assigned_seat_id]
 * @property {string} registered_at
 */

/**
 * @typedef {Object} Membership
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} student_id
 * @property {string} plan_id
 * @property {string} seat_id
 * @property {string} start_date
 * @property {string} end_date
 * @property {'active'|'expired'|'cancelled'|'pending'} status
 */

/**
 * @typedef {Object} Payment
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} student_id
 * @property {number} amount
 * @property {'cash'|'upi'} payment_method
 * @property {string} [utr_number]
 * @property {string} payment_date
 * @property {string} receipt_number
 * @property {'pending'|'verified'|'rejected'} status
 */

/**
 * @typedef {Object} Seat
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} section_id
 * @property {string} seat_number
 * @property {'available'|'occupied'|'blocked'|'reserved'|'maintenance'} status
 * @property {'standard'|'premium'|'cabin'} seat_type
 */

/**
 * @typedef {Object} Complaint
 * @property {string} id
 * @property {string} complaint_number
 * @property {'seat'|'facility'|'staff'|'payment'|'cleanliness'|'other'} category
 * @property {string} subject
 * @property {string} description
 * @property {'open'|'in_progress'|'resolved'|'closed'} status
 * @property {'low'|'normal'|'high'|'urgent'} priority
 * @property {string} [admin_response]
 */

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {'super_admin'|'hall_admin'|'student'} role
 * @property {string} [tenant_id]
 * @property {string} [student_id]
 * @property {string} fullName
 * @property {string} email
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {Array} data
 * @property {{ page: number, limit: number, total: number, pages: number }} pagination
 */
