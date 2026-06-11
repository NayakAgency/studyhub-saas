-- ============================================================
-- Migration 014: Payment Stats Functions + Missing Columns
-- Adds get_payment_stats RPC used by the payments service,
-- plus other minor columns/indexes missing from prior migrations.
-- Safe to run on existing DB (idempotent).
-- ============================================================

-- 1. get_payment_stats RPC (used by payment.service.js)
CREATE OR REPLACE FUNCTION get_payment_stats(
  p_tenant_id  UUID,
  p_start_date DATE,
  p_end_date   DATE
)
RETURNS TABLE (
  total_amount      NUMERIC,
  total_count       BIGINT,
  successful_count  BIGINT,
  failed_count      BIGINT,
  average_amount    NUMERIC,
  upi_amount        NUMERIC,
  cash_amount       NUMERIC,
  pending_amount    NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0)::NUMERIC            AS total_amount,
    COUNT(*)::BIGINT                                                                  AS total_count,
    COUNT(*) FILTER (WHERE status = 'verified')::BIGINT                             AS successful_count,
    COUNT(*) FILTER (WHERE status = 'rejected')::BIGINT                             AS failed_count,
    COALESCE(AVG(amount) FILTER (WHERE status = 'verified'), 0)::NUMERIC            AS average_amount,
    COALESCE(SUM(amount) FILTER (WHERE status = 'verified' AND payment_method = 'upi'),  0)::NUMERIC AS upi_amount,
    COALESCE(SUM(amount) FILTER (WHERE status = 'verified' AND payment_method = 'cash'), 0)::NUMERIC AS cash_amount,
    COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0)::NUMERIC             AS pending_amount
  FROM payments
  WHERE tenant_id = p_tenant_id
    AND payment_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- 2. Ensure tenants table has hall_type + billing_period columns
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS hall_type            TEXT DEFAULT 'non_ac'
    CHECK (hall_type IN ('ac','non_ac','mixed')),
  ADD COLUMN IF NOT EXISTS billing_period_start DATE,
  ADD COLUMN IF NOT EXISTS billing_period_end   DATE;

-- 3. Ensure platform_settings table exists (used for SaaS plan/settings storage)
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for platform_settings
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sa_manage_settings" ON platform_settings;
CREATE POLICY "sa_manage_settings" ON platform_settings
  FOR ALL USING (is_super_admin());

-- 4. push_tokens table (for mobile push notifications)
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT CHECK (platform IN ('ios','android')),
  device_id  TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  last_used  TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user    ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant  ON push_tokens(tenant_id);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_own_tokens" ON push_tokens;
CREATE POLICY "student_own_tokens" ON push_tokens
  USING (user_id = auth.uid());

-- 5. Ensure hall_faqs table exists
CREATE TABLE IF NOT EXISTS hall_faqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hall_faqs_tenant ON hall_faqs(tenant_id, is_active, display_order);
ALTER TABLE hall_faqs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_manage_faqs" ON hall_faqs;
DROP POLICY IF EXISTS "public_read_faqs"  ON hall_faqs;
CREATE POLICY "admin_manage_faqs" ON hall_faqs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM hall_admins WHERE user_id = auth.uid() AND tenant_id = hall_faqs.tenant_id AND is_active = true)
  );
CREATE POLICY "public_read_faqs" ON hall_faqs
  FOR SELECT USING (is_active = true);

-- 6. Add receipt_number generation trigger if missing
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  next_val  BIGINT;
  tenant_prefix TEXT;
BEGIN
  -- Only set if not already provided
  IF NEW.receipt_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '[0-9]+$') AS BIGINT)), 0) + 1
    INTO next_val
    FROM payments
    WHERE tenant_id = NEW.tenant_id;

    SELECT UPPER(SUBSTRING(slug, 1, 3))
    INTO tenant_prefix
    FROM tenants
    WHERE id = NEW.tenant_id;

    NEW.receipt_number := COALESCE(tenant_prefix, 'SH') || '-' ||
      TO_CHAR(NOW(), 'YYYYMM') || '-' ||
      LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_receipt_number ON payments;
CREATE TRIGGER trigger_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- 7. student_code generation trigger
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER AS $$
DECLARE
  next_val BIGINT;
  hall_prefix TEXT;
BEGIN
  IF NEW.student_code IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(student_code FROM '[0-9]+$') AS BIGINT)), 0) + 1
    INTO next_val
    FROM students
    WHERE tenant_id = NEW.tenant_id;

    SELECT UPPER(SUBSTRING(REPLACE(hall_name, ' ', ''), 1, 3))
    INTO hall_prefix
    FROM tenants
    WHERE id = NEW.tenant_id;

    NEW.student_code := COALESCE(hall_prefix, 'STU') || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_student_code ON students;
CREATE TRIGGER trigger_student_code
  BEFORE INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION generate_student_code();

-- 8. complaint_number generation trigger
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
DECLARE
  next_val BIGINT;
BEGIN
  IF NEW.complaint_number IS NULL THEN
    SELECT COALESCE(MAX(CAST(SUBSTRING(complaint_number FROM '[0-9]+$') AS BIGINT)), 0) + 1
    INTO next_val
    FROM complaints
    WHERE tenant_id = NEW.tenant_id;

    NEW.complaint_number := 'CMP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_complaint_number ON complaints;
CREATE TRIGGER trigger_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION generate_complaint_number();

-- 9. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status        ON payments(tenant_id, status, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_student              ON payments(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_student_status    ON memberships(student_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant_end        ON memberships(tenant_id, end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_notifications_student_unread  ON notifications(student_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_students_tenant_status        ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_status           ON seats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_booking_requests_pending ON seat_booking_requests(tenant_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_status      ON complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seat_change_requests_pending  ON seat_change_requests(tenant_id, status) WHERE status = 'pending';

SELECT 'Migration 014 complete — payment stats functions + platform_settings + push_tokens + triggers + indexes' AS result;
