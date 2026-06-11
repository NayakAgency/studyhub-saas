-- ============================================================
-- StudyHub SaaS Platform - Migration 003: RLS Policies
-- ============================================================

-- ============================================================
-- Enable RLS on ALL tables
-- ============================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_lockouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TENANTS
-- ============================================================
CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_tenant" ON tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
  );

-- Public read for active tenants (for public website)
CREATE POLICY "public_read_active_tenants" ON tenants
  FOR SELECT USING (status = 'active');

-- ============================================================
-- SUPER_ADMINS
-- ============================================================
CREATE POLICY "super_admin_self" ON super_admins
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- HALL_ADMINS
-- ============================================================
CREATE POLICY "super_admin_all_hall_admins" ON hall_admins
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_record" ON hall_admins
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- SECTIONS
-- ============================================================
CREATE POLICY "super_admin_all_sections" ON sections
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_sections" ON sections
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_sections" ON sections
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "public_read_sections" ON sections
  FOR SELECT USING (is_active = true);

-- ============================================================
-- SEATS
-- ============================================================
CREATE POLICY "super_admin_all_seats" ON seats
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_seats" ON seats
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_seats" ON seats
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
  );

CREATE POLICY "public_read_available_seats" ON seats
  FOR SELECT USING (status = 'available');

-- ============================================================
-- SUBSCRIPTION_PLANS
-- ============================================================
CREATE POLICY "super_admin_all_plans" ON subscription_plans
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_plans" ON subscription_plans
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_plans" ON subscription_plans
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
    AND is_active = true
  );

CREATE POLICY "public_read_plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE POLICY "super_admin_all_students" ON students
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_students" ON students
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_record" ON students
  FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
CREATE POLICY "super_admin_all_memberships" ON memberships
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_memberships" ON memberships
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_memberships" ON memberships
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE POLICY "super_admin_all_payments" ON payments
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_payments" ON payments
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_payments" ON payments
  FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- SEAT_BOOKING_REQUESTS
-- ============================================================
CREATE POLICY "super_admin_all_booking_requests" ON seat_booking_requests
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_booking_requests" ON seat_booking_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_booking_requests" ON seat_booking_requests
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- SEAT_CHANGE_REQUESTS
-- ============================================================
CREATE POLICY "super_admin_all_seat_change" ON seat_change_requests
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_seat_change" ON seat_change_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_seat_change" ON seat_change_requests
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================
CREATE POLICY "super_admin_all_announcements" ON announcements
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_announcements" ON announcements
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_announcements" ON announcements
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- ============================================================
-- COMPLAINTS
-- ============================================================
CREATE POLICY "super_admin_all_complaints" ON complaints
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_complaints" ON complaints
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_complaints" ON complaints
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- SUGGESTIONS
-- ============================================================
CREATE POLICY "super_admin_all_suggestions" ON suggestions
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_suggestions" ON suggestions
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_suggestions" ON suggestions
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- STUDY_RESOURCES
-- ============================================================
CREATE POLICY "super_admin_all_resources" ON study_resources
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_resources" ON study_resources
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_resources" ON study_resources
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
    AND is_active = true
  );

-- ============================================================
-- WAITING_LIST
-- ============================================================
CREATE POLICY "super_admin_all_waiting_list" ON waiting_list
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_waiting_list" ON waiting_list
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- RENEWAL_REQUESTS
-- ============================================================
CREATE POLICY "super_admin_all_renewals" ON renewal_requests
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_renewals" ON renewal_requests
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_renewals" ON renewal_requests
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- HALL_SETTINGS
-- ============================================================
CREATE POLICY "super_admin_all_settings" ON hall_settings
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_settings" ON hall_settings
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_read_settings" ON hall_settings
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- SUPER_ADMIN_BILLING
-- ============================================================
CREATE POLICY "super_admin_all_billing" ON super_admin_billing
  FOR ALL USING (is_super_admin());

-- ============================================================
-- AUDIT_LOGS
-- ============================================================
CREATE POLICY "super_admin_all_audit_logs" ON audit_logs
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_audit_logs" ON audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "super_admin_all_notifications" ON notifications
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_notifications" ON notifications
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "student_own_notifications" ON notifications
  FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
  );

-- ============================================================
-- HALL_GALLERY
-- ============================================================
CREATE POLICY "super_admin_all_gallery" ON hall_gallery
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_gallery" ON hall_gallery
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "public_read_gallery" ON hall_gallery
  FOR SELECT USING (is_active = true);

-- ============================================================
-- CONTACT_INQUIRIES
-- ============================================================
CREATE POLICY "super_admin_all_inquiries" ON contact_inquiries
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_own_inquiries" ON contact_inquiries
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid())
  );

-- Public can insert (contact form)
CREATE POLICY "public_insert_inquiries" ON contact_inquiries
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- PLATFORM_ANNOUNCEMENTS
-- ============================================================
CREATE POLICY "super_admin_all_platform_announcements" ON platform_announcements
  FOR ALL USING (is_super_admin());

CREATE POLICY "hall_admin_read_platform_announcements" ON platform_announcements
  FOR SELECT USING (
    is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND EXISTS (SELECT 1 FROM hall_admins WHERE user_id = auth.uid())
  );

-- ============================================================
-- AUTH_LOCKOUTS
-- ============================================================
CREATE POLICY "service_role_only_lockouts" ON auth_lockouts
  FOR ALL USING (false); -- Only accessed via service role key

-- ============================================================
-- REFRESH_TOKENS
-- ============================================================
CREATE POLICY "user_own_refresh_tokens" ON refresh_tokens
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "super_admin_all_refresh_tokens" ON refresh_tokens
  FOR ALL USING (is_super_admin());
