-- ============================================================
-- StudyHub SaaS Platform — COMPLETE DATABASE SETUP
-- Run this ENTIRE script in Supabase SQL Editor (one shot)
-- Project: StudyHub v1.0 | Built by NayakWorks
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Sequences ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS student_seq  START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS receipt_seq  START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1 INCREMENT 1;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. tenants
CREATE TABLE IF NOT EXISTS tenants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall_name        TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  owner_name       TEXT NOT NULL,
  owner_email      TEXT UNIQUE NOT NULL,
  owner_phone      TEXT NOT NULL,
  address          TEXT,
  city             TEXT,
  logo_url         TEXT,
  theme_color      TEXT DEFAULT '#2563EB',
  status           TEXT DEFAULT 'active'   CHECK (status   IN ('active','suspended','trial','pending')),
  plan_type        TEXT DEFAULT 'standard' CHECK (plan_type IN ('standard','premium','enterprise')),
  billing_type     TEXT DEFAULT 'monthly'  CHECK (billing_type IN ('monthly','yearly','one_time')),
  billing_amount   NUMERIC(10,2),
  next_billing_date DATE,
  trial_ends_at    TIMESTAMPTZ,
  onboarded_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. super_admins
CREATE TABLE IF NOT EXISTS super_admins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name    TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  is_active    BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. hall_admins
CREATE TABLE IF NOT EXISTS hall_admins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL,
  phone      TEXT NOT NULL,
  email      TEXT NOT NULL,
  role       TEXT DEFAULT 'owner' CHECK (role IN ('owner','staff')),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. sections
CREATE TABLE IF NOT EXISTS sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  color_code    TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. seats
CREATE TABLE IF NOT EXISTS seats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  section_id   UUID REFERENCES sections(id) ON DELETE CASCADE,
  seat_number  TEXT NOT NULL,
  row_position INTEGER,
  col_position INTEGER,
  status       TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','blocked','reserved','maintenance')),
  seat_type    TEXT DEFAULT 'standard'  CHECK (seat_type IN ('standard','premium','cabin')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, seat_number)
);

-- 6. subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name     TEXT NOT NULL,
  description   TEXT,
  plan_type     TEXT NOT NULL CHECK (plan_type IN ('slot_based','full_day','open_hours')),
  time_slots    JSONB,
  validity_type TEXT CHECK (validity_type IN ('daily','weekly','monthly','custom')),
  validity_days INTEGER,
  price         NUMERIC(10,2) NOT NULL,
  is_active     BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. students
CREATE TABLE IF NOT EXISTS students (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_code               TEXT,
  full_name                  TEXT NOT NULL,
  phone                      TEXT NOT NULL,
  email                      TEXT,
  date_of_birth              DATE,
  gender                     TEXT CHECK (gender IN ('male','female','other')),
  address                    TEXT,
  profile_photo_url          TEXT,
  emergency_contact_name     TEXT,
  emergency_contact_phone    TEXT,
  emergency_contact_relation TEXT,
  preferred_seat_id          UUID REFERENCES seats(id),
  assigned_seat_id           UUID REFERENCES seats(id),
  status                     TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','suspended','rejected')),
  registered_at              TIMESTAMPTZ DEFAULT NOW(),
  activated_at               TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- 8. memberships
CREATE TABLE IF NOT EXISTS memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  plan_id    UUID REFERENCES subscription_plans(id),
  seat_id    UUID REFERENCES seats(id),
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  status     TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','pending')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. payments
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  membership_id          UUID REFERENCES memberships(id),
  amount                 NUMERIC(10,2) NOT NULL,
  payment_method         TEXT CHECK (payment_method IN ('cash','upi')),
  utr_number             TEXT,
  payment_screenshot_url TEXT,
  payment_date           DATE NOT NULL,
  recorded_by            UUID,
  status                 TEXT DEFAULT 'verified' CHECK (status IN ('pending','verified','rejected')),
  notes                  TEXT,
  receipt_number         TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'payments_receipt_tenant_unique'
  ) THEN
    ALTER TABLE payments ADD CONSTRAINT payments_receipt_tenant_unique UNIQUE (tenant_id, receipt_number);
  END IF;
