-- ============================================================
-- StudyHub SaaS — Migration 016: Final Optimizations
-- Merges performance indexes, mat-view refreshers, and
-- backfill helpers not in COMPLETE_SETUP.sql.
-- Safe to run AFTER COMPLETE_SETUP.sql + 015_performance_indexes.sql
-- Fully idempotent (IF NOT EXISTS / ON CONFLICT guards).
-- ============================================================

-- ── 1. Missing composite indexes not covered by 015 ──────────

-- Fast lookup: memberships expiring in a date window (cron jobs)
CREATE INDEX IF NOT EXISTS idx_memberships_expiry_window
  ON memberships(tenant_id, end_date)
  WHERE status = 'active';

-- Fast student full-text search (name + phone + code)
CREATE INDEX IF NOT EXISTS idx_students_fulltext_search
  ON students
  USING gin(to_tsvector('english',
    full_name || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(student_code, '')
  ));

-- Partial: only pending bookings (the hot path for admins)
CREATE INDEX IF NOT EXISTS idx_sbr_pending_hot
  ON seat_booking_requests(tenant_id, created_at DESC)
  WHERE status = 'pending';

-- Partial: only unread notifications (student dashboard badge count)
CREATE INDEX IF NOT EXISTS idx_notifications_unread_hot
  ON notifications(student_id, created_at DESC)
  WHERE is_read = false;

-- payment_date range scans (reports, analytics)
CREATE INDEX IF NOT EXISTS idx_payments_date_range
  ON payments(tenant_id, payment_date, status);

-- ── 2. Additional materialized views ─────────────────────────

-- Per-tenant seat occupancy (refreshed by cron / on-demand)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_tenant_stats'
  ) THEN
    EXECUTE $SQL$
      CREATE MATERIALIZED VIEW mv_tenant_stats AS
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
        COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) AS total_revenue,
        NOW() AS last_refreshed
      FROM tenants t
      LEFT JOIN students s   ON s.tenant_id = t.id
      LEFT JOIN seats se     ON se.tenant_id = t.id
      LEFT JOIN payments p   ON p.tenant_id = t.id
      GROUP BY t.id, t.hall_name, t.slug, t.status, t.plan_type
      WITH DATA
    $SQL$;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_stats_id
  ON mv_tenant_stats(tenant_id);

-- Platform-wide KPI summary for super-admin dashboard
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'mv_platform_kpis'
  ) THEN
    EXECUTE $SQL$
      CREATE MATERIALIZED VIEW mv_platform_kpis AS
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
      WITH DATA
    $SQL$;
  END IF;
END $$;

-- ── 3. Unified view refresher ─────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_all_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Core analytics views (from COMPLETE_SETUP.sql)
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW daily_occupancy_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_revenue_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_membership_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_membership_stats; END;

  -- Dashboard summary views (from 015)
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW mv_tenant_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_kpis;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW mv_platform_kpis; END;
END;
$$;

-- ── 4. Improved cleanup function ─────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Read notifications older than 90 days
  DELETE FROM notifications
  WHERE is_read = true AND created_at < NOW() - INTERVAL '90 days';

  -- All notifications older than 6 months
  DELETE FROM notifications
  WHERE created_at < NOW() - INTERVAL '6 months';

  -- Revoked / expired refresh tokens
  DELETE FROM refresh_tokens
  WHERE is_revoked = true AND created_at < NOW() - INTERVAL '30 days';
  DELETE FROM refresh_tokens
  WHERE expires_at < NOW();

  -- Expired auth lockouts
  DELETE FROM auth_lockouts
  WHERE locked_until < NOW()
     OR (locked_until IS NULL AND last_attempt < NOW() - INTERVAL '24 hours');

  -- Audit logs older than 6 months
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '180 days';

  -- Student activity logs older than 30 days
  DELETE FROM student_activity_logs
  WHERE created_at < NOW() - INTERVAL '30 days';

  -- Expired ML prediction cache
  DELETE FROM ml_predictions_cache
  WHERE expires_at < NOW();

  -- Old system logs
  DELETE FROM system_logs
  WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$;

-- ── 5. Platform settings (defaults, safe insert) ─────────────
INSERT INTO platform_settings (key, value) VALUES
  ('app_name',             'StudyHub'),
  ('app_version',          '2.0.0'),
  ('maintenance_mode',     'false'),
  ('max_seats_standard',   '100'),
  ('max_seats_premium',    '500'),
  ('max_seats_enterprise', '9999'),
  ('support_email',        'support@studyhub.app'),
  ('onboarding_complete',  'true')
ON CONFLICT (key) DO NOTHING;

-- ── 6. Service-role grants ────────────────────────────────────
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON mv_tenant_stats  TO service_role;
GRANT SELECT ON mv_platform_kpis TO service_role;

-- ── Done ──────────────────────────────────────────────────────
SELECT
  '016 optimizations applied!' AS status,
  (SELECT COUNT(*) FROM pg_indexes  WHERE schemaname = 'public') AS total_indexes,
  (SELECT COUNT(*) FROM pg_matviews WHERE schemaname = 'public') AS materialized_views,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') AS rls_policies;
