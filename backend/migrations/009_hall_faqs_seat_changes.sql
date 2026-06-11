-- ============================================================
-- Migration 009 — Hall FAQs & Seat Change Request Enhancements
-- Run in Supabase SQL Editor after migration 008
-- ============================================================

-- ── 1. hall_faqs ──────────────────────────────────────────────
-- Per-tenant FAQ entries shown on the public hall website
CREATE TABLE IF NOT EXISTS hall_faqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hall_faqs ENABLE ROW LEVEL SECURITY;

-- Hall admins can manage their own FAQs
CREATE POLICY "admin_all_faqs" ON hall_faqs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Public read (no auth) for active FAQs
CREATE POLICY "public_read_faqs" ON hall_faqs
  FOR SELECT USING (is_active = true);

-- Index for ordering
CREATE INDEX IF NOT EXISTS idx_hall_faqs_tenant
  ON hall_faqs(tenant_id, display_order);

-- ── 2. Add admin_notes column to seat_change_requests ─────────
-- Allows admins to leave a note when approving/rejecting
ALTER TABLE seat_change_requests
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

-- Index for pending requests
CREATE INDEX IF NOT EXISTS idx_seat_change_pending
  ON seat_change_requests(tenant_id, status, created_at DESC);

-- ── 3. Trigger to auto-set updated_at on hall_faqs ────────────
CREATE OR REPLACE FUNCTION set_updated_at_hall_faqs()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_faqs_updated_at ON hall_faqs;
CREATE TRIGGER trg_faqs_updated_at
  BEFORE UPDATE ON hall_faqs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at_hall_faqs();

SELECT 'Migration 009 complete — hall_faqs table + seat change request enhancements' AS result;
