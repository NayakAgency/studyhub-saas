-- ============================================================
-- StudyHub SaaS Platform -- COMPLETE DATABASE SETUP v1.4
-- Run this ENTIRE script in Supabase SQL Editor (one shot)
-- Project: StudyHub | Built by NayakWorks
--
-- v1.4 changes vs v1.3:
--   + hall_faqs table            (per-tenant public FAQ entries)
--   + seat_change_requests.admin_notes + reviewed_by columns
--   + student_activity_logs RLS policies
--   + ml_predictions_cache RLS policies
--   + system_logs.error_details + metadata columns
--   + Maintenance helper functions (get_table_list, etc.)
--   + cleanup_old_data updated
--   + student_activity_logs & ml_predictions_cache tables added
--   + refresh_analytics_views covers all 4 materialized views
--
-- Safe to re-run on fresh DB or existing DB (fully idempotent).
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequences
CREATE SEQUENCE IF NOT EXISTS student_seq   START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS receipt_seq   START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1 INCREMENT 1;

-- ============================================================
-- SECTION 1: CORE TABLES
-- ============================================================

-- 1. tenants
CREATE TABLE IF NOT EXISTS tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall_name         TEXT NOT NULL,
  slug              TEXT UNIQUE NOT NULL,
  owner_name        TEXT NOT NULL,
  owner_email       TEXT UNIQUE NOT NULL,
  owner_phone       TEXT NOT NULL,
  address           TEXT,
  city              TEXT,
  logo_url          TEXT,
  theme_color       TEXT DEFAULT '#2563EB',
  status            TEXT DEFAULT 'active'   CHECK (status    IN ('active','suspended','trial','pending')),
  plan_type         TEXT DEFAULT 'standard' CHECK (plan_type IN ('standard','premium','enterprise')),
  billing_type      TEXT DEFAULT 'monthly'  CHECK (billing_type IN ('monthly','yearly','one_time')),
  billing_amount    NUMERIC(10,2),
  next_billing_date DATE,
  trial_ends_at     TIMESTAMPTZ,
  onboarded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. super_admins
CREATE TABLE IF NOT EXISTS super_admins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  is_active     BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
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
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  section_id           UUID REFERENCES sections(id) ON DELETE CASCADE,
  seat_number          TEXT NOT NULL,
  row_position         INTEGER,
  col_position         INTEGER,
  status               TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','blocked','reserved','maintenance','suspended')),
  seat_type            TEXT DEFAULT 'standard'  CHECK (seat_type IN ('standard','premium','cabin')),
  notes                TEXT,
  suspended_student_id UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, seat_number)
);

