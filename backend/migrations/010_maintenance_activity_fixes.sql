-- ============================================================
-- Migration 010 — Maintenance Functions, Activity Log RLS,
--                 ML Cache RLS, Missing DB Helper Functions
-- Run in Supabase SQL Editor after migration 009
-- Safe to re-run (fully idempotent).
-- ============================================================

-- ── 1. RLS for student_activity_logs ─────────────────────────
ALTER TABLE student_activity_logs ENABLE ROW LEVEL SECURITY;

-- Hall admins can read their own tenant's activity logs
CREATE POLICY IF NOT EXISTS "admin_read_activity_logs" ON student_activity_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM hall_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Students can insert their own activity (service role bypasses this)
CREATE POLICY IF NOT EXISTS "student_insert_own_activity" ON student_activity_logs
  FOR INSERT WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE user_id = auth.uid()
    )
  );

-- ── 2. RLS for ml_predictions_cache ──────────────────────────
ALTER TABLE ml_predictions_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admin_read_ml_cache" ON ml_predictions_cache
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM hall_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ── 3. system_logs table already exists from base setup ──────
-- Ensure the error_details column exists (added in later migrations)
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS error_details TEXT;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ── 4. Maintenance helper functions ──────────────────────────

-- Get all user tables
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Analyze a single table
CREATE OR REPLACE FUNCTION analyze_table(table_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE 'ANALYZE ' || quote_ident(table_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ANALYZE all user tables (safe substitute for VACUUM inside transactions)
CREATE OR REPLACE FUNCTION vacuum_analyze_tables()
RETURNS void AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE 'ANALYZE ' || quote_ident(rec.schemaname) || '.' || quote_ident(rec.tablename);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO system_logs(log_type, message, error_details)
      VALUES ('maintenance_warning', 'Failed to analyze: ' || rec.tablename, SQLERRM);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Database health metrics
CREATE OR REPLACE FUNCTION get_database_health_metrics()
RETURNS TABLE (
  total_connections  INTEGER,
  active_connections INTEGER,
  database_size      TEXT,
  cache_hit_ratio    NUMERIC,
  deadlocks          BIGINT,
  temp_files         BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*)::INTEGER FROM pg_stat_activity),
    (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'active'),
    (SELECT pg_size_pretty(pg_database_size(current_database())))::TEXT,
    (SELECT ROUND(
       100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0),
       2
     ) FROM pg_stat_database WHERE datname = current_database()),
    (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()),
    (SELECT temp_files FROM pg_stat_database WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  table_name  TEXT,
  index_name  TEXT,
  index_scans BIGINT,
  rows_read   BIGINT,
  rows_fetched BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.relname::TEXT,
    i.relname::TEXT,
    us.idx_scan,
    us.idx_tup_read,
    us.idx_tup_fetch
  FROM pg_stat_user_indexes us
  JOIN pg_index ix ON us.indexrelid = ix.indexrelid
  JOIN pg_class s  ON us.relid      = s.oid
  JOIN pg_class i  ON us.indexrelid = i.oid
  ORDER BY us.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (
  table_name  TEXT,
  total_size  TEXT,
  table_size  TEXT,
  index_size  TEXT,
  row_count   BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::TEXT,
    pg_size_pretty(pg_total_relation_size(c.oid))::TEXT,
    pg_size_pretty(pg_relation_size(c.oid))::TEXT,
    pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid))::TEXT,
    COALESCE(st.n_live_tup, 0)::BIGINT
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
  LEFT JOIN pg_stat_user_tables st ON st.relname = t.table_name
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. Cleanup old data (extends migration 006's function) ────
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Activity logs older than 1 year
  DELETE FROM student_activity_logs
  WHERE created_at < NOW() - INTERVAL '1 year';

  -- Expired ML prediction cache
  DELETE FROM ml_predictions_cache
  WHERE expires_at < NOW();

  -- System logs older than 6 months
  DELETE FROM system_logs
  WHERE created_at < NOW() - INTERVAL '6 months';

  -- Expired refresh tokens (if token_expiry column exists)
  -- Handled by Supabase Auth automatically.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Refresh analytics views helper ────────────────────────
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
EXCEPTION WHEN OTHERS THEN
  -- Fall back to non-concurrent refresh if CONCURRENTLY fails (no unique index yet)
  BEGIN
    REFRESH MATERIALIZED VIEW daily_occupancy_stats;
    REFRESH MATERIALIZED VIEW monthly_revenue_stats;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_analytics_views: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Additional indexes for activity log queries ────────────
CREATE INDEX IF NOT EXISTS idx_activity_logs_login_date
  ON student_activity_logs(tenant_id, created_at DESC)
  WHERE activity_type = 'login';

SELECT 'Migration 010 complete — maintenance functions, RLS, system_logs, cleanup' AS result;
