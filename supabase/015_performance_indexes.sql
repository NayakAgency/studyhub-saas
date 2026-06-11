-- ============================================================
-- StudyHub SaaS — Performance Indexes & Optimizations
-- Migration 015: Comprehensive indexes for all query patterns
-- Run ONCE after COMPLETE_SETUP.sql
-- Safe: uses CREATE INDEX IF NOT EXISTS (idempotent)
-- ============================================================

-- ── tenants ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email  ON tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_type    ON tenants(plan_type);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at   ON tenants(created_at DESC);

-- ── students ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_students_tenant_id        ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant_status    ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_tenant_phone     ON students(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_students_user_id          ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_assigned_seat    ON students(assigned_seat_id);
CREATE INDEX IF NOT EXISTS idx_students_status           ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_created_at       ON students(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_students_registered_at    ON students(registered_at DESC);
-- Full-text search on student name/phone/code
CREATE INDEX IF NOT EXISTS idx_students_fulltext
  ON students USING gin(to_tsvector('english', full_name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(student_code, '')));

-- ── seats ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seats_tenant_id          ON seats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_section     ON seats(tenant_id, section_id);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_status      ON seats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_section_id         ON seats(section_id);
CREATE INDEX IF NOT EXISTS idx_seats_status             ON seats(status);

-- ── sections ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sections_tenant_id       ON sections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sections_tenant_order    ON sections(tenant_id, display_order);

-- ── memberships ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id    ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_student_id   ON memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_status ON memberships(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date     ON memberships(end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_active_dates ON memberships(tenant_id, status, end_date)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_seat_id      ON memberships(seat_id);

-- ── payments ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id       ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id      ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_date     ON payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status          ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_utr_number      ON payments(utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_tenant_method   ON payments(tenant_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_membership_id   ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at      ON payments(created_at DESC);

-- ── complaints ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_id     ON complaints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_student_id    ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_status ON complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at    ON complaints(created_at DESC);

-- ── announcements ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_id  ON announcements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant_pinned ON announcements(tenant_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at) WHERE expires_at IS NOT NULL;

-- ── notifications ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notifications_student_id ON notifications(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id  ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread     ON notifications(student_id, is_read, created_at DESC)
  WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ── subscription_plans ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_plans_tenant_id          ON subscription_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plans_tenant_active      ON subscription_plans(tenant_id, is_active);

-- ── seat_booking_requests ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id       ON seat_booking_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_student_id      ON seat_booking_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status   ON seat_booking_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at      ON seat_booking_requests(created_at DESC);

-- ── seat_change_requests ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_seat_changes_tenant_id   ON seat_change_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seat_changes_tenant_status ON seat_change_requests(tenant_id, status);

-- ── renewal_requests ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_renewals_tenant_id       ON renewal_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renewals_student_id      ON renewal_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_renewals_tenant_status   ON renewal_requests(tenant_id, status);

-- ── audit_logs ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_tenant_id          ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id            ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at         ON audit_logs(created_at DESC);
-- Partition by time range for fast filtered queries
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time        ON audit_logs(tenant_id, created_at DESC);

-- ── refresh_tokens ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tokens_user_id           ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_user_active       ON refresh_tokens(user_id, is_revoked, expires_at)
  WHERE is_revoked = false;

-- ── auth_lockouts ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_lockouts_identifier      ON auth_lockouts(identifier);
CREATE INDEX IF NOT EXISTS idx_lockouts_locked_until    ON auth_lockouts(locked_until) WHERE locked_until IS NOT NULL;

-- ── hall_settings ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hall_settings_tenant_id  ON hall_settings(tenant_id);

-- ── hall_admins ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hall_admins_tenant_id    ON hall_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_user_id      ON hall_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_active       ON hall_admins(user_id, is_active) WHERE is_active = true;

-- ── suggestions ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant_id    ON suggestions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant_status ON suggestions(tenant_id, status);

-- ── contact_inquiries ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inquiries_tenant_id      ON contact_inquiries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_unread         ON contact_inquiries(tenant_id, is_read) WHERE is_read = false;

-- ── hall_gallery ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_gallery_tenant_id        ON hall_gallery(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant_active    ON hall_gallery(tenant_id, is_active, display_order);

-- ── hall_faqs ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_id           ON hall_faqs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_faqs_tenant_active       ON hall_faqs(tenant_id, is_active, display_order);

-- ── waiting_list ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_waiting_tenant_id        ON waiting_list(tenant_id);
CREATE INDEX IF NOT EXISTS idx_waiting_tenant_status    ON waiting_list(tenant_id, status);

-- ── student_activity_logs ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_activity_student_id      ON student_activity_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_tenant_id       ON student_activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_created_at      ON student_activity_logs(created_at DESC);

-- ── used_utrs ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_used_utrs_utr_number     ON used_utrs(utr_number);
CREATE INDEX IF NOT EXISTS idx_used_utrs_tenant_id      ON used_utrs(tenant_id);

-- ── hall_inquiries ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_status    ON hall_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_created   ON hall_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_unread    ON hall_inquiries(is_read) WHERE is_read = false;

-- ── super_admin_billing ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sa_billing_tenant_id     ON super_admin_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sa_billing_status        ON super_admin_billing(status);

-- ============================================================
-- MATERIALIZED VIEWS for fast dashboard queries
-- ============================================================

-- Tenant summary stats (refreshed every 15 mins by cron or on-demand)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_stats AS
SELECT
  t.id AS tenant_id,
  t.hall_name,
  t.slug,
  t.status,
  t.plan_type,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active')    AS active_students,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'pending')   AS pending_students,
  COUNT(DISTINCT s.id)                                        AS total_students,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'available') AS available_seats,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status = 'occupied')  AS occupied_seats,
  COUNT(DISTINCT se.id)                                       AS total_seats,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'
    AND p.payment_date >= DATE_TRUNC('month', NOW())), 0)     AS revenue_this_month,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) AS total_revenue
FROM tenants t
LEFT JOIN students s   ON s.tenant_id = t.id
LEFT JOIN seats se     ON se.tenant_id = t.id
LEFT JOIN payments p   ON p.tenant_id = t.id
GROUP BY t.id, t.hall_name, t.slug, t.status, t.plan_type
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_stats_id ON mv_tenant_stats(tenant_id);

-- Platform-wide KPI summary for super admin dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_kpis AS
SELECT
  COUNT(DISTINCT t.id)                           AS total_halls,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status = 'active') AS active_halls,
  COUNT(DISTINCT s.id)                           AS total_students,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'active') AS active_students,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'
    AND p.payment_date >= DATE_TRUNC('month', NOW())), 0) AS monthly_revenue,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) AS total_revenue,
  NOW() AS last_refreshed
