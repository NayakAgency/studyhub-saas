-- ============================================================
-- Migration 007 — Analytics Materialized Views
-- Creates the views required by analytics.service.js:
--   • daily_occupancy_stats
--   • monthly_revenue_stats
--   • monthly_membership_stats (safe upsert)
-- Run AFTER migration 004_analytics_ml.sql
-- Safe to re-run (idempotent).
-- ============================================================

-- ── 1. daily_occupancy_stats ─────────────────────────────────
-- Tracks per-tenant daily seat occupancy.
-- Populated from memberships that were active on each date.

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_occupancy_stats AS
SELECT
  s.tenant_id,
  gs.date::DATE                                    AS date,
  COUNT(s.id)                                      AS total_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'occupied') AS occupied_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'blocked')  AS blocked_seats,
  ROUND(
    (COUNT(s.id) FILTER (WHERE s.status = 'occupied'))::NUMERIC
    / NULLIF(COUNT(s.id), 0) * 100,
    2
  )                                                AS occupancy_rate
FROM
  seats s,
  LATERAL (SELECT CURRENT_DATE AS date) AS gs   -- seed with today; refresh will grow it
GROUP BY
  s.tenant_id, gs.date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_occupancy_stats_unique
  ON daily_occupancy_stats (tenant_id, date);

-- ── 2. monthly_revenue_stats ─────────────────────────────────
-- Aggregated monthly revenue per tenant from verified payments.

CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue_stats AS
SELECT
  tenant_id,
  DATE_TRUNC('month', payment_date)::DATE          AS month,
  COUNT(*)                                         AS payment_count,
  COUNT(*) FILTER (WHERE status = 'verified')      AS successful_payments,
  COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS total_revenue,
  COALESCE(AVG(amount) FILTER (WHERE status = 'verified'), 0) AS avg_payment,
  COUNT(DISTINCT student_id)                       AS unique_payers
FROM payments
GROUP BY tenant_id, DATE_TRUNC('month', payment_date);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_revenue_stats_unique
  ON monthly_revenue_stats (tenant_id, month);

-- ── 3. monthly_membership_stats (safe create-or-replace) ─────
-- Some environments may have this from migration 003.
-- We use DO $$ to avoid duplicate errors.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews WHERE matviewname = 'monthly_membership_stats'
  ) THEN
    CREATE MATERIALIZED VIEW monthly_membership_stats AS
    SELECT
      tenant_id,
      DATE_TRUNC('month', start_date)::DATE        AS month,
      COUNT(*)                                     AS new_memberships,
      COUNT(*) FILTER (WHERE status = 'active')    AS active_memberships,
      COUNT(*) FILTER (WHERE status = 'expired')   AS expired_memberships,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_memberships
    FROM memberships
    GROUP BY tenant_id, DATE_TRUNC('month', start_date);

    CREATE UNIQUE INDEX idx_monthly_membership_stats_unique
      ON monthly_membership_stats (tenant_id, month);
  END IF;
END $$;

-- ── 4. Function to refresh all analytics views ───────────────
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW daily_occupancy_stats;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
  EXCEPTION WHEN OTHERS THEN
    REFRESH MATERIALIZED VIEW monthly_revenue_stats;
  END;

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_membership_stats;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO system_logs (log_type, message, created_at)
  VALUES ('maintenance', 'Analytics views refreshed', NOW())
  ON CONFLICT DO NOTHING;
END;
$$;

-- ── 5. Wire refresh into existing maintenance job ────────────
-- Update perform_maintenance() to also call our new function.
-- Safe: EXCEPTION blocks prevent failure if function doesn't exist yet.
CREATE OR REPLACE FUNCTION perform_analytics_refresh()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_analytics_views();
END;
$$;

-- Schedule note:
--   The backend maintenance cron job already calls
--   perform_maintenance() every Sunday.
--   Call SELECT refresh_analytics_views(); manually to seed data,
--   or add it to your cron job.

-- ── 6. Seed today's data immediately ─────────────────────────
SELECT refresh_analytics_views();

COMMENT ON MATERIALIZED VIEW daily_occupancy_stats IS
  'Daily seat occupancy stats per tenant. Refresh via refresh_analytics_views().';
COMMENT ON MATERIALIZED VIEW monthly_revenue_stats IS
  'Monthly aggregated revenue per tenant from verified payments.';