-- 6. subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name      TEXT NOT NULL,
  plan_type      TEXT DEFAULT 'full_day' CHECK (plan_type IN ('full_day','half_day','custom')),
  validity_type  TEXT DEFAULT 'monthly'  CHECK (validity_type IN ('monthly','quarterly','half_yearly','yearly','custom')),
  validity_days  INTEGER,
  price          NUMERIC(10,2) NOT NULL,
  description    TEXT,
  features       JSONB DEFAULT '[]',
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 7. students
CREATE TABLE IF NOT EXISTS students (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_code      TEXT UNIQUE,
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  date_of_birth     DATE,
  gender            TEXT CHECK (gender IN ('male','female','other')),
  address           TEXT,
  guardian_name     TEXT,
  guardian_phone    TEXT,
  profile_photo_url TEXT,
  id_proof_url      TEXT,
  preferred_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  assigned_seat_id  UUID REFERENCES seats(id) ON DELETE SET NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected','inactive')),
  rejection_reason  TEXT,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- 8. memberships
CREATE TABLE IF NOT EXISTS memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id  UUID REFERENCES students(id) ON DELETE CASCADE,
  plan_id     UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  seat_id     UUID REFERENCES seats(id) ON DELETE SET NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','suspended')),
  notes       TEXT,
  suspended_at        TIMESTAMPTZ,
  suspension_reason   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9. payments
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  membership_id          UUID REFERENCES memberships(id) ON DELETE SET NULL,
  receipt_number         TEXT UNIQUE,
  amount                 NUMERIC(10,2) NOT NULL,
  payment_method         TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','upi','bank_transfer')),
  utr_number             TEXT,
  payment_screenshot_url TEXT,
  payment_date           DATE NOT NULL,
  status                 TEXT DEFAULT 'verified' CHECK (status IN ('pending','verified','rejected')),
  description            TEXT,
  notes                  TEXT,
  reject_reason          TEXT,
  recorded_by            UUID,
  verified_by            UUID,
  verified_at            TIMESTAMPTZ,
  metadata               JSONB DEFAULT '{}',
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 10. seat_booking_requests (student applications)
CREATE TABLE IF NOT EXISTS seat_booking_requests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id         UUID REFERENCES students(id) ON DELETE CASCADE,
  requested_seat_id  UUID REFERENCES seats(id) ON DELETE SET NULL,
  plan_id            UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  payment_method     TEXT CHECK (payment_method IN ('cash','upi')),
  utr_number         TEXT,
  payment_screenshot_url TEXT,
  status             TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  admin_notes        TEXT,
  reviewed_by        UUID,
  reviewed_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 11. seat_change_requests
CREATE TABLE IF NOT EXISTS seat_change_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  current_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  requested_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes     TEXT,
  reviewed_by     UUID,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 12. announcements
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  type        TEXT DEFAULT 'general' CHECK (type IN ('general','holiday','maintenance','fee_reminder','urgent')),
  is_pinned   BOOLEAN DEFAULT false,
  expires_at  TIMESTAMPTZ,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 13. complaints
CREATE TABLE IF NOT EXISTS complaints (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
  complaint_number TEXT UNIQUE,
  category         TEXT NOT NULL,
  subject          TEXT NOT NULL,
  description      TEXT NOT NULL,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_response   TEXT,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 14. suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES students(id) ON DELETE CASCADE,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  content      TEXT,                 -- legacy compat: subject + description joined
  category     TEXT,
  is_anonymous BOOLEAN DEFAULT false,
  status       TEXT DEFAULT 'received' CHECK (status IN ('received','reviewed','implemented')),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 15. study_resources
CREATE TABLE IF NOT EXISTS study_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  file_url        TEXT NOT NULL,
  file_size_bytes INTEGER,
  subject_tag     TEXT,
  uploaded_by     UUID,
  is_active       BOOLEAN DEFAULT true,
  download_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 16. waiting_list
CREATE TABLE IF NOT EXISTS waiting_list (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name          TEXT NOT NULL,
  phone              TEXT NOT NULL,
  email              TEXT,
  preferred_plan_id  UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  notes              TEXT,
  status             TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','notified','joined','cancelled')),
  notified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 17. renewal_requests
CREATE TABLE IF NOT EXISTS renewal_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id              UUID REFERENCES students(id) ON DELETE CASCADE,
  current_membership_id   UUID REFERENCES memberships(id) ON DELETE SET NULL,
  membership_id           UUID REFERENCES memberships(id) ON DELETE SET NULL,  -- alias / legacy
  requested_plan_id       UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  plan_id                 UUID REFERENCES subscription_plans(id) ON DELETE SET NULL, -- alias / legacy
  payment_method          TEXT CHECK (payment_method IN ('cash','upi')),
  utr_number              TEXT,
  payment_screenshot_url  TEXT,
  status                  TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes             TEXT,
  reviewed_by             UUID,
  reviewed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 18. hall_settings
CREATE TABLE IF NOT EXISTS hall_settings (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hall_open_time           TIME DEFAULT '06:00',
  hall_close_time          TIME DEFAULT '22:00',
  working_days             TEXT[] DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri','Sat'],
  fee_due_day              INTEGER DEFAULT 5,
  renewal_reminder_days    INTEGER DEFAULT 7,
  fee_reminder_days        INTEGER[] DEFAULT ARRAY[3,1],
  max_complaint_days       INTEGER DEFAULT 30,
  currency_symbol          TEXT DEFAULT '₹',
  website_enabled          BOOLEAN DEFAULT true,
  public_seat_visibility   BOOLEAN DEFAULT true,
  terms_and_conditions     TEXT,
  grace_period_days        INTEGER DEFAULT 7,
  auto_suspend_overdue     BOOLEAN DEFAULT true,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- 19. super_admin_billing
CREATE TABLE IF NOT EXISTS super_admin_billing (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number       TEXT UNIQUE NOT NULL,
  amount               NUMERIC(10,2) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end   DATE NOT NULL,
  status               TEXT DEFAULT 'pending' CHECK (status IN ('paid','pending','overdue')),
  payment_method       TEXT,
  payment_date         DATE,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 20. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
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
  type           TEXT NOT NULL,
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
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  caption       TEXT,
  category      TEXT DEFAULT 'general' CHECK (category IN ('general','interior','facilities','events')),
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  uploaded_by   UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 23. contact_inquiries
CREATE TABLE IF NOT EXISTS contact_inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT NOT NULL,
  email        TEXT,
  subject      TEXT,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT false,
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 24. platform_announcements (super admin → all hall admins)
CREATE TABLE IF NOT EXISTS platform_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'info' CHECK (type IN ('info','warning','maintenance','update')),
  target     TEXT DEFAULT 'all' CHECK (target IN ('all','admins_only')),
  is_active  BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. auth_lockouts
CREATE TABLE IF NOT EXISTS auth_lockouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier   TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  locked_until TIMESTAMPTZ,
  last_attempt TIMESTAMPTZ DEFAULT NOW(),
  ip_address   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 26. refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. push_tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL CHECK (platform IN ('ios','android','web')),
  device_id  TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  last_used  TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- 28. system_logs
CREATE TABLE IF NOT EXISTS system_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type      TEXT NOT NULL,
  message       TEXT NOT NULL,
  error_details TEXT,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 29. platform_settings (SaaS config key-value store)
CREATE TABLE IF NOT EXISTS platform_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. hall_inquiries (marketing page owner requests)
CREATE TABLE IF NOT EXISTS hall_inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name    TEXT NOT NULL,
  owner_email   TEXT NOT NULL,
  owner_phone   TEXT NOT NULL,
  hall_name     TEXT NOT NULL,
  city          TEXT,
  seat_count    INTEGER,
  message       TEXT,
  plan_interest TEXT CHECK (plan_interest IN ('standard','premium','enterprise')),
  status        TEXT DEFAULT 'new' CHECK (status IN ('new','contacted','converted','rejected')),
  notes         TEXT,
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 31. hall_faqs (per-tenant public FAQ entries)
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

-- 32. student_activity_logs (analytics / ML behavior tracking)
CREATE TABLE IF NOT EXISTS student_activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id    UUID REFERENCES students(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 33. ml_predictions_cache (cached ML predictions)
CREATE TABLE IF NOT EXISTS ml_predictions_cache (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES students(id) ON DELETE CASCADE,
  prediction_type  TEXT NOT NULL,
  prediction_value DECIMAL NOT NULL,
  confidence_score DECIMAL DEFAULT 0.5,
  model_version    TEXT DEFAULT '1.0',
  features         JSONB DEFAULT '{}',
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 2: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-generate student codes (SH-YYYY-0001)
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.student_code = 'SH-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('student_seq')::TEXT,4,'0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_generate_student_code ON students;
CREATE TRIGGER trg_generate_student_code
  BEFORE INSERT ON students
  FOR EACH ROW WHEN (NEW.student_code IS NULL)
  EXECUTE FUNCTION generate_student_code();

-- Auto-generate receipt numbers (RCP-YYYY-00001)
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number = 'RCP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('receipt_seq')::TEXT,5,'0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_generate_receipt_number ON payments;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- Auto-generate complaint numbers (CMP-YYYY-0001)
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.complaint_number IS NULL THEN
    NEW.complaint_number = 'CMP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(nextval('complaint_seq')::TEXT,4,'0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_generate_complaint_number ON complaints;
CREATE TRIGGER trg_generate_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION generate_complaint_number();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at         ON tenants;
DROP TRIGGER IF EXISTS trg_students_updated_at        ON students;
DROP TRIGGER IF EXISTS trg_memberships_updated_at     ON memberships;
DROP TRIGGER IF EXISTS trg_complaints_updated_at      ON complaints;
DROP TRIGGER IF EXISTS trg_hall_settings_updated_at   ON hall_settings;
DROP TRIGGER IF EXISTS trg_hall_inquiries_updated_at  ON hall_inquiries;
DROP TRIGGER IF EXISTS trg_hall_faqs_updated_at       ON hall_faqs;
CREATE TRIGGER trg_tenants_updated_at        BEFORE UPDATE ON tenants        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_students_updated_at       BEFORE UPDATE ON students       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_memberships_updated_at    BEFORE UPDATE ON memberships    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_complaints_updated_at     BEFORE UPDATE ON complaints     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hall_settings_updated_at  BEFORE UPDATE ON hall_settings  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hall_inquiries_updated_at BEFORE UPDATE ON hall_inquiries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hall_faqs_updated_at      BEFORE UPDATE ON hall_faqs      FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Sync seat status when membership changes
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

-- Sync seat on booking request
CREATE OR REPLACE FUNCTION sync_seat_on_booking_request()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.requested_seat_id IS NOT NULL) THEN
    UPDATE seats SET status = 'reserved' WHERE id = NEW.requested_seat_id AND status = 'available';
    RETURN NEW;
  END IF;
  IF (TG_OP = 'UPDATE' AND NEW.requested_seat_id IS NOT NULL) THEN
    IF NEW.status IN ('rejected','cancelled') AND OLD.status = 'pending' THEN
      IF NOT EXISTS (
        SELECT 1 FROM seat_booking_requests
        WHERE requested_seat_id = NEW.requested_seat_id AND status = 'pending' AND id != NEW.id
      ) THEN
        UPDATE seats SET status = 'available' WHERE id = NEW.requested_seat_id AND status = 'reserved';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_seat_on_booking_request ON seat_booking_requests;
CREATE TRIGGER trg_sync_seat_on_booking_request
  AFTER INSERT OR UPDATE ON seat_booking_requests
  FOR EACH ROW EXECUTE FUNCTION sync_seat_on_booking_request();

-- Sync seat on student register
CREATE OR REPLACE FUNCTION sync_seat_on_student_register()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.preferred_seat_id IS NOT NULL) THEN
    UPDATE seats SET status = 'reserved' WHERE id = NEW.preferred_seat_id AND status = 'available';
    RETURN NEW;
  END IF;
  IF (TG_OP = 'UPDATE') THEN
    IF NEW.status = 'rejected' AND OLD.status = 'pending' AND OLD.preferred_seat_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM seat_booking_requests WHERE requested_seat_id = OLD.preferred_seat_id AND status = 'pending'
      ) AND NOT EXISTS (
        SELECT 1 FROM students WHERE preferred_seat_id = OLD.preferred_seat_id AND status = 'pending' AND id != OLD.id
      ) THEN
        UPDATE seats SET status = 'available' WHERE id = OLD.preferred_seat_id AND status = 'reserved';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_sync_seat_on_student_register ON students;
CREATE TRIGGER trg_sync_seat_on_student_register
  AFTER INSERT OR UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION sync_seat_on_student_register();

-- Helper: check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM super_admins WHERE user_id = p_user_id AND is_active = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: payment stats for dashboard
CREATE OR REPLACE FUNCTION get_payment_stats(p_tenant_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  total_amount NUMERIC, total_count BIGINT, successful_count BIGINT,
  pending_count BIGINT, rejected_count BIGINT, average_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status='verified' THEN amount ELSE 0 END), 0),
    COUNT(*)::BIGINT,
    COUNT(CASE WHEN status='verified' THEN 1 END)::BIGINT,
    COUNT(CASE WHEN status='pending'  THEN 1 END)::BIGINT,
    COUNT(CASE WHEN status='rejected' THEN 1 END)::BIGINT,
    COALESCE(AVG(CASE WHEN status='verified' THEN amount END), 0)
  FROM payments
  WHERE tenant_id = p_tenant_id AND payment_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

-- RPC: student churn risk analysis
CREATE OR REPLACE FUNCTION analyze_student_churn_risk(p_tenant_id UUID)
RETURNS TABLE (
  student_id UUID, student_name TEXT, membership_months INTEGER,
  late_payments INTEGER, days_since_last_login INTEGER,
  unresolved_complaints INTEGER, last_payment_date DATE, membership_end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.full_name,
    EXTRACT(MONTH FROM AGE(COALESCE(m.end_date, CURRENT_DATE), m.start_date))::INTEGER,
    COUNT(p.id) FILTER (WHERE p.status = 'rejected')::INTEGER,
    COALESCE(EXTRACT(DAY FROM NOW() - s.last_login_at)::INTEGER, 999),
    COUNT(c.id) FILTER (WHERE c.status IN ('open','in_progress'))::INTEGER,
    MAX(p.payment_date),
    m.end_date
  FROM students s
  LEFT JOIN memberships m ON s.id = m.student_id AND m.status = 'active'
  LEFT JOIN payments p    ON s.id = p.student_id
  LEFT JOIN complaints c  ON s.id = c.student_id
  WHERE s.tenant_id = p_tenant_id AND s.status = 'active'
  GROUP BY s.id, s.full_name, m.start_date, m.end_date, s.last_login_at
  ORDER BY days_since_last_login DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Maintenance: cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
DECLARE deleted_count INTEGER;
BEGIN
  -- Old read notifications (6 months)
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '6 months' AND is_read = true;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  INSERT INTO system_logs(log_type, message) VALUES('cleanup', 'Deleted ' || deleted_count || ' old notifications');

  -- Activity logs older than 1 year
  DELETE FROM student_activity_logs WHERE created_at < NOW() - INTERVAL '1 year';

  -- Expired ML prediction cache
  DELETE FROM ml_predictions_cache WHERE expires_at < NOW();

  -- System logs older than 6 months
  DELETE FROM system_logs WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintenance: get table list
CREATE OR REPLACE FUNCTION get_table_list()
RETURNS TABLE(table_name TEXT) AS $$
BEGIN
  RETURN QUERY SELECT t.table_name::TEXT FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintenance: analyze a single table
CREATE OR REPLACE FUNCTION analyze_table(table_name TEXT)
RETURNS void AS $$
BEGIN EXECUTE 'ANALYZE ' || quote_ident(table_name); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintenance: analyze all user tables
CREATE OR REPLACE FUNCTION vacuum_analyze_tables()
RETURNS void AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, tablename FROM pg_stat_user_tables WHERE schemaname = 'public'
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

-- Maintenance: database health metrics
CREATE OR REPLACE FUNCTION get_database_health_metrics()
RETURNS TABLE (
  total_connections INTEGER, active_connections INTEGER,
  database_size TEXT, cache_hit_ratio NUMERIC,
  deadlocks BIGINT, temp_files BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT count(*)::INTEGER FROM pg_stat_activity),
    (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE state = 'active'),
    (SELECT pg_size_pretty(pg_database_size(current_database())))::TEXT,
    (SELECT ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2)
     FROM pg_stat_database WHERE datname = current_database()),
    (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()),
    (SELECT temp_files FROM pg_stat_database WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Maintenance: table sizes
CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (table_name TEXT, total_size TEXT, table_size TEXT, index_size TEXT, row_count BIGINT) AS $$
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

-- ============================================================
-- SECTION 3: MATERIALIZED VIEWS (analytics)
-- ============================================================

-- 3a. daily_payment_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_payment_stats AS
SELECT
  tenant_id, payment_date,
  COUNT(*) AS payment_count,
  SUM(amount) AS total_amount,
  COUNT(CASE WHEN status='verified' THEN 1 END) AS successful_count,
  COUNT(CASE WHEN status='rejected' THEN 1 END) AS failed_count,
  AVG(amount) FILTER (WHERE status='verified') AS avg_amount
FROM payments
WHERE payment_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY tenant_id, payment_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_payment_stats_unique ON daily_payment_stats(tenant_id, payment_date);

-- 3b. monthly_membership_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_membership_stats AS
SELECT
  tenant_id,
  DATE_TRUNC('month', start_date) AS month,
  COUNT(*) AS new_memberships,
  COUNT(CASE WHEN status='active'    THEN 1 END) AS active_memberships,
  COUNT(CASE WHEN status='expired'   THEN 1 END) AS expired_memberships,
  COUNT(CASE WHEN status='suspended' THEN 1 END) AS suspended_memberships
FROM memberships
WHERE start_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY tenant_id, DATE_TRUNC('month', start_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_membership_stats_unique ON monthly_membership_stats(tenant_id, month);

-- 3c. daily_occupancy_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_occupancy_stats AS
SELECT
  s.tenant_id,
  CURRENT_DATE AS date,
  COUNT(s.id) AS total_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'occupied')  AS occupied_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'available') AS available_seats,
  COUNT(s.id) FILTER (WHERE s.status = 'blocked')   AS blocked_seats,
  ROUND(COUNT(s.id) FILTER (WHERE s.status = 'occupied')::NUMERIC / NULLIF(COUNT(s.id), 0) * 100, 2) AS occupancy_rate
FROM seats s
GROUP BY s.tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_occupancy_stats_unique ON daily_occupancy_stats(tenant_id, date);

-- 3d. monthly_revenue_stats
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue_stats AS
SELECT
  tenant_id,
  DATE_TRUNC('month', payment_date)::DATE AS month,
  COUNT(*) AS payment_count,
  COUNT(*) FILTER (WHERE status = 'verified') AS successful_payments,
  COALESCE(SUM(amount) FILTER (WHERE status = 'verified'), 0) AS total_revenue,
  COALESCE(AVG(amount) FILTER (WHERE status = 'verified'), 0) AS avg_payment,
  COUNT(DISTINCT student_id) AS unique_payers
FROM payments
GROUP BY tenant_id, DATE_TRUNC('month', payment_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_revenue_stats_unique ON monthly_revenue_stats(tenant_id, month);

-- 3e. refresh_analytics_views (called by maintenance cron)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY daily_payment_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW daily_payment_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_membership_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_membership_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW daily_occupancy_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_revenue_stats; END;

  INSERT INTO system_logs(log_type, message, created_at)
  VALUES ('maintenance', 'Analytics views refreshed', NOW()) ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- SECTION 4: ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE tenants                ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admins           ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_admins            ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections               ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_booking_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seat_change_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints             ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_resources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiting_list           ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE super_admin_billing    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_gallery           ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_lockouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens            ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_inquiries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE hall_faqs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_activity_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_predictions_cache   ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first (idempotent re-run safety)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- TENANTS
CREATE POLICY "sa_all_tenants"      ON tenants FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_tenant"    ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_own_tenant"  ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()));
CREATE POLICY "public_read_tenants" ON tenants FOR SELECT USING (status='active');

-- SUPER_ADMINS
CREATE POLICY "sa_self" ON super_admins FOR ALL USING (user_id=auth.uid());

-- HALL_ADMINS
CREATE POLICY "sa_all_ha"    ON hall_admins FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_ha" ON hall_admins FOR ALL USING (user_id=auth.uid());

-- SECTIONS
CREATE POLICY "sa_all_sec"    ON sections FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_sec" ON sections FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sec"   ON sections FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()));
CREATE POLICY "public_sec"    ON sections FOR SELECT USING (is_active=true);