END $$;

-- 10. seat_booking_requests
CREATE TABLE IF NOT EXISTS seat_booking_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id),
  requested_seat_id      UUID REFERENCES seats(id),
  plan_id                UUID REFERENCES subscription_plans(id),
  payment_screenshot_url TEXT,
  utr_number             TEXT,
  status                 TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  admin_notes            TEXT,
  reviewed_by            UUID,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 11. seat_change_requests
CREATE TABLE IF NOT EXISTS seat_change_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES students(id) ON DELETE CASCADE,
  current_seat_id   UUID REFERENCES seats(id),
  requested_seat_id UUID REFERENCES seats(id),
  reason            TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes       TEXT,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 12. announcements
CREATE TABLE IF NOT EXISTS announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'general' CHECK (type IN ('general','holiday','maintenance','fee_reminder','urgent')),
  is_pinned  BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. complaints
CREATE TABLE IF NOT EXISTS complaints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
  complaint_number TEXT,
  category         TEXT CHECK (category IN ('seat','facility','staff','payment','cleanliness','other')),
  subject          TEXT NOT NULL,
  description      TEXT NOT NULL,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_response   TEXT,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 14. suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES students(id),
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  status       TEXT DEFAULT 'received' CHECK (status IN ('received','reviewed','implemented')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 15. study_resources
CREATE TABLE IF NOT EXISTS study_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_size_bytes BIGINT,
  subject_tag     TEXT,
  uploaded_by     UUID,
  download_count  INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 16. waiting_list
CREATE TABLE IF NOT EXISTS waiting_list (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name            TEXT NOT NULL,
  phone                TEXT NOT NULL,
  email                TEXT,
  preferred_plan_id    UUID REFERENCES subscription_plans(id),
  preferred_section    TEXT,
  notes                TEXT,
  status               TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','notified','converted','removed')),
  converted_student_id UUID REFERENCES students(id),
  added_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 17. renewal_requests
CREATE TABLE IF NOT EXISTS renewal_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  current_membership_id  UUID REFERENCES memberships(id),
  requested_plan_id      UUID REFERENCES subscription_plans(id),
  payment_method         TEXT,
  utr_number             TEXT,
  payment_screenshot_url TEXT,
  status                 TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 18. hall_settings
CREATE TABLE IF NOT EXISTS hall_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hall_open_time        TIME DEFAULT '06:00',
  hall_close_time       TIME DEFAULT '22:00',
  working_days          JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
  fee_due_day           INTEGER DEFAULT 5,
  renewal_reminder_days INTEGER DEFAULT 7,
  max_complaint_days    INTEGER DEFAULT 7,
  currency_symbol       TEXT DEFAULT '₹',
  website_enabled       BOOLEAN DEFAULT true,
  public_seat_visibility BOOLEAN DEFAULT true,
  terms_and_conditions  TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 19. super_admin_billing
CREATE TABLE IF NOT EXISTS super_admin_billing (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number       TEXT UNIQUE,
  amount               NUMERIC(10,2),
  billing_period_start DATE,
  billing_period_end   DATE,
  status               TEXT DEFAULT 'paid' CHECK (status IN ('paid','pending','overdue')),
  payment_method       TEXT,
  payment_date         DATE,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 20. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID,
  user_id       UUID,
  user_role     TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 21. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id     UUID REFERENCES students(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('announcement','fee_reminder','seat_change','complaint_update','membership_expiry','renewal_reminder','general')),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  reference_id   UUID,
  reference_type TEXT,
  is_read        BOOLEAN DEFAULT false,
  read_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 22. hall_gallery
CREATE TABLE IF NOT EXISTS hall_gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  display_order INTEGER DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  uploaded_by UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 23. contact_inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 24. platform_announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','warning','maintenance','update')),
  target     TEXT DEFAULT 'all' CHECK (target IN ('all','admins_only')),
  is_active  BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. auth_lockouts
CREATE TABLE IF NOT EXISTS auth_lockouts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier      TEXT NOT NULL,
  attempt_count   INTEGER DEFAULT 1,
  locked_until    TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier)
);

-- 26. refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-generate student codes
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.student_code = 'SH-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('student_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_student_code ON students;
CREATE TRIGGER trg_generate_student_code
  BEFORE INSERT ON students
  FOR EACH ROW
  WHEN (NEW.student_code IS NULL)
  EXECUTE FUNCTION generate_student_code();

-- Auto-generate receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number = 'RCP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('receipt_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_receipt_number ON payments;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_receipt_number();

-- Auto-generate complaint numbers
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complaint_number IS NULL THEN
    NEW.complaint_number = 'CMP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('complaint_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_complaint_number ON complaints;
CREATE TRIGGER trg_generate_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW
  EXECUTE FUNCTION generate_complaint_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at    ON tenants;
DROP TRIGGER IF EXISTS trg_students_updated_at   ON students;
DROP TRIGGER IF EXISTS trg_memberships_updated_at ON memberships;
DROP TRIGGER IF EXISTS trg_complaints_updated_at ON complaints;
DROP TRIGGER IF EXISTS trg_hall_settings_updated_at ON hall_settings;

CREATE TRIGGER trg_tenants_updated_at    BEFORE UPDATE ON tenants    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at   BEFORE UPDATE ON students   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_complaints_updated_at BEFORE UPDATE ON complaints  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hall_settings_updated_at BEFORE UPDATE ON hall_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sync seat status on membership change
CREATE OR REPLACE FUNCTION sync_seat_status_on_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'occupied' WHERE id = NEW.seat_id;
  END IF;
  IF NEW.status IN ('expired','cancelled') AND NEW.seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM memberships
      WHERE seat_id = NEW.seat_id AND status = 'active' AND id != NEW.id
    ) THEN
      UPDATE seats SET status = 'available' WHERE id = NEW.seat_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_seat_status ON memberships;
