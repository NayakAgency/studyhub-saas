-- ============================================================
-- Migration 012: Comprehensive Fixes
-- - Fix refresh_tokens schema (add token_hash, user_agent)
-- - Fix suggestions table (add subject, description columns)
-- - Add seat_category to subscription_plans + seats
-- - Add utr_numbers validation table
-- - Add registered_at + activated_at to students (if missing)
-- ============================================================

-- 1. Fix refresh_tokens: add token_hash and user_agent columns
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Migrate existing token values into token_hash for backward compat
UPDATE refresh_tokens SET token_hash = token WHERE token_hash IS NULL;

-- 2. Fix suggestions: add subject + description (keeping content for backward compat)
ALTER TABLE suggestions
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Add seat_category to subscription_plans (ac / non_ac / other / any)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS seat_category TEXT DEFAULT 'any'
    CHECK (seat_category IN ('ac', 'non_ac', 'other', 'any')),
  ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';

-- Fix plan_type to include old values from code
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_plan_type_check
    CHECK (plan_type IN ('full_day','half_day','slot_based','open_hours','custom'));

-- Fix validity_type to include old values from code
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_validity_type_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_validity_type_check
    CHECK (validity_type IN ('daily','weekly','monthly','quarterly','half_yearly','yearly','custom'));

-- 4. Add category to seats (ac / non_ac / other)
ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'non_ac'
    CHECK (category IN ('ac', 'non_ac', 'other'));

-- 5. Add registered_at and activated_at to students
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 6. Add utr_numbers table for fraud prevention
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

-- Index for fast UTR lookup
CREATE INDEX IF NOT EXISTS idx_used_utrs_utr ON used_utrs(utr_number);

-- 7. Populate used_utrs from existing verified payments
INSERT INTO used_utrs (tenant_id, utr_number, student_id, payment_id, verified_at, created_at)
SELECT tenant_id, utr_number, student_id, id, verified_at, created_at
FROM payments
WHERE utr_number IS NOT NULL AND status = 'verified'
ON CONFLICT (utr_number) DO NOTHING;

-- 8. Add hall_type to tenants for AC/non-AC/other type indicator
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS hall_type TEXT DEFAULT 'non_ac'
    CHECK (hall_type IN ('ac', 'non_ac', 'mixed'));

-- 9. Add payment_method to seat_booking_requests if missing
ALTER TABLE seat_booking_requests
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash','upi','bank_transfer'));

-- 10. RLS policies for used_utrs
ALTER TABLE used_utrs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all UTRs" ON used_utrs
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Hall admins can view tenant UTRs" ON used_utrs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM hall_admins WHERE user_id = auth.uid() AND tenant_id = used_utrs.tenant_id AND is_active = true)
  );

CREATE POLICY "Service role full access to used_utrs" ON used_utrs
  FOR ALL USING (true) WITH CHECK (true);