-- SEATS
CREATE POLICY "sa_all_seats"    ON seats FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_seats" ON seats FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_seats"   ON seats FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()));
CREATE POLICY "public_seats"    ON seats FOR SELECT USING (status IN ('available','reserved'));

-- SUBSCRIPTION_PLANS
CREATE POLICY "sa_all_plans"    ON subscription_plans FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_plans" ON subscription_plans FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_plans"   ON subscription_plans FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()) AND is_active=true);
CREATE POLICY "public_plans"    ON subscription_plans FOR SELECT USING (is_active=true);

-- STUDENTS
CREATE POLICY "sa_all_students"    ON students FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_students" ON students FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_own"        ON students FOR ALL USING (user_id=auth.uid());

-- MEMBERSHIPS
CREATE POLICY "sa_all_mem"    ON memberships FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_mem" ON memberships FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_mem"   ON memberships FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- PAYMENTS
CREATE POLICY "sa_all_pay"    ON payments FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_pay" ON payments FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_pay"   ON payments FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SEAT_BOOKING_REQUESTS
CREATE POLICY "sa_all_sbr"    ON seat_booking_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_sbr" ON seat_booking_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sbr"   ON seat_booking_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SEAT_CHANGE_REQUESTS
CREATE POLICY "sa_all_scr"    ON seat_change_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_scr" ON seat_change_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_scr"   ON seat_change_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- ANNOUNCEMENTS
CREATE POLICY "sa_all_ann"    ON announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_ann" ON announcements FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_ann"   ON announcements FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()) AND (expires_at IS NULL OR expires_at > NOW()));