CREATE TRIGGER trg_sync_seat_status
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION sync_seat_status_on_membership();

-- Helper: check if user is super admin (used in RLS)
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins
    WHERE user_id = p_user_id AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: get tenant_id for any user
CREATE OR REPLACE FUNCTION get_user_tenant_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE v_tenant_id UUID;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM hall_admins WHERE user_id = p_user_id LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;
  SELECT tenant_id INTO v_tenant_id FROM students WHERE user_id = p_user_id LIMIT 1;
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_admins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections             ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_resources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list         ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_requests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_billing  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_gallery         ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_lockouts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens       ENABLE ROW LEVEL SECURITY;

-- ── TENANTS ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_tenants"      ON tenants;
DROP POLICY IF EXISTS "admin_own_tenant"    ON tenants;
DROP POLICY IF EXISTS "student_own_tenant"  ON tenants;
DROP POLICY IF EXISTS "public_read_tenants" ON tenants;

CREATE POLICY "sa_all_tenants"      ON tenants FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_tenant"    ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_tenant"  ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "public_read_tenants" ON tenants FOR SELECT USING (status = 'active');

-- ── SUPER_ADMINS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_self" ON super_admins;
CREATE POLICY "sa_self" ON super_admins FOR ALL USING (user_id = auth.uid());

-- ── HALL_ADMINS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_hall_admins"  ON hall_admins;
DROP POLICY IF EXISTS "admin_own_record"    ON hall_admins;

CREATE POLICY "sa_all_hall_admins" ON hall_admins FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_record"   ON hall_admins FOR ALL    USING (user_id = auth.uid());

-- ── SECTIONS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_sections"     ON sections;
DROP POLICY IF EXISTS "admin_own_sections"  ON sections;
DROP POLICY IF EXISTS "student_read_sec"    ON sections;
DROP POLICY IF EXISTS "public_read_sec"     ON sections;

CREATE POLICY "sa_all_sections"    ON sections FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_sections" ON sections FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_sec"   ON sections FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "public_read_sec"    ON sections FOR SELECT USING (is_active = true);

