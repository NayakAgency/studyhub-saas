-- ============================================================
-- Payment System Migration
-- UPI (UTR) + Cash only — no third-party payment gateway
-- ============================================================

-- Add columns to payments table if not already present
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS utr_number             TEXT,
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason          TEXT,
  ADD COLUMN IF NOT EXISTS verified_by            UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata               JSONB DEFAULT '{}';

-- Normalise status values to: pending | verified | rejected
-- (existing rows keep their current status)
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('pending', 'verified', 'rejected'));

-- ── Hall settings payment columns ────────────────────────────
ALTER TABLE hall_settings
  ADD COLUMN IF NOT EXISTS fee_reminder_days    INTEGER[] DEFAULT ARRAY[3,1],
  ADD COLUMN IF NOT EXISTS grace_period_days    INTEGER   DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_suspend_overdue BOOLEAN   DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_methods      TEXT[]    DEFAULT ARRAY['cash','upi'];

-- ── Seat suspension ───────────────────────────────────────────
ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS suspended_student_id UUID REFERENCES students(id);

-- ── Membership suspension ─────────────────────────────────────
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason  TEXT;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_utr
  ON payments(tenant_id, utr_number)
  WHERE utr_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_status_tenant
  ON payments(tenant_id, status, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_payments_student_tenant
  ON payments(student_id, tenant_id, payment_date DESC);

-- ── Payment statistics function ───────────────────────────────
CREATE OR REPLACE FUNCTION get_payment_stats(
  p_tenant_id  UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  total_amount      NUMERIC,
  total_count       BIGINT,
  successful_count  BIGINT,
  pending_count     BIGINT,
  rejected_count    BIGINT,
  average_amount    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0),
    COUNT(*)::BIGINT,
    COUNT(CASE WHEN p.status = 'verified'  THEN 1 END)::BIGINT,
    COUNT(CASE WHEN p.status = 'pending'   THEN 1 END)::BIGINT,
    COUNT(CASE WHEN p.status = 'rejected'  THEN 1 END)::BIGINT,
    COALESCE(AVG(CASE WHEN p.status = 'verified' THEN p.amount END), 0)
  FROM payments p
  WHERE p.tenant_id = p_tenant_id
    AND p.payment_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ── Student payment summary function ──────────────────────────
CREATE OR REPLACE FUNCTION get_student_payment_summary(
  p_tenant_id  UUID,
  p_student_id UUID
)
RETURNS TABLE (
  total_paid        NUMERIC,
  payment_count     BIGINT,
  pending_count     BIGINT,
  last_payment_date DATE,
  pending_amount    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0),
    COUNT(CASE WHEN p.status = 'verified' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN p.status = 'pending'  THEN 1 END)::BIGINT,
    MAX(CASE WHEN p.status = 'verified'   THEN p.payment_date END),
    COALESCE((
      SELECT SUM(sp.price)
      FROM memberships m
      JOIN subscription_plans sp ON m.subscription_plan_id = sp.id
      WHERE m.student_id = p_student_id
        AND m.tenant_id  = p_tenant_id
        AND m.status     = 'active'
        AND m.end_date   < CURRENT_DATE
    ), 0)
  FROM payments p
  WHERE p.tenant_id  = p_tenant_id
    AND p.student_id = p_student_id;
END;
$$ LANGUAGE plpgsql;

-- ── Backfill defaults ─────────────────────────────────────────
UPDATE hall_settings SET fee_reminder_days    = ARRAY[3,1] WHERE fee_reminder_days    IS NULL;
UPDATE hall_settings SET grace_period_days    = 7          WHERE grace_period_days    IS NULL;
UPDATE hall_settings SET auto_suspend_overdue = true       WHERE auto_suspend_overdue IS NULL;
UPDATE hall_settings SET payment_methods      = ARRAY['cash','upi'] WHERE payment_methods IS NULL;