FROM tenants t
LEFT JOIN students s ON s.tenant_id = t.id
LEFT JOIN payments p ON p.tenant_id = t.id
WITH DATA;

-- ============================================================
-- FUNCTION: Refresh materialized views (called by cron / on-demand)
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_kpis;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail if already refreshing
  NULL;
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- Multi-tenant isolation at DB level
-- ============================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE students              ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints            ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_gallery          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_faqs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_change_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list          ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_resources       ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by backend)
-- The policies below apply to anon/authenticated roles only

-- Helper function: get tenant_id for current authenticated user
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT tenant_id FROM hall_admins
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

-- Drop existing policies to avoid conflicts
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'students','seats','sections','memberships','payments',
    'subscription_plans','announcements','complaints','suggestions',
    'notifications','hall_settings','hall_gallery','hall_faqs',
    'contact_inquiries','seat_booking_requests','seat_change_requests',
    'renewal_requests','waiting_list','study_resources'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_read ON %I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS student_own ON %I', tbl);
  END LOOP;
END;
$$;

-- Tenant isolation policy for hall admins
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON seats
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON sections
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON subscription_plans
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON announcements
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON complaints
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON suggestions
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON hall_settings
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON hall_gallery
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON hall_faqs
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON contact_inquiries
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON seat_booking_requests
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON seat_change_requests
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON renewal_requests
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON waiting_list
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');
CREATE POLICY tenant_isolation ON study_resources
  USING (tenant_id = current_tenant_id() OR auth.role() = 'service_role');

-- Student can read their own notifications
CREATE POLICY student_own ON notifications
  USING (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- ============================================================
-- CLEANUP: Auto-delete old data to control table size
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete read notifications older than 90 days
  DELETE FROM notifications
  WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days';

  -- Delete revoked refresh tokens older than 30 days
  DELETE FROM refresh_tokens
  WHERE is_revoked = true AND created_at < NOW() - INTERVAL '30 days';

  -- Delete expired auth lockouts
  DELETE FROM auth_lockouts
  WHERE locked_until < NOW() OR (locked_until IS NULL AND last_attempt < NOW() - INTERVAL '24 hours');

  -- Archive old audit logs (keep 6 months)
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '180 days';

  -- Delete old student activity logs (keep 30 days)
  DELETE FROM student_activity_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Delete expired ML predictions
  DELETE FROM ml_predictions_cache
  WHERE expires_at < NOW();
END;
$$;

-- ============================================================
-- PLATFORM SETTINGS: Default values for new installation
-- ============================================================
INSERT INTO platform_settings (key, value) VALUES
  ('app_name',          'StudyHub'),
  ('app_version',       '1.0.0'),
  ('maintenance_mode',  'false'),
  ('max_seats_standard', '100'),
  ('max_seats_premium',  '500'),
  ('max_seats_enterprise', '9999'),
  ('support_email',     'support@studyhub.app'),
  ('onboarding_complete', 'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- GRANT permissions for service role
-- ============================================================
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================================
-- DONE — Performance optimization migration complete
-- ============================================================
SELECT 'Migration 015 complete: ' || COUNT(*) || ' indexes verified' AS status
FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