-- ── SEATS ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_seats"    ON seats;
DROP POLICY IF EXISTS "admin_own_seats" ON seats;
DROP POLICY IF EXISTS "student_read_seats" ON seats;
DROP POLICY IF EXISTS "public_read_avail_seats" ON seats;

CREATE POLICY "sa_all_seats"           ON seats FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_seats"        ON seats FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_seats"     ON seats FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()));
CREATE POLICY "public_read_avail_seats" ON seats FOR SELECT USING (status = 'available');

-- ── SUBSCRIPTION_PLANS ───────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_plans"     ON subscription_plans;
DROP POLICY IF EXISTS "admin_own_plans"  ON subscription_plans;
DROP POLICY IF EXISTS "student_read_plans" ON subscription_plans;
DROP POLICY IF EXISTS "public_read_plans"  ON subscription_plans;

CREATE POLICY "sa_all_plans"       ON subscription_plans FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_plans"    ON subscription_plans FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_plans" ON subscription_plans FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()) AND is_active = true);
CREATE POLICY "public_read_plans"  ON subscription_plans FOR SELECT USING (is_active = true);

-- ── STUDENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_students"    ON students;
DROP POLICY IF EXISTS "admin_own_students" ON students;
DROP POLICY IF EXISTS "student_own_record" ON students;

CREATE POLICY "sa_all_students"    ON students FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_students" ON students FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_record" ON students FOR ALL USING (user_id = auth.uid());

-- ── MEMBERSHIPS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_memberships"    ON memberships;
DROP POLICY IF EXISTS "admin_own_memberships" ON memberships;
DROP POLICY IF EXISTS "student_own_memberships" ON memberships;

CREATE POLICY "sa_all_memberships"      ON memberships FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_memberships"   ON memberships FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_memberships" ON memberships FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── PAYMENTS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_payments"    ON payments;
DROP POLICY IF EXISTS "admin_own_payments" ON payments;
DROP POLICY IF EXISTS "student_own_payments" ON payments;

CREATE POLICY "sa_all_payments"      ON payments FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_payments"   ON payments FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_payments" ON payments FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── SEAT_BOOKING_REQUESTS ────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_sbr"    ON seat_booking_requests;
DROP POLICY IF EXISTS "admin_own_sbr" ON seat_booking_requests;
DROP POLICY IF EXISTS "student_own_sbr" ON seat_booking_requests;

CREATE POLICY "sa_all_sbr"      ON seat_booking_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_sbr"   ON seat_booking_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_sbr" ON seat_booking_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── SEAT_CHANGE_REQUESTS ─────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_scr"    ON seat_change_requests;
DROP POLICY IF EXISTS "admin_own_scr" ON seat_change_requests;
DROP POLICY IF EXISTS "student_own_scr" ON seat_change_requests;

CREATE POLICY "sa_all_scr"      ON seat_change_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_scr"   ON seat_change_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_scr" ON seat_change_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── ANNOUNCEMENTS ────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_ann"    ON announcements;
DROP POLICY IF EXISTS "admin_own_ann" ON announcements;
DROP POLICY IF EXISTS "student_read_ann" ON announcements;

CREATE POLICY "sa_all_ann"       ON announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_ann"    ON announcements FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_ann" ON announcements FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()) AND (expires_at IS NULL OR expires_at > NOW()));

-- ── COMPLAINTS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_comp"    ON complaints;
DROP POLICY IF EXISTS "admin_own_comp" ON complaints;
DROP POLICY IF EXISTS "student_own_comp" ON complaints;

CREATE POLICY "sa_all_comp"      ON complaints FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_comp"   ON complaints FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_comp" ON complaints FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── SUGGESTIONS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_sugg"    ON suggestions;
DROP POLICY IF EXISTS "admin_own_sugg" ON suggestions;
DROP POLICY IF EXISTS "student_own_sugg" ON suggestions;

