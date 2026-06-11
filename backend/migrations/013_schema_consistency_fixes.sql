-- ============================================================
-- Migration 013: Schema Consistency Fixes
-- Safe to run on existing DB (all idempotent).
-- Applies fixes from STUDYHUB_SETUP.sql v1.4+ that may
-- not have been part of earlier incremental migrations.
-- ============================================================

-- 1. suggestions: add subject + description (content stays for compat)
ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS subject     TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Back-fill subject from content for any existing rows
UPDATE suggestions
SET subject     = LEFT(content, 100),
    description = content
WHERE subject IS NULL AND content IS NOT NULL;

-- 2. renewal_requests: add current_membership_id + requested_plan_id
--    (parallel aliases for membership_id / plan_id)
ALTER TABLE renewal_requests
  ADD COLUMN IF NOT EXISTS current_membership_id UUID REFERENCES memberships(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_plan_id     UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;

-- Back-fill from existing columns
UPDATE renewal_requests
SET current_membership_id = membership_id
WHERE current_membership_id IS NULL AND membership_id IS NOT NULL;

UPDATE renewal_requests
SET requested_plan_id = plan_id
WHERE requested_plan_id IS NULL AND plan_id IS NOT NULL;

-- 3. audit_logs: add user_agent column
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 4. hall_settings: add fee_reminder_days (integer array)
ALTER TABLE hall_settings
  ADD COLUMN IF NOT EXISTS fee_reminder_days INTEGER[] DEFAULT ARRAY[3,1];

-- 5. subscription_plans: fix plan_type / validity_type constraints
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_plan_type_check
    CHECK (plan_type IN ('full_day','half_day','slot_based','open_hours','custom'));

ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_validity_type_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_validity_type_check
    CHECK (validity_type IN ('daily','weekly','monthly','quarterly','half_yearly','yearly','custom'));

-- Add missing plan columns
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS seat_category  TEXT DEFAULT 'any'
    CHECK (seat_category IN ('ac','non_ac','other','any')),
  ADD COLUMN IF NOT EXISTS time_slots     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS display_order  INTEGER DEFAULT 0;

-- Ensure features column exists
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';

-- 6. seats: add category column
ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'non_ac'
    CHECK (category IN ('ac','non_ac','other'));

-- 7. tenants: add hall_type
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS hall_type TEXT DEFAULT 'non_ac'
    CHECK (hall_type IN ('ac','non_ac','mixed'));

-- 8. students: ensure all expected columns exist
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS registered_at     TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS activated_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by        UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at     TIMESTAMPTZ,
  -- Emergency contact fields (may be missing from initial schema)
  ADD COLUMN IF NOT EXISTS emergency_contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

-- 9. memberships: ensure suspended columns exist
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS suspended_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason  TEXT,
  ADD COLUMN IF NOT EXISTS created_by         UUID;

-- 10. payments: ensure all verification columns exist
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS verified_by    UUID,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason  TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}';

-- 11. seat_booking_requests: add payment_method if missing
ALTER TABLE seat_booking_requests
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash','upi','bank_transfer'));

-- 12. refresh_tokens: add token_hash + user_agent (from migration 012)
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 13. auth_lockouts: consistent column name
ALTER TABLE auth_lockouts
  ADD COLUMN IF NOT EXISTS last_attempt TIMESTAMPTZ DEFAULT NOW();

-- 14. used_utrs table (fraud prevention)
CREATE TABLE IF NOT EXISTS used_utrs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  utr_number  TEXT NOT NULL,
  student_id  UUID REFERENCES students(id) ON DELETE SET NULL,
  payment_id  UUID REFERENCES payments(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(utr_number)
);
CREATE INDEX IF NOT EXISTS idx_used_utrs_utr ON used_utrs(utr_number);

-- Populate from existing verified payments
INSERT INTO used_utrs (tenant_id, utr_number, student_id, payment_id, verified_at, created_at)
SELECT tenant_id, utr_number, student_id, id, COALESCE(verified_at, created_at), created_at
FROM payments
WHERE utr_number IS NOT NULL AND status = 'verified'
ON CONFLICT (utr_number) DO NOTHING;

-- RLS for used_utrs
ALTER TABLE used_utrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sa_view_utrs" ON used_utrs;
DROP POLICY IF EXISTS "admin_view_utrs" ON used_utrs;
CREATE POLICY "sa_view_utrs"    ON used_utrs FOR SELECT USING (is_super_admin());
CREATE POLICY "admin_view_utrs" ON used_utrs FOR SELECT USING (
  EXISTS (SELECT 1 FROM hall_admins WHERE user_id = auth.uid() AND tenant_id = used_utrs.tenant_id AND is_active = true)
);

-- 15. Add missing RPCs if not already present (see STUDYHUB_SETUP.sql Section 4b)
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_seats          BIGINT,
  occupied_seats       BIGINT,
  available_seats      BIGINT,
  total_students       BIGINT,
  active_students      BIGINT,
  pending_applications BIGINT,
  renewals_due         BIGINT,
  open_complaints      BIGINT,
  total_revenue_mtd    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)  FROM seats  WHERE tenant_id = p_tenant_id)::BIGINT,
    (SELECT COUNT(*)  FROM seats  WHERE tenant_id = p_tenant_id AND status = 'occupied')::BIGINT,
    (SELECT COUNT(*)  FROM seats  WHERE tenant_id = p_tenant_id AND status = 'available')::BIGINT,
    (SELECT COUNT(*)  FROM students WHERE tenant_id = p_tenant_id)::BIGINT,
    (SELECT COUNT(*)  FROM students WHERE tenant_id = p_tenant_id AND status = 'active')::BIGINT,
    (SELECT COUNT(*)  FROM seat_booking_requests WHERE tenant_id = p_tenant_id AND status = 'pending')::BIGINT,
    (SELECT COUNT(*)  FROM memberships WHERE tenant_id = p_tenant_id AND status = 'active'
       AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*)  FROM complaints WHERE tenant_id = p_tenant_id AND status IN ('open','in_progress'))::BIGINT,
    (SELECT COALESCE(SUM(amount), 0) FROM payments
       WHERE tenant_id = p_tenant_id AND status = 'verified'
       AND payment_date >= DATE_TRUNC('month', CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_student_payment_summary(p_tenant_id UUID, p_student_id UUID)
RETURNS TABLE (
  total_paid        NUMERIC,
  payment_count     BIGINT,
  last_payment_date DATE,
  pending_amount    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::NUMERIC,
    COUNT(*) FILTER (WHERE status = 'verified')::BIGINT,
    MAX(payment_date) FILTER (WHERE status = 'verified'),
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC
  FROM payments
  WHERE tenant_id = p_tenant_id AND student_id = p_student_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_churn_factor_analysis(p_tenant_id UUID)
RETURNS TABLE (
  payment_churn_rate          NUMERIC,
  complaint_churn_rate        NUMERIC,
  low_engagement_churn_rate   NUMERIC,
  price_sensitive_churn_rate  NUMERIC,
  seasonal_churn_pattern      JSONB
) AS $$
BEGIN
  RETURN QUERY SELECT 0.0::NUMERIC, 0.0::NUMERIC, 0.0::NUMERIC, 0.0::NUMERIC, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

SELECT 'Migration 013 complete — schema consistency fixes applied' AS result;
