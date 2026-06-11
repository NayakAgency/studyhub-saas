-- ============================================================
-- StudyHub SaaS Platform - Migration 002: Functions & Triggers
-- ============================================================

-- ============================================================
-- Auto-generate student codes
-- ============================================================
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.student_code = 'SH-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('student_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_student_code
  BEFORE INSERT ON students
  FOR EACH ROW
  WHEN (NEW.student_code IS NULL)
  EXECUTE FUNCTION generate_student_code();

-- ============================================================
-- Auto-generate receipt numbers
-- ============================================================
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number = 'RCP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('receipt_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_receipt_number();

-- ============================================================
-- Auto-generate complaint numbers
-- ============================================================
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complaint_number IS NULL THEN
    NEW.complaint_number = 'CMP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('complaint_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION generate_complaint_number();

-- ============================================================
-- Auto-update updated_at timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_complaints_updated_at
  BEFORE UPDATE ON complaints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_hall_settings_updated_at
  BEFORE UPDATE ON hall_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Auto-update seat status when membership is created/updated
-- ============================================================
CREATE OR REPLACE FUNCTION sync_seat_status_on_membership()
RETURNS TRIGGER AS $$
BEGIN
  -- When membership becomes active, mark seat as occupied
  IF NEW.status = 'active' AND NEW.seat_id IS NOT NULL THEN
    UPDATE seats
    SET status = 'occupied'
    WHERE id = NEW.seat_id;
  END IF;

  -- When membership expires/cancelled, free the seat
  IF NEW.status IN ('expired', 'cancelled') AND NEW.seat_id IS NOT NULL THEN
    -- Only free if no other active membership for this seat
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE seat_id = NEW.seat_id
        AND status = 'active'
        AND id != NEW.id
    ) THEN
      UPDATE seats
      SET status = 'available'
      WHERE id = NEW.seat_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_seat_status
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION sync_seat_status_on_membership();

-- ============================================================
-- Auto-update hall_settings updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_hall_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Function: Get tenant_id for a user (any role)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_tenant_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Check hall_admins first
  SELECT tenant_id INTO v_tenant_id
  FROM hall_admins
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    RETURN v_tenant_id;
  END IF;

  -- Check students
  SELECT tenant_id INTO v_tenant_id
  FROM students
  WHERE user_id = p_user_id
  LIMIT 1;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Check if user is super admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = p_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: Auto-expire memberships (called by cron)
-- ============================================================
CREATE OR REPLACE FUNCTION expire_overdue_memberships()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE memberships
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND end_date < CURRENT_DATE
    RETURNING id, student_id, seat_id, tenant_id
  ),
  -- Free seats
  freed_seats AS (
    UPDATE seats
    SET status = 'available'
    WHERE id IN (SELECT seat_id FROM expired WHERE seat_id IS NOT NULL)
    RETURNING id
  ),
  -- Update student assigned seats
  updated_students AS (
    UPDATE students
    SET assigned_seat_id = NULL, updated_at = NOW()
    WHERE id IN (SELECT student_id FROM expired)
    RETURNING id
  )
  SELECT COUNT(*) INTO expired_count FROM expired;

  RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
