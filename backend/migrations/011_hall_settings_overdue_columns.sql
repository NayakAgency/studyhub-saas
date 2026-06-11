-- ============================================================
-- Migration 011 — Hall Settings: Overdue Management Columns
--                 + Memberships suspended_at / suspension_reason
--                 + Payments: verified_by / verified_at / reject_reason / description / metadata
-- Run in Supabase SQL Editor after migration 010
-- Safe to re-run (fully idempotent).
-- ============================================================

-- ── 1. hall_settings: overdue suspension config ──────────────
ALTER TABLE hall_settings
  ADD COLUMN IF NOT EXISTS grace_period_days     INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_suspend_overdue  BOOLEAN DEFAULT true;

-- ── 2. memberships: suspension tracking ─────────────────────
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS suspended_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason     TEXT;

-- ── 3. payments: admin verification fields ──────────────────
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS verified_by    UUID,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reject_reason  TEXT,
  ADD COLUMN IF NOT EXISTS description    TEXT,
  ADD COLUMN IF NOT EXISTS metadata       JSONB DEFAULT '{}';

-- ── 4. students: last_login_at if not already there ─────────
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;

-- ── 5. Useful indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_memberships_suspended
  ON memberships(tenant_id, suspended_at) WHERE status = 'suspended';

CREATE INDEX IF NOT EXISTS idx_payments_pending_tenant
  ON payments(tenant_id, created_at) WHERE status = 'pending';

SELECT 'Migration 011 complete — hall_settings overdue columns, memberships suspension, payments verification fields' AS result;