-- COMPLAINTS
CREATE POLICY "sa_all_comp"    ON complaints FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_comp" ON complaints FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_comp"   ON complaints FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SUGGESTIONS
CREATE POLICY "sa_all_sugg"    ON suggestions FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_sugg" ON suggestions FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sugg"   ON suggestions FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- STUDY_RESOURCES
CREATE POLICY "sa_all_res"    ON study_resources FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_res" ON study_resources FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_res"   ON study_resources FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()) AND is_active=true);

-- WAITING_LIST
CREATE POLICY "sa_all_wl"    ON waiting_list FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_wl" ON waiting_list FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- RENEWAL_REQUESTS
CREATE POLICY "sa_all_rr"    ON renewal_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_rr" ON renewal_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_rr"   ON renewal_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- HALL_SETTINGS
CREATE POLICY "sa_all_hs"    ON hall_settings FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_hs" ON hall_settings FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_hs"   ON hall_settings FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()));

-- SUPER_ADMIN_BILLING
CREATE POLICY "sa_all_billing" ON super_admin_billing FOR ALL USING (is_super_admin());

-- AUDIT_LOGS
CREATE POLICY "sa_all_audit"     ON audit_logs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_audit" ON audit_logs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "sa_all_notif"    ON notifications FOR ALL USING (is_super_admin());
CREATE POLICY "admin_own_notif" ON notifications FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_notif"   ON notifications FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- HALL_GALLERY
CREATE POLICY "sa_all_gallery"    ON hall_gallery FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_gallery" ON hall_gallery FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "public_gallery"    ON hall_gallery FOR SELECT USING (is_active=true);

