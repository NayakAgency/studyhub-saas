-- ============================================================
-- StudyHub SaaS Platform - Migration 004: Indexes (Performance)
-- ============================================================

-- Tenants
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_owner_email ON tenants(owner_email);

-- Hall Admins
CREATE INDEX idx_hall_admins_tenant ON hall_admins(tenant_id);
CREATE INDEX idx_hall_admins_user ON hall_admins(user_id);

-- Sections
CREATE INDEX idx_sections_tenant ON sections(tenant_id, is_active);

-- Seats
CREATE INDEX idx_seats_tenant ON seats(tenant_id);
CREATE INDEX idx_seats_section ON seats(section_id);
CREATE INDEX idx_seats_status ON seats(tenant_id, status);

-- Students
CREATE INDEX idx_students_tenant ON students(tenant_id);
CREATE INDEX idx_students_phone ON students(tenant_id, phone);
CREATE INDEX idx_students_status ON students(tenant_id, status);
CREATE INDEX idx_students_user ON students(user_id);
CREATE INDEX idx_students_code ON students(student_code);

-- Memberships
CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX idx_memberships_student ON memberships(student_id);
CREATE INDEX idx_memberships_end_date ON memberships(tenant_id, end_date);
CREATE INDEX idx_memberships_expiry ON memberships(end_date) WHERE status = 'active';
CREATE INDEX idx_memberships_status ON memberships(tenant_id, status);

-- Payments
CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_student ON payments(student_id, tenant_id);
CREATE INDEX idx_payments_receipt ON payments(tenant_id, receipt_number);
CREATE INDEX idx_payments_date ON payments(tenant_id, payment_date DESC);

-- Seat Booking Requests
CREATE INDEX idx_seat_booking_status ON seat_booking_requests(tenant_id, status);
CREATE INDEX idx_seat_booking_student ON seat_booking_requests(student_id);

-- Seat Change Requests
CREATE INDEX idx_seat_change_tenant ON seat_change_requests(tenant_id, status);
CREATE INDEX idx_seat_change_student ON seat_change_requests(student_id);

-- Announcements
CREATE INDEX idx_announcements_tenant ON announcements(tenant_id, created_at DESC);
CREATE INDEX idx_announcements_pinned ON announcements(tenant_id, is_pinned) WHERE is_pinned = true;

-- Complaints
CREATE INDEX idx_complaints_tenant ON complaints(tenant_id);
CREATE INDEX idx_complaints_status ON complaints(tenant_id, status);
CREATE INDEX idx_complaints_student ON complaints(student_id);

-- Suggestions
CREATE INDEX idx_suggestions_tenant ON suggestions(tenant_id, created_at DESC);

-- Study Resources
CREATE INDEX idx_resources_tenant ON study_resources(tenant_id, is_active);

-- Waiting List
CREATE INDEX idx_waiting_list_tenant ON waiting_list(tenant_id, status);

-- Renewal Requests
CREATE INDEX idx_renewal_requests_tenant ON renewal_requests(tenant_id);
CREATE INDEX idx_renewal_requests_status ON renewal_requests(tenant_id, status);
CREATE INDEX idx_renewal_requests_student ON renewal_requests(student_id);

-- Notifications
CREATE INDEX idx_notifications_student_unread ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id, created_at DESC);

-- Hall Gallery
CREATE INDEX idx_gallery_tenant ON hall_gallery(tenant_id, display_order);

-- Contact Inquiries
CREATE INDEX idx_contact_inquiries_tenant ON contact_inquiries(tenant_id, is_read, created_at DESC);

-- Platform Announcements
CREATE INDEX idx_platform_announcements_active ON platform_announcements(is_active, expires_at);

-- Auth Lockouts
CREATE INDEX idx_auth_lockouts_identifier ON auth_lockouts(identifier);

-- Refresh Tokens
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id, is_revoked);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at) WHERE is_revoked = false;

-- Audit Logs
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Super Admin Billing
CREATE INDEX idx_billing_tenant ON super_admin_billing(tenant_id);
CREATE INDEX idx_billing_status ON super_admin_billing(status);