CREATE POLICY "sa_all_sugg"      ON suggestions FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_sugg"   ON suggestions FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_sugg" ON suggestions FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── STUDY_RESOURCES ──────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_res"    ON study_resources;
DROP POLICY IF EXISTS "admin_own_res" ON study_resources;
DROP POLICY IF EXISTS "student_read_res" ON study_resources;

CREATE POLICY "sa_all_res"       ON study_resources FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_res"    ON study_resources FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_res" ON study_resources FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()) AND is_active = true);

-- ── WAITING_LIST ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_wl"    ON waiting_list;
DROP POLICY IF EXISTS "admin_own_wl" ON waiting_list;

CREATE POLICY "sa_all_wl"    ON waiting_list FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_wl" ON waiting_list FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));

-- ── RENEWAL_REQUESTS ─────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_rr"    ON renewal_requests;
DROP POLICY IF EXISTS "admin_own_rr" ON renewal_requests;
DROP POLICY IF EXISTS "student_own_rr" ON renewal_requests;

CREATE POLICY "sa_all_rr"      ON renewal_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_rr"   ON renewal_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_rr" ON renewal_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── HALL_SETTINGS ────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_hs"       ON hall_settings;
DROP POLICY IF EXISTS "admin_own_hs"    ON hall_settings;
DROP POLICY IF EXISTS "student_read_hs" ON hall_settings;

CREATE POLICY "sa_all_hs"       ON hall_settings FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_hs"    ON hall_settings FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_read_hs" ON hall_settings FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id = auth.uid()));

-- ── SUPER_ADMIN_BILLING ──────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_billing" ON super_admin_billing;
CREATE POLICY "sa_all_billing" ON super_admin_billing FOR ALL USING (is_super_admin());

-- ── AUDIT_LOGS ───────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_audit"    ON audit_logs;
DROP POLICY IF EXISTS "admin_read_audit" ON audit_logs;

CREATE POLICY "sa_all_audit"     ON audit_logs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_audit" ON audit_logs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));

-- ── NOTIFICATIONS ────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_notif"    ON notifications;
DROP POLICY IF EXISTS "admin_own_notif" ON notifications;
DROP POLICY IF EXISTS "student_own_notif" ON notifications;

CREATE POLICY "sa_all_notif"      ON notifications FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_notif"   ON notifications FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "student_own_notif" ON notifications FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

-- ── HALL_GALLERY ─────────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_gallery"    ON hall_gallery;
DROP POLICY IF EXISTS "admin_own_gallery" ON hall_gallery;
DROP POLICY IF EXISTS "public_read_gallery" ON hall_gallery;

CREATE POLICY "sa_all_gallery"      ON hall_gallery FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_gallery"   ON hall_gallery FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "public_read_gallery" ON hall_gallery FOR SELECT USING (is_active = true);

-- ── CONTACT_INQUIRIES ────────────────────────────────────────
DROP POLICY IF EXISTS "sa_all_ci"      ON contact_inquiries;
DROP POLICY IF EXISTS "admin_own_ci"   ON contact_inquiries;
DROP POLICY IF EXISTS "public_insert_ci" ON contact_inquiries;

CREATE POLICY "sa_all_ci"        ON contact_inquiries FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_ci"     ON contact_inquiries FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid()));
CREATE POLICY "public_insert_ci" ON contact_inquiries FOR INSERT WITH CHECK (true);

-- ── PLATFORM_ANNOUNCEMENTS ───────────────────────────────────
DROP POLICY IF EXISTS "sa_all_pa"   ON platform_announcements;
DROP POLICY IF EXISTS "admin_read_pa" ON platform_announcements;

CREATE POLICY "sa_all_pa"     ON platform_announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_pa" ON platform_announcements FOR SELECT USING (
  is_active = true AND (expires_at IS NULL OR expires_at > NOW())
  AND EXISTS (SELECT 1 FROM hall_admins WHERE user_id = auth.uid())
);

-- ── AUTH_LOCKOUTS ────────────────────────────────────────────
-- Managed only via service role key (backend)
DROP POLICY IF EXISTS "no_direct_lockout" ON auth_lockouts;
CREATE POLICY "no_direct_lockout" ON auth_lockouts FOR ALL USING (false);