-- CONTACT_INQUIRIES
CREATE POLICY "sa_all_ci"    ON contact_inquiries FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_ci" ON contact_inquiries FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "public_ci"    ON contact_inquiries FOR INSERT WITH CHECK (true);

-- PLATFORM_ANNOUNCEMENTS
CREATE POLICY "sa_all_pa"     ON platform_announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_pa" ON platform_announcements FOR SELECT USING (
  is_active=true AND (expires_at IS NULL OR expires_at > NOW())
  AND EXISTS (SELECT 1 FROM hall_admins WHERE user_id=auth.uid())
);

-- AUTH_LOCKOUTS
CREATE POLICY "no_direct_lockout" ON auth_lockouts FOR ALL USING (false);

-- REFRESH_TOKENS
CREATE POLICY "user_own_tokens" ON refresh_tokens FOR ALL USING (user_id=auth.uid());
CREATE POLICY "sa_all_tokens"   ON refresh_tokens FOR ALL USING (is_super_admin());

-- PUSH_TOKENS
CREATE POLICY "user_own_push"   ON push_tokens FOR ALL    USING (user_id=auth.uid());
CREATE POLICY "sa_all_push"     ON push_tokens FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_push" ON push_tokens FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- SYSTEM_LOGS
CREATE POLICY "no_direct_sys" ON system_logs FOR ALL USING (false);