-- ── REFRESH_TOKENS ───────────────────────────────────────────
DROP POLICY IF EXISTS "user_own_tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "sa_all_tokens"   ON refresh_tokens;

CREATE POLICY "user_own_tokens" ON refresh_tokens FOR ALL USING (user_id = auth.uid());
CREATE POLICY "sa_all_tokens"   ON refresh_tokens FOR ALL USING (is_super_admin());

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email  ON tenants(owner_email);

CREATE INDEX IF NOT EXISTS idx_hall_admins_tenant   ON hall_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_user     ON hall_admins(user_id);

CREATE INDEX IF NOT EXISTS idx_sections_tenant      ON sections(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_seats_tenant         ON seats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seats_section        ON seats(section_id);
CREATE INDEX IF NOT EXISTS idx_seats_status         ON seats(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_students_tenant      ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_phone       ON students(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_students_status      ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_user        ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_code        ON students(student_code);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant   ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_student  ON memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_end_date ON memberships(tenant_id, end_date);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry   ON memberships(end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_memberships_status   ON memberships(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_tenant      ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_student     ON payments(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_receipt     ON payments(tenant_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_payments_date        ON payments(tenant_id, payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_sbr_status           ON seat_booking_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sbr_student          ON seat_booking_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_scr_tenant           ON seat_change_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_scr_student          ON seat_change_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON announcements(tenant_id, is_pinned) WHERE is_pinned = true;

CREATE INDEX IF NOT EXISTS idx_complaints_tenant    ON complaints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status    ON complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_student   ON complaints(student_id);

CREATE INDEX IF NOT EXISTS idx_suggestions_tenant   ON suggestions(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_tenant     ON study_resources(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant  ON waiting_list(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_renewals_tenant      ON renewal_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_renewals_status      ON renewal_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_renewals_student     ON renewal_requests(student_id);

CREATE INDEX IF NOT EXISTS idx_notif_student        ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant         ON notifications(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gallery_tenant       ON hall_gallery(tenant_id, display_order);

CREATE INDEX IF NOT EXISTS idx_ci_tenant            ON contact_inquiries(tenant_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pa_active            ON platform_announcements(is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_lockouts_id          ON auth_lockouts(identifier);

CREATE INDEX IF NOT EXISTS idx_tokens_user          ON refresh_tokens(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_tokens_expires       ON refresh_tokens(expires_at) WHERE is_revoked = false;

CREATE INDEX IF NOT EXISTS idx_audit_tenant         ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource       ON audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_billing_tenant       ON super_admin_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_status       ON super_admin_billing(status);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-screenshots', 'payment-screenshots', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('profile-photos',      'profile-photos',      true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('study-resources',     'study-resources',     true, 10485760, ARRAY['application/pdf']),
  ('hall-logos',          'hall-logos',          true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('gallery-images',      'gallery-images',      true, 5242880,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DO $$
DECLARE
  buckets TEXT[] := ARRAY['payment-screenshots','profile-photos','study-resources','hall-logos','gallery-images'];
  b TEXT;
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_upload_%s"  ON storage.objects', replace(b,'-','_'));
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s"  ON storage.objects', replace(b,'-','_'));
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s"  ON storage.objects', replace(b,'-','_'));
    EXECUTE format(
      'CREATE POLICY "auth_upload_%s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = %L)',
      replace(b,'-','_'), b
    );
    EXECUTE format(
      'CREATE POLICY "public_read_%s" ON storage.objects FOR SELECT TO public USING (bucket_id = %L)',
      replace(b,'-','_'), b
    );
    EXECUTE format(
      'CREATE POLICY "auth_delete_%s" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = %L)',
      replace(b,'-','_'), b
    );
  END LOOP;
END $$;

-- ============================================================
-- DONE
-- Next step: run the seed-super-admin.js script from backend/
-- ============================================================
SELECT 'StudyHub database setup complete!' AS result,
       COUNT(*) AS tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';