-- PLATFORM_SETTINGS
CREATE POLICY "sa_all_ps" ON platform_settings FOR ALL USING (is_super_admin());

-- HALL_INQUIRIES
CREATE POLICY "sa_all_inquiries"      ON hall_inquiries FOR ALL    USING (is_super_admin());
CREATE POLICY "public_insert_inquiry" ON hall_inquiries FOR INSERT WITH CHECK (true);

-- HALL_FAQS
CREATE POLICY "sa_all_faqs"    ON hall_faqs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_own_faqs" ON hall_faqs FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));
CREATE POLICY "public_read_faqs" ON hall_faqs FOR SELECT USING (is_active=true);

-- STUDENT_ACTIVITY_LOGS
CREATE POLICY "sa_all_activity"       ON student_activity_logs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_activity"   ON student_activity_logs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));

-- ML_PREDICTIONS_CACHE
CREATE POLICY "sa_all_ml"      ON ml_predictions_cache FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_read_ml"  ON ml_predictions_cache FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));

-- ============================================================
-- SECTION 4b: ADDITIONAL RPCs
-- ============================================================

-- Dashboard stats helper (lightweight version for the RPC call in dashboard.js)
CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_seats        BIGINT,
  occupied_seats     BIGINT,
  available_seats    BIGINT,
  total_students     BIGINT,
  active_students    BIGINT,
  pending_applications BIGINT,
  renewals_due       BIGINT,
  open_complaints    BIGINT,
  total_revenue_mtd  NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM seats WHERE tenant_id = p_tenant_id)::BIGINT,
    (SELECT COUNT(*) FROM seats WHERE tenant_id = p_tenant_id AND status = 'occupied')::BIGINT,
    (SELECT COUNT(*) FROM seats WHERE tenant_id = p_tenant_id AND status = 'available')::BIGINT,
    (SELECT COUNT(*) FROM students WHERE tenant_id = p_tenant_id)::BIGINT,
    (SELECT COUNT(*) FROM students WHERE tenant_id = p_tenant_id AND status = 'active')::BIGINT,
    (SELECT COUNT(*) FROM seat_booking_requests WHERE tenant_id = p_tenant_id AND status = 'pending')::BIGINT,
    (SELECT COUNT(*) FROM memberships WHERE tenant_id = p_tenant_id AND status = 'active'
       AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM complaints WHERE tenant_id = p_tenant_id AND status IN ('open','in_progress'))::BIGINT,
    (SELECT COALESCE(SUM(amount), 0) FROM payments
       WHERE tenant_id = p_tenant_id AND status = 'verified'
       AND payment_date >= DATE_TRUNC('month', CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

-- Student payment summary
CREATE OR REPLACE FUNCTION get_student_payment_summary(p_tenant_id UUID, p_student_id UUID)
RETURNS TABLE (
  total_paid     NUMERIC,
  payment_count  BIGINT,
  last_payment_date DATE,
  pending_amount NUMERIC
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

-- Churn factor analysis (graceful stub if analytics data is insufficient)
CREATE OR REPLACE FUNCTION get_churn_factor_analysis(p_tenant_id UUID)
RETURNS TABLE (
  payment_churn_rate          NUMERIC,
  complaint_churn_rate        NUMERIC,
  low_engagement_churn_rate   NUMERIC,
  price_sensitive_churn_rate  NUMERIC,
  seasonal_churn_pattern      JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    0.0::NUMERIC,
    0.0::NUMERIC,
    0.0::NUMERIC,
    0.0::NUMERIC,
    '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Student behavior profile (graceful stub)
CREATE OR REPLACE FUNCTION get_student_behavior_profile(p_tenant_id UUID, p_student_id UUID)
RETURNS TABLE (
  avg_logins_per_week           NUMERIC,
  avg_session_minutes           NUMERIC,
  feature_usage_pattern         JSONB,
  payment_punctuality_score     NUMERIC,
  preferred_payment_method      TEXT,
  avg_payment_delay_days        NUMERIC,
  complaints_per_month          NUMERIC,
  satisfaction_trend            TEXT,
  resource_usage_rate           NUMERIC,
  predicted_renewal_probability NUMERIC,
  churn_risk_score              NUMERIC,
  predicted_ltv                 NUMERIC
) AS $$
DECLARE
  v_student RECORD;
  v_payments RECORD;
BEGIN
  SELECT COUNT(*) AS login_count INTO v_student
  FROM student_activity_logs
  WHERE tenant_id = p_tenant_id AND student_id = p_student_id
    AND activity_type = 'login'
    AND created_at > NOW() - INTERVAL '30 days';

  SELECT
    COUNT(*) FILTER (WHERE status = 'verified')              AS verified_count,
    COUNT(*) FILTER (WHERE status = 'pending')               AS pending_count,
    MAX(payment_date) FILTER (WHERE status = 'verified')     AS last_paid,
    MODE() WITHIN GROUP (ORDER BY payment_method)            AS top_method
  INTO v_payments
  FROM payments
  WHERE tenant_id = p_tenant_id AND student_id = p_student_id;

  RETURN QUERY
  SELECT
    (v_student.login_count / 4.0)::NUMERIC,
    0.0::NUMERIC,
    '{}'::JSONB,
    CASE WHEN COALESCE(v_payments.verified_count, 0) > 0
         THEN LEAST(100, v_payments.verified_count * 10.0)::NUMERIC
         ELSE 50.0::NUMERIC END,
    COALESCE(v_payments.top_method, 'unknown')::TEXT,
    0.0::NUMERIC,
    0.0::NUMERIC,
    'stable'::TEXT,
    0.0::NUMERIC,
    0.7::NUMERIC,
    30.0::NUMERIC,
    0.0::NUMERIC;
END;
$$ LANGUAGE plpgsql;

-- Cohort behavior analysis (graceful stub)
CREATE OR REPLACE FUNCTION get_cohort_behavior_analysis(p_tenant_id UUID)
RETURNS TABLE (
  engagement_segments   JSONB,
  payment_segments      JSONB,
  usage_trends          JSONB,
  lifecycle_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    '{}'::JSONB,
    '{}'::JSONB,
    '{}'::JSONB,
    '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 5: PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug             ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status           ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_hall_admins_tenant       ON hall_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_user         ON hall_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_sections_tenant          ON sections(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_status      ON seats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_section            ON seats(section_id);
CREATE INDEX IF NOT EXISTS idx_students_tenant          ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_phone           ON students(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_students_status          ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_user            ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_code            ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_memberships_tenant       ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_student      ON memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry       ON memberships(end_date) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_memberships_status       ON memberships(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_tenant          ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_student         ON payments(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date            ON payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_utr             ON payments(tenant_id, utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sbr_status               ON seat_booking_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sbr_seat                 ON seat_booking_requests(requested_seat_id, status);
CREATE INDEX IF NOT EXISTS idx_scr_status               ON seat_change_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_tenant     ON announcements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant        ON complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_student       ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant       ON suggestions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_tenant         ON study_resources(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant      ON waiting_list(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_renewals_status          ON renewal_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_notif_student            ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant             ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_tenant           ON hall_gallery(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_ci_tenant                ON contact_inquiries(tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pa_active                ON platform_announcements(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_lockouts_id              ON auth_lockouts(identifier);
CREATE INDEX IF NOT EXISTS idx_tokens_user              ON refresh_tokens(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_tokens_expires           ON refresh_tokens(expires_at) WHERE is_revoked=false;
CREATE INDEX IF NOT EXISTS idx_audit_tenant             ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user         ON push_tokens(user_id, is_active) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant       ON push_tokens(tenant_id, is_active) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_sys_logs_type            ON system_logs(log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_settings_key    ON platform_settings(key);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_status    ON hall_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_unread    ON hall_inquiries(is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_faqs_tenant         ON hall_faqs(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_activity_student_date    ON student_activity_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_tenant_type     ON student_activity_logs(tenant_id, activity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_login           ON student_activity_logs(tenant_id, created_at DESC) WHERE activity_type = 'login';
CREATE INDEX IF NOT EXISTS idx_ml_cache_tenant_type     ON ml_predictions_cache(tenant_id, prediction_type, expires_at);

-- ============================================================
-- SECTION 6: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-screenshots', 'payment-screenshots', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('profile-photos',      'profile-photos',      true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('study-resources',     'study-resources',     true, 10485760, ARRAY['application/pdf']),
  ('hall-logos',          'hall-logos',          true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('gallery-images',      'gallery-images',      true, 8388608,  ARRAY['image/jpeg','image/png','image/webp'])
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
    EXECUTE format('CREATE POLICY "auth_upload_%s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id=%L)', replace(b,'-','_'), b);
    EXECUTE format('CREATE POLICY "public_read_%s" ON storage.objects FOR SELECT TO public USING (bucket_id=%L)', replace(b,'-','_'), b);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON storage.objects FOR DELETE TO authenticated USING (bucket_id=%L)', replace(b,'-','_'), b);
  END LOOP;
END $$;

-- ============================================================
-- SECTION 7: SEED ANALYTICS VIEWS
-- ============================================================

SELECT refresh_analytics_views();

-- ============================================================
-- DONE  StudyHub v1.4
-- 33 tables | 5 storage buckets | 4 materialized views
--
-- Next steps:
--   1. Run super admin seed:
--        cd backend && node scripts/seed-super-admin.js
--   2. Configure backend/.env (SUPABASE_URL, SERVICE_ROLE_KEY, JWT_SECRET)
--   3. npm install in both backend/ and frontend/ directories
--   4. Start servers: backend (port 3001) + frontend (port 9000)
-- ============================================================
SELECT
  'StudyHub v1.4 complete! 33 tables created.' AS result,
  COUNT(*) AS tables_found
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
