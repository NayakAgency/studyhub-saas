-- ============================================================
-- StudyHub SaaS Platform — COMPLETE FINAL DATABASE SETUP
-- Single-shot script. Paste entire content into Supabase SQL
-- Editor and click RUN. Safe to re-run (fully idempotent).
-- Version: FINAL v2.0 | Built by NayakWorks
-- Tables : 34  | Indexes: 80+  | Mat-Views: 5  | RLS: 60+
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PRE-FLIGHT: DROP ALL TRIGGERS & FUNCTIONS
-- PostgreSQL cannot change return types via CREATE OR REPLACE.
-- Dropping first makes this script fully re-runnable.
-- ============================================================

DROP TRIGGER IF EXISTS trg_tenants_updated_at              ON tenants;
DROP TRIGGER IF EXISTS trg_students_updated_at             ON students;
DROP TRIGGER IF EXISTS trg_memberships_updated_at          ON memberships;
DROP TRIGGER IF EXISTS trg_complaints_updated_at           ON complaints;
DROP TRIGGER IF EXISTS trg_hall_settings_updated_at        ON hall_settings;
DROP TRIGGER IF EXISTS trg_hall_inquiries_updated_at       ON hall_inquiries;
DROP TRIGGER IF EXISTS trg_hall_faqs_updated_at            ON hall_faqs;
DROP TRIGGER IF EXISTS trg_generate_student_code           ON students;
DROP TRIGGER IF EXISTS trigger_student_code                ON students;
DROP TRIGGER IF EXISTS trg_generate_receipt_number         ON payments;
DROP TRIGGER IF EXISTS trigger_receipt_number              ON payments;
DROP TRIGGER IF EXISTS trg_generate_complaint_number       ON complaints;
DROP TRIGGER IF EXISTS trigger_complaint_number            ON complaints;
DROP TRIGGER IF EXISTS trg_sync_seat_status                ON memberships;
DROP TRIGGER IF EXISTS trg_sync_seat_on_booking_request    ON seat_booking_requests;
DROP TRIGGER IF EXISTS trg_sync_seat_on_student_register   ON students;
DROP TRIGGER IF EXISTS trg_track_used_utr                  ON payments;

DROP FUNCTION IF EXISTS update_updated_at()                         CASCADE;
DROP FUNCTION IF EXISTS generate_student_code()                     CASCADE;
DROP FUNCTION IF EXISTS generate_receipt_number()                   CASCADE;
DROP FUNCTION IF EXISTS generate_complaint_number()                 CASCADE;
DROP FUNCTION IF EXISTS sync_seat_status_on_membership()            CASCADE;
DROP FUNCTION IF EXISTS sync_seat_on_booking_request()              CASCADE;
DROP FUNCTION IF EXISTS sync_seat_on_student_register()             CASCADE;
DROP FUNCTION IF EXISTS track_used_utr()                            CASCADE;
DROP FUNCTION IF EXISTS is_super_admin(UUID)                        CASCADE;
DROP FUNCTION IF EXISTS get_user_tenant_id(UUID)                    CASCADE;
DROP FUNCTION IF EXISTS current_tenant_id()                         CASCADE;
DROP FUNCTION IF EXISTS get_payment_stats(UUID, DATE, DATE)         CASCADE;
DROP FUNCTION IF EXISTS get_student_payment_summary(UUID, UUID)     CASCADE;
DROP FUNCTION IF EXISTS get_tenant_dashboard_stats(UUID)            CASCADE;
DROP FUNCTION IF EXISTS analyze_student_churn_risk(UUID)            CASCADE;
DROP FUNCTION IF EXISTS get_churn_factor_analysis(UUID)             CASCADE;
DROP FUNCTION IF EXISTS get_student_behavior_profile(UUID, UUID)    CASCADE;
DROP FUNCTION IF EXISTS get_cohort_behavior_analysis(UUID)          CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data()                          CASCADE;
DROP FUNCTION IF EXISTS vacuum_analyze_tables()                     CASCADE;
DROP FUNCTION IF EXISTS get_table_sizes()                           CASCADE;
DROP FUNCTION IF EXISTS get_table_list()                            CASCADE;
DROP FUNCTION IF EXISTS analyze_table(TEXT)                         CASCADE;
DROP FUNCTION IF EXISTS refresh_analytics_views()                   CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_views()                   CASCADE;
DROP FUNCTION IF EXISTS refresh_all_views()                         CASCADE;
DROP FUNCTION IF EXISTS get_database_health_metrics()               CASCADE;

-- ── Sequences ────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS student_seq   START 1000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS receipt_seq   START 1000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1000 INCREMENT 1;

-- ============================================================
-- SECTION 1: ALL TABLES
-- ============================================================

-- 1. tenants
CREATE TABLE IF NOT EXISTS tenants (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall_name            TEXT NOT NULL,
  slug                 TEXT UNIQUE NOT NULL,
  owner_name           TEXT NOT NULL,
  owner_email          TEXT NOT NULL,
  owner_phone          TEXT NOT NULL,
  address              TEXT,
  city                 TEXT,
  logo_url             TEXT,
  theme_color          TEXT DEFAULT '#2563EB',
  status               TEXT DEFAULT 'active'   CHECK (status    IN ('active','suspended','trial','pending')),
  plan_type            TEXT DEFAULT 'standard' CHECK (plan_type IN ('standard','premium','enterprise')),
  billing_type         TEXT DEFAULT 'monthly'  CHECK (billing_type IN ('monthly','yearly','one_time')),
  billing_amount       NUMERIC(10,2),
  next_billing_date    DATE,
  billing_period_start DATE,
  billing_period_end   DATE,
  trial_ends_at        TIMESTAMPTZ,
  onboarded_at         TIMESTAMPTZ,
  hall_type            TEXT DEFAULT 'non_ac' CHECK (hall_type IN ('ac','non_ac','mixed')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
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
  status               TEXT DEFAULT 'available'  CHECK (status    IN ('available','occupied','blocked','reserved','maintenance','suspended')),
  seat_type            TEXT DEFAULT 'standard'   CHECK (seat_type IN ('standard','premium','cabin')),
  category             TEXT DEFAULT 'non_ac'     CHECK (category  IN ('ac','non_ac','other')),
  notes                TEXT,
  suspended_student_id UUID,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, seat_number)
);

-- 6. subscription_plans
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name     TEXT NOT NULL,
  description   TEXT,
  plan_type     TEXT DEFAULT 'full_day' CHECK (plan_type IN ('full_day','half_day','slot_based','open_hours','custom')),
  seat_category TEXT DEFAULT 'any'      CHECK (seat_category IN ('ac','non_ac','other','any')),
  time_slots    JSONB DEFAULT '[]',
  validity_type TEXT DEFAULT 'monthly'  CHECK (validity_type IN ('daily','weekly','monthly','quarterly','half_yearly','yearly','custom')),
  validity_days INTEGER,
  price         NUMERIC(10,2) NOT NULL,
  features      JSONB DEFAULT '[]',
  is_active     BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 7. students
CREATE TABLE IF NOT EXISTS students (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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
  preferred_seat_id          UUID REFERENCES seats(id) ON DELETE SET NULL,
  assigned_seat_id           UUID REFERENCES seats(id) ON DELETE SET NULL,
  status                     TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','suspended','rejected')),
  rejection_reason           TEXT,
  last_login_at              TIMESTAMPTZ,
  registered_at              TIMESTAMPTZ DEFAULT NOW(),
  activated_at               TIMESTAMPTZ,
  created_by                 UUID,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- 8. memberships
CREATE TABLE IF NOT EXISTS memberships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id        UUID REFERENCES students(id) ON DELETE CASCADE,
  plan_id           UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  seat_id           UUID REFERENCES seats(id) ON DELETE SET NULL,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','suspended','pending')),
  notes             TEXT,
  suspended_at      TIMESTAMPTZ,
  suspension_reason TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 9. payments
CREATE TABLE IF NOT EXISTS payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  membership_id          UUID REFERENCES memberships(id) ON DELETE SET NULL,
  receipt_number         TEXT,
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

-- 10. seat_booking_requests
CREATE TABLE IF NOT EXISTS seat_booking_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  requested_seat_id      UUID REFERENCES seats(id) ON DELETE SET NULL,
  plan_id                UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  payment_method         TEXT CHECK (payment_method IN ('cash','upi','bank_transfer')),
  utr_number             TEXT,
  payment_screenshot_url TEXT,
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
  current_seat_id   UUID REFERENCES seats(id) ON DELETE SET NULL,
  requested_seat_id UUID REFERENCES seats(id) ON DELETE SET NULL,
  reason            TEXT NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes       TEXT,
  reviewed_by       UUID,
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
  resolved_by      UUID,
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 14. suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id   UUID REFERENCES students(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
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
  file_size_bytes BIGINT,
  subject_tag     TEXT,
  uploaded_by     UUID,
  is_active       BOOLEAN DEFAULT true,
  download_count  INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 16. waiting_list
CREATE TABLE IF NOT EXISTS waiting_list (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name            TEXT NOT NULL,
  phone                TEXT NOT NULL,
  email                TEXT,
  preferred_plan_id    UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  preferred_section    TEXT,
  notes                TEXT,
  status               TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','notified','converted','removed')),
  converted_student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  notified_at          TIMESTAMPTZ,
  added_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 17. renewal_requests
CREATE TABLE IF NOT EXISTS renewal_requests (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id             UUID REFERENCES students(id) ON DELETE CASCADE,
  current_membership_id  UUID REFERENCES memberships(id) ON DELETE SET NULL,
  membership_id          UUID REFERENCES memberships(id) ON DELETE SET NULL,
  requested_plan_id      UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  plan_id                UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
  payment_method         TEXT CHECK (payment_method IN ('cash','upi')),
  utr_number             TEXT,
  payment_screenshot_url TEXT,
  status                 TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes            TEXT,
  reviewed_by            UUID,
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 18. hall_settings
CREATE TABLE IF NOT EXISTS hall_settings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hall_open_time         TIME DEFAULT '06:00',
  hall_close_time        TIME DEFAULT '22:00',
  working_days           JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
  fee_due_day            INTEGER DEFAULT 5,
  renewal_reminder_days  INTEGER DEFAULT 7,
  fee_reminder_days      JSONB DEFAULT '[3,1]',
  max_complaint_days     INTEGER DEFAULT 7,
  currency_symbol        TEXT DEFAULT '₹',
  website_enabled        BOOLEAN DEFAULT true,
  public_seat_visibility BOOLEAN DEFAULT true,
  terms_and_conditions   TEXT,
  grace_period_days      INTEGER DEFAULT 7,
  auto_suspend_overdue   BOOLEAN DEFAULT true,
  payment_methods        JSONB DEFAULT '["cash","upi"]',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
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
  category      TEXT DEFAULT 'general',
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

-- 24. platform_announcements
CREATE TABLE IF NOT EXISTS platform_announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'info'  CHECK (type   IN ('info','warning','maintenance','update')),
  target     TEXT DEFAULT 'all'   CHECK (target IN ('all','admins_only')),
  is_active  BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. auth_lockouts
CREATE TABLE IF NOT EXISTS auth_lockouts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier    TEXT NOT NULL UNIQUE,
  attempt_count INTEGER DEFAULT 1,
  locked_until  TIMESTAMPTZ,
  last_attempt  TIMESTAMPTZ DEFAULT NOW(),
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 26. refresh_tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT,
  token_hash TEXT,
  is_revoked BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
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

-- 29. platform_settings
CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. hall_inquiries
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

-- 31. hall_faqs
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

-- 32. student_activity_logs
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

-- 33. ml_predictions_cache
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

-- 34. used_utrs  (fraud prevention)
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

-- ============================================================
-- SECTION 2: SAFE COLUMN ADDITIONS (idempotent ALTER TABLE)
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS utr_number             TEXT,
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason          TEXT,
  ADD COLUMN IF NOT EXISTS verified_by            UUID,
  ADD COLUMN IF NOT EXISTS verified_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description            TEXT,
  ADD COLUMN IF NOT EXISTS metadata               JSONB DEFAULT '{}';

ALTER TABLE hall_settings
  ADD COLUMN IF NOT EXISTS fee_reminder_days    JSONB    DEFAULT '[3,1]',
  ADD COLUMN IF NOT EXISTS grace_period_days    INTEGER  DEFAULT 7,
  ADD COLUMN IF NOT EXISTS auto_suspend_overdue BOOLEAN  DEFAULT true,
  ADD COLUMN IF NOT EXISTS payment_methods      JSONB    DEFAULT '["cash","upi"]';

ALTER TABLE seats
  ADD COLUMN IF NOT EXISTS suspended_student_id UUID,
  ADD COLUMN IF NOT EXISTS category             TEXT DEFAULT 'non_ac';

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_by        UUID;

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS registered_at              TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS activated_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by                 UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason           TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS emergency_contact_name     TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone    TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation TEXT;

ALTER TABLE seat_booking_requests
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE seat_change_requests
  ADD COLUMN IF NOT EXISTS reviewed_by UUID;

ALTER TABLE renewal_requests
  ADD COLUMN IF NOT EXISTS current_membership_id UUID,
  ADD COLUMN IF NOT EXISTS requested_plan_id     UUID,
  ADD COLUMN IF NOT EXISTS admin_notes           TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by           UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at           TIMESTAMPTZ;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS hall_type            TEXT DEFAULT 'non_ac',
  ADD COLUMN IF NOT EXISTS billing_period_start DATE,
  ADD COLUMN IF NOT EXISTS billing_period_end   DATE;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE auth_lockouts
  ADD COLUMN IF NOT EXISTS last_attempt TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS seat_category  TEXT    DEFAULT 'any',
  ADD COLUMN IF NOT EXISTS time_slots     JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS display_order  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS features       JSONB   DEFAULT '[]';

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Fix constraint definitions (drop stale, add correct)
ALTER TABLE subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_plan_type_check,
  DROP CONSTRAINT IF EXISTS subscription_plans_validity_type_check;
ALTER TABLE subscription_plans
  ADD CONSTRAINT subscription_plans_plan_type_check
    CHECK (plan_type IN ('full_day','half_day','slot_based','open_hours','custom')),
  ADD CONSTRAINT subscription_plans_validity_type_check
    CHECK (validity_type IN ('daily','weekly','monthly','quarterly','half_yearly','yearly','custom'));

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending','verified','rejected'));

-- ============================================================
-- SECTION 3: FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto updated_at
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

-- Student code generator (per-tenant prefix + padded sequence)
CREATE OR REPLACE FUNCTION generate_student_code()
RETURNS TRIGGER AS $$
DECLARE
  next_val    BIGINT;
  hall_prefix TEXT;
BEGIN
  IF NEW.student_code IS NULL THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(REGEXP_REPLACE(student_code, '[^0-9]','','g'), '') AS BIGINT)
    ), 0) + 1
    INTO next_val
    FROM students WHERE tenant_id = NEW.tenant_id;

    SELECT UPPER(SUBSTRING(REGEXP_REPLACE(hall_name,'[^A-Za-z]','','g'), 1, 3))
    INTO hall_prefix FROM tenants WHERE id = NEW.tenant_id;

    NEW.student_code := COALESCE(hall_prefix,'STU') || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_student_code ON students;
CREATE TRIGGER trg_generate_student_code
  BEFORE INSERT ON students
  FOR EACH ROW WHEN (NEW.student_code IS NULL)
  EXECUTE FUNCTION generate_student_code();

-- Receipt number generator (PREFIX-YYYYMM-NNNN)
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TRIGGER AS $$
DECLARE
  next_val      BIGINT;
  tenant_prefix TEXT;
BEGIN
  IF NEW.receipt_number IS NULL THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(REGEXP_REPLACE(receipt_number,'[^0-9]','','g'), '') AS BIGINT)
    ), 0) + 1
    INTO next_val FROM payments WHERE tenant_id = NEW.tenant_id;

    SELECT UPPER(SUBSTRING(slug, 1, 3))
    INTO tenant_prefix FROM tenants WHERE id = NEW.tenant_id;

    NEW.receipt_number := COALESCE(UPPER(tenant_prefix),'RCP') || '-' ||
      TO_CHAR(NOW(),'YYYYMM') || '-' || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_receipt_number ON payments;
CREATE TRIGGER trg_generate_receipt_number
  BEFORE INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION generate_receipt_number();

-- Complaint number generator (CMP-YYYY-NNNN)
CREATE OR REPLACE FUNCTION generate_complaint_number()
RETURNS TRIGGER AS $$
DECLARE next_val BIGINT;
BEGIN
  IF NEW.complaint_number IS NULL THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(REGEXP_REPLACE(complaint_number,'[^0-9]','','g'), '') AS BIGINT)
    ), 0) + 1
    INTO next_val FROM complaints WHERE tenant_id = NEW.tenant_id;
    NEW.complaint_number := 'CMP-' || TO_CHAR(NOW(),'YYYY') || '-' || LPAD(next_val::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_complaint_number ON complaints;
CREATE TRIGGER trg_generate_complaint_number
  BEFORE INSERT ON complaints
  FOR EACH ROW EXECUTE FUNCTION generate_complaint_number();

-- Sync seat status when membership changes
CREATE OR REPLACE FUNCTION sync_seat_status_on_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'occupied' WHERE id = NEW.seat_id;
  END IF;
  IF NEW.status IN ('expired','cancelled','suspended') AND NEW.seat_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM memberships WHERE seat_id = NEW.seat_id AND status = 'active' AND id != NEW.id
    ) THEN
      UPDATE seats SET status = 'available' WHERE id = NEW.seat_id AND status = 'occupied';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_seat_status ON memberships;
CREATE TRIGGER trg_sync_seat_status
  AFTER INSERT OR UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION sync_seat_status_on_membership();

-- Reserve seat on booking request submit
CREATE OR REPLACE FUNCTION sync_seat_on_booking_request()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.requested_seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'reserved' WHERE id = NEW.requested_seat_id AND status = 'available';
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.requested_seat_id IS NOT NULL THEN
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

-- Reserve seat when student registers with preferred seat
CREATE OR REPLACE FUNCTION sync_seat_on_student_register()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.preferred_seat_id IS NOT NULL THEN
    UPDATE seats SET status = 'reserved' WHERE id = NEW.preferred_seat_id AND status = 'available';
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
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

-- Track verified UTRs automatically (fraud prevention)
CREATE OR REPLACE FUNCTION track_used_utr()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'verified' AND NEW.utr_number IS NOT NULL AND
     (OLD IS NULL OR OLD.status != 'verified') THEN
    INSERT INTO used_utrs(tenant_id, utr_number, student_id, payment_id, verified_at)
    VALUES (NEW.tenant_id, NEW.utr_number, NEW.student_id, NEW.id, NOW())
    ON CONFLICT (utr_number) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_track_used_utr ON payments;
CREATE TRIGGER trg_track_used_utr
  AFTER INSERT OR UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION track_used_utr();

-- ── Helper functions used by RLS ─────────────────────────────

CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM super_admins WHERE user_id = p_user_id AND is_active = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_tenant_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE v UUID;
BEGIN
  SELECT tenant_id INTO v FROM hall_admins WHERE user_id = p_user_id LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;
  SELECT tenant_id INTO v FROM students WHERE user_id = p_user_id LIMIT 1;
  RETURN v;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tenant_id FROM hall_admins WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- ── RPC Functions ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_payment_stats(
  p_tenant_id UUID, p_start_date DATE, p_end_date DATE
) RETURNS TABLE (
  total_amount     NUMERIC, total_count      BIGINT,
  successful_count BIGINT,  failed_count     BIGINT,
  average_amount   NUMERIC, upi_amount       NUMERIC,
  cash_amount      NUMERIC, pending_amount   NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount)   FILTER (WHERE status='verified'), 0)::NUMERIC,
    COUNT(*)::BIGINT,
    COUNT(*)               FILTER (WHERE status='verified')::BIGINT,
    COUNT(*)               FILTER (WHERE status='rejected')::BIGINT,
    COALESCE(AVG(amount)   FILTER (WHERE status='verified'), 0)::NUMERIC,
    COALESCE(SUM(amount)   FILTER (WHERE status='verified' AND payment_method='upi'),  0)::NUMERIC,
    COALESCE(SUM(amount)   FILTER (WHERE status='verified' AND payment_method='cash'), 0)::NUMERIC,
    COALESCE(SUM(amount)   FILTER (WHERE status='pending'), 0)::NUMERIC
  FROM payments
  WHERE tenant_id = p_tenant_id AND payment_date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_student_payment_summary(p_tenant_id UUID, p_student_id UUID)
RETURNS TABLE (
  total_paid NUMERIC, payment_count BIGINT, last_payment_date DATE, pending_amount NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE status='verified'), 0)::NUMERIC,
    COUNT(*)             FILTER (WHERE status='verified')::BIGINT,
    MAX(payment_date)    FILTER (WHERE status='verified'),
    COALESCE(SUM(amount) FILTER (WHERE status='pending'), 0)::NUMERIC
  FROM payments WHERE tenant_id = p_tenant_id AND student_id = p_student_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_tenant_dashboard_stats(p_tenant_id UUID)
RETURNS TABLE (
  total_seats BIGINT, occupied_seats BIGINT, available_seats BIGINT,
  total_students BIGINT, active_students BIGINT, pending_applications BIGINT,
  renewals_due BIGINT, open_complaints BIGINT, total_revenue_mtd NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM seats   WHERE tenant_id=p_tenant_id)::BIGINT,
    (SELECT COUNT(*) FROM seats   WHERE tenant_id=p_tenant_id AND status='occupied')::BIGINT,
    (SELECT COUNT(*) FROM seats   WHERE tenant_id=p_tenant_id AND status='available')::BIGINT,
    (SELECT COUNT(*) FROM students WHERE tenant_id=p_tenant_id)::BIGINT,
    (SELECT COUNT(*) FROM students WHERE tenant_id=p_tenant_id AND status='active')::BIGINT,
    (SELECT COUNT(*) FROM seat_booking_requests WHERE tenant_id=p_tenant_id AND status='pending')::BIGINT,
    (SELECT COUNT(*) FROM memberships WHERE tenant_id=p_tenant_id AND status='active'
       AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM complaints WHERE tenant_id=p_tenant_id AND status IN ('open','in_progress'))::BIGINT,
    (SELECT COALESCE(SUM(amount),0) FROM payments
       WHERE tenant_id=p_tenant_id AND status='verified'
       AND payment_date >= DATE_TRUNC('month', CURRENT_DATE));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION analyze_student_churn_risk(p_tenant_id UUID)
RETURNS TABLE (
  student_id UUID, student_name TEXT, membership_months INTEGER,
  late_payments INTEGER, days_since_last_login INTEGER,
  unresolved_complaints INTEGER, last_payment_date DATE, membership_end_date DATE
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.full_name,
    COALESCE(EXTRACT(MONTH FROM AGE(COALESCE(m.end_date, CURRENT_DATE), m.start_date))::INTEGER, 0),
    COUNT(p.id) FILTER (WHERE p.status='rejected')::INTEGER,
    COALESCE(EXTRACT(DAY FROM NOW()-s.last_login_at)::INTEGER, 999),
    COUNT(c.id) FILTER (WHERE c.status IN ('open','in_progress'))::INTEGER,
    MAX(p.payment_date), m.end_date
  FROM students s
  LEFT JOIN memberships m ON s.id=m.student_id AND m.status='active'
  LEFT JOIN payments   p ON s.id=p.student_id
  LEFT JOIN complaints c ON s.id=c.student_id
  WHERE s.tenant_id=p_tenant_id AND s.status='active'
  GROUP BY s.id, s.full_name, m.start_date, m.end_date, s.last_login_at
  ORDER BY days_since_last_login DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_churn_factor_analysis(p_tenant_id UUID)
RETURNS TABLE (
  payment_churn_rate NUMERIC, complaint_churn_rate NUMERIC,
  low_engagement_churn_rate NUMERIC, price_sensitive_churn_rate NUMERIC,
  seasonal_churn_pattern JSONB
) AS $$
BEGIN
  RETURN QUERY SELECT 0.0::NUMERIC, 0.0::NUMERIC, 0.0::NUMERIC, 0.0::NUMERIC, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_student_behavior_profile(p_tenant_id UUID, p_student_id UUID)
RETURNS TABLE (
  avg_logins_per_week NUMERIC, avg_session_minutes NUMERIC,
  feature_usage_pattern JSONB, payment_punctuality_score NUMERIC,
  preferred_payment_method TEXT, avg_payment_delay_days NUMERIC,
  complaints_per_month NUMERIC, satisfaction_trend TEXT,
  resource_usage_rate NUMERIC, predicted_renewal_probability NUMERIC,
  churn_risk_score NUMERIC, predicted_ltv NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT
    0.0::NUMERIC, 0.0::NUMERIC, '{}'::JSONB,
    50.0::NUMERIC, 'unknown'::TEXT, 0.0::NUMERIC,
    0.0::NUMERIC, 'stable'::TEXT, 0.0::NUMERIC,
    0.7::NUMERIC, 30.0::NUMERIC, 0.0::NUMERIC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_cohort_behavior_analysis(p_tenant_id UUID)
RETURNS TABLE (
  engagement_segments JSONB, payment_segments JSONB,
  usage_trends JSONB, lifecycle_distribution JSONB
) AS $$
BEGIN
  RETURN QUERY SELECT '{}'::JSONB, '{}'::JSONB, '{}'::JSONB, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Maintenance functions
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
  DELETE FROM notifications         WHERE is_read=true  AND created_at < NOW() - INTERVAL '90 days';
  DELETE FROM notifications         WHERE created_at < NOW() - INTERVAL '6 months';
  DELETE FROM refresh_tokens        WHERE is_revoked=true AND created_at < NOW() - INTERVAL '30 days';
  DELETE FROM refresh_tokens        WHERE expires_at < NOW();
  DELETE FROM auth_lockouts         WHERE locked_until < NOW()
    OR (locked_until IS NULL AND last_attempt < NOW() - INTERVAL '24 hours');
  DELETE FROM audit_logs            WHERE created_at < NOW() - INTERVAL '180 days';
  DELETE FROM student_activity_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM ml_predictions_cache  WHERE expires_at < NOW();
  DELETE FROM system_logs           WHERE created_at < NOW() - INTERVAL '6 months';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION vacuum_analyze_tables() RETURNS void AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT schemaname, tablename FROM pg_stat_user_tables WHERE schemaname='public'
  LOOP
    BEGIN EXECUTE 'ANALYZE '||quote_ident(rec.schemaname)||'.'||quote_ident(rec.tablename);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_table_sizes()
RETURNS TABLE (table_name TEXT, total_size TEXT, row_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT,
    pg_size_pretty(pg_total_relation_size(c.oid))::TEXT,
    COALESCE(st.n_live_tup, 0)::BIGINT
  FROM information_schema.tables t
  JOIN pg_class c ON c.relname=t.table_name AND c.relnamespace='public'::regnamespace
  LEFT JOIN pg_stat_user_tables st ON st.relname=t.table_name
  WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
  ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- SECTION 4: MATERIALIZED VIEWS
-- ============================================================

-- Daily occupancy stats (refreshed daily by cron)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_occupancy_stats AS
SELECT s.tenant_id, CURRENT_DATE AS date,
  COUNT(s.id)                                        AS total_seats,
  COUNT(s.id) FILTER (WHERE s.status='occupied')     AS occupied_seats,
  COUNT(s.id) FILTER (WHERE s.status='available')    AS available_seats,
  COUNT(s.id) FILTER (WHERE s.status='blocked')      AS blocked_seats,
  ROUND(COUNT(s.id) FILTER (WHERE s.status='occupied')::NUMERIC / NULLIF(COUNT(s.id),0) * 100, 2) AS occupancy_rate
FROM seats s GROUP BY s.tenant_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_occupancy_unique ON daily_occupancy_stats(tenant_id, date);

-- Monthly revenue stats
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_revenue_stats AS
SELECT tenant_id, DATE_TRUNC('month', payment_date)::DATE AS month,
  COUNT(*)                                           AS payment_count,
  COUNT(*) FILTER (WHERE status='verified')          AS successful_payments,
  COALESCE(SUM(amount) FILTER (WHERE status='verified'), 0) AS total_revenue,
  COALESCE(AVG(amount) FILTER (WHERE status='verified'), 0) AS avg_payment,
  COUNT(DISTINCT student_id)                         AS unique_payers
FROM payments GROUP BY tenant_id, DATE_TRUNC('month', payment_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_revenue_unique ON monthly_revenue_stats(tenant_id, month);

-- Monthly membership stats
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_membership_stats AS
SELECT tenant_id, DATE_TRUNC('month', start_date) AS month,
  COUNT(*)                                               AS new_memberships,
  COUNT(*) FILTER (WHERE status='active')                AS active_memberships,
  COUNT(*) FILTER (WHERE status='expired')               AS expired_memberships,
  COUNT(*) FILTER (WHERE status='suspended')             AS suspended_memberships
FROM memberships WHERE start_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY tenant_id, DATE_TRUNC('month', start_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_membership_unique ON monthly_membership_stats(tenant_id, month);

-- Per-tenant summary for super-admin dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tenant_stats AS
SELECT t.id AS tenant_id, t.hall_name, t.slug, t.status, t.plan_type,
  COUNT(DISTINCT s.id)  FILTER (WHERE s.status='active')     AS active_students,
  COUNT(DISTINCT s.id)  FILTER (WHERE s.status='pending')    AS pending_students,
  COUNT(DISTINCT s.id)                                        AS total_students,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status='available') AS available_seats,
  COUNT(DISTINCT se.id) FILTER (WHERE se.status='occupied')  AS occupied_seats,
  COUNT(DISTINCT se.id)                                       AS total_seats,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'
    AND p.payment_date >= DATE_TRUNC('month',NOW())), 0)      AS revenue_this_month,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'), 0) AS total_revenue,
  NOW() AS last_refreshed
FROM tenants t
LEFT JOIN students s   ON s.tenant_id=t.id
LEFT JOIN seats se     ON se.tenant_id=t.id
LEFT JOIN payments p   ON p.tenant_id=t.id
GROUP BY t.id, t.hall_name, t.slug, t.status, t.plan_type
WITH DATA;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tenant_stats_id ON mv_tenant_stats(tenant_id);

-- Platform-wide KPIs for super-admin
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_kpis AS
SELECT
  COUNT(DISTINCT t.id)                           AS total_halls,
  COUNT(DISTINCT t.id) FILTER (WHERE t.status='active') AS active_halls,
  COUNT(DISTINCT s.id)                           AS total_students,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status='active') AS active_students,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'
    AND p.payment_date >= DATE_TRUNC('month',NOW())), 0)  AS monthly_revenue,
  COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'), 0) AS total_revenue,
  NOW() AS last_refreshed
FROM tenants t
LEFT JOIN students s ON s.tenant_id=t.id
LEFT JOIN payments p ON p.tenant_id=t.id
WITH DATA;

-- Unified view refresher (call this from cron/maintenance job)
CREATE OR REPLACE FUNCTION refresh_all_views() RETURNS void AS $$
BEGIN
  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY daily_occupancy_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW daily_occupancy_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_revenue_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_membership_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW monthly_membership_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tenant_stats;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW mv_tenant_stats; END;

  BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_kpis;
  EXCEPTION WHEN OTHERS THEN REFRESH MATERIALIZED VIEW mv_platform_kpis; END;
END;
$$ LANGUAGE plpgsql;

-- Keep old name working (backwards compat)
CREATE OR REPLACE FUNCTION refresh_analytics_views() RETURNS void AS $$
BEGIN PERFORM refresh_all_views(); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_dashboard_views() RETURNS void AS $$
BEGIN PERFORM refresh_all_views(); END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SECTION 5: ROW LEVEL SECURITY
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
ALTER TABLE used_utrs              ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (clean slate)
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename); END LOOP;
END $$;

-- TENANTS
CREATE POLICY "sa_tenants"     ON tenants FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_tenant"   ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_tenant" ON tenants FOR SELECT USING (id IN (SELECT tenant_id FROM students   WHERE user_id=auth.uid()));
CREATE POLICY "public_tenants" ON tenants FOR SELECT USING (status='active');

-- SUPER_ADMINS
CREATE POLICY "sa_self" ON super_admins FOR ALL USING (user_id=auth.uid());

-- HALL_ADMINS
CREATE POLICY "sa_ha"    ON hall_admins FOR ALL USING (is_super_admin());
CREATE POLICY "admin_ha" ON hall_admins FOR ALL USING (user_id=auth.uid());

-- SECTIONS
CREATE POLICY "sa_sec"      ON sections FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_sec"   ON sections FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sec" ON sections FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students   WHERE user_id=auth.uid()));
CREATE POLICY "public_sec"  ON sections FOR SELECT USING (is_active=true);

-- SEATS
CREATE POLICY "sa_seats"      ON seats FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_seats"   ON seats FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_seats" ON seats FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students   WHERE user_id=auth.uid()));
CREATE POLICY "public_seats"  ON seats FOR SELECT USING (status IN ('available','reserved','occupied'));

-- SUBSCRIPTION_PLANS
CREATE POLICY "sa_plans"      ON subscription_plans FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_plans"   ON subscription_plans FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_plans" ON subscription_plans FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students   WHERE user_id=auth.uid()) AND is_active=true);
CREATE POLICY "public_plans"  ON subscription_plans FOR SELECT USING (is_active=true);

-- STUDENTS
CREATE POLICY "sa_students"    ON students FOR ALL USING (is_super_admin());
CREATE POLICY "admin_students" ON students FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_own"    ON students FOR ALL USING (user_id=auth.uid());

-- MEMBERSHIPS
CREATE POLICY "sa_mem"      ON memberships FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_mem"   ON memberships FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_mem" ON memberships FOR SELECT USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- PAYMENTS
CREATE POLICY "sa_pay"      ON payments FOR ALL USING (is_super_admin());
CREATE POLICY "admin_pay"   ON payments FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_pay" ON payments FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SEAT_BOOKING_REQUESTS
CREATE POLICY "sa_sbr"      ON seat_booking_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_sbr"   ON seat_booking_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sbr" ON seat_booking_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SEAT_CHANGE_REQUESTS
CREATE POLICY "sa_scr"      ON seat_change_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_scr"   ON seat_change_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_scr" ON seat_change_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- ANNOUNCEMENTS
CREATE POLICY "sa_ann"      ON announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_ann"   ON announcements FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_ann" ON announcements FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()) AND (expires_at IS NULL OR expires_at>NOW()));

-- COMPLAINTS
CREATE POLICY "sa_comp"      ON complaints FOR ALL USING (is_super_admin());
CREATE POLICY "admin_comp"   ON complaints FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_comp" ON complaints FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- SUGGESTIONS
CREATE POLICY "sa_sugg"      ON suggestions FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_sugg"   ON suggestions FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_sugg" ON suggestions FOR ALL    USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));
CREATE POLICY "anon_sugg"    ON suggestions FOR INSERT WITH CHECK (is_anonymous=true);

-- STUDY_RESOURCES
CREATE POLICY "sa_res"      ON study_resources FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_res"   ON study_resources FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_res" ON study_resources FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()) AND is_active=true);

-- WAITING_LIST
CREATE POLICY "sa_wl"    ON waiting_list FOR ALL USING (is_super_admin());
CREATE POLICY "admin_wl" ON waiting_list FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- RENEWAL_REQUESTS
CREATE POLICY "sa_rr"      ON renewal_requests FOR ALL USING (is_super_admin());
CREATE POLICY "admin_rr"   ON renewal_requests FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_rr" ON renewal_requests FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- HALL_SETTINGS
CREATE POLICY "sa_hs"      ON hall_settings FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_hs"   ON hall_settings FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_hs" ON hall_settings FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM students WHERE user_id=auth.uid()));

-- SUPER_ADMIN_BILLING
CREATE POLICY "sa_billing" ON super_admin_billing FOR ALL USING (is_super_admin());

-- AUDIT_LOGS
CREATE POLICY "sa_audit"    ON audit_logs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_audit" ON audit_logs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- NOTIFICATIONS
CREATE POLICY "sa_notif"      ON notifications FOR ALL USING (is_super_admin());
CREATE POLICY "admin_notif"   ON notifications FOR ALL USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "student_notif" ON notifications FOR ALL USING (student_id IN (SELECT id FROM students WHERE user_id=auth.uid()));

-- HALL_GALLERY
CREATE POLICY "sa_gallery"     ON hall_gallery FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_gallery"  ON hall_gallery FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "public_gallery" ON hall_gallery FOR SELECT USING (is_active=true);

-- CONTACT_INQUIRIES
CREATE POLICY "sa_ci"     ON contact_inquiries FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_ci"  ON contact_inquiries FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));
CREATE POLICY "public_ci" ON contact_inquiries FOR INSERT WITH CHECK (true);

-- PLATFORM_ANNOUNCEMENTS
CREATE POLICY "sa_pa"    ON platform_announcements FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_pa" ON platform_announcements FOR SELECT USING (
  is_active=true AND (expires_at IS NULL OR expires_at>NOW())
  AND EXISTS (SELECT 1 FROM hall_admins WHERE user_id=auth.uid())
);

-- AUTH_LOCKOUTS (backend service role only)
CREATE POLICY "no_direct_lockout" ON auth_lockouts FOR ALL USING (false);

-- REFRESH_TOKENS
CREATE POLICY "user_tokens" ON refresh_tokens FOR ALL USING (user_id=auth.uid());
CREATE POLICY "sa_tokens"   ON refresh_tokens FOR ALL USING (is_super_admin());

-- PUSH_TOKENS
CREATE POLICY "user_push"  ON push_tokens FOR ALL    USING (user_id=auth.uid());
CREATE POLICY "sa_push"    ON push_tokens FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_push" ON push_tokens FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid()));

-- SYSTEM_LOGS (backend only)
CREATE POLICY "no_direct_sys" ON system_logs FOR ALL USING (false);

-- PLATFORM_SETTINGS
CREATE POLICY "sa_ps" ON platform_settings FOR ALL USING (is_super_admin());

-- HALL_INQUIRIES
CREATE POLICY "sa_inquiries"   ON hall_inquiries FOR ALL    USING (is_super_admin());
CREATE POLICY "public_inquiry" ON hall_inquiries FOR INSERT WITH CHECK (true);

-- HALL_FAQS
CREATE POLICY "sa_faqs"     ON hall_faqs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_faqs"  ON hall_faqs FOR ALL    USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));
CREATE POLICY "public_faqs" ON hall_faqs FOR SELECT USING (is_active=true);

-- STUDENT_ACTIVITY_LOGS
CREATE POLICY "sa_activity"    ON student_activity_logs FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_activity" ON student_activity_logs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));

-- ML_PREDICTIONS_CACHE
CREATE POLICY "sa_ml"    ON ml_predictions_cache FOR ALL    USING (is_super_admin());
CREATE POLICY "admin_ml" ON ml_predictions_cache FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM hall_admins WHERE user_id=auth.uid() AND is_active=true));

-- USED_UTRS
CREATE POLICY "sa_utrs"    ON used_utrs FOR SELECT USING (is_super_admin());
CREATE POLICY "admin_utrs" ON used_utrs FOR SELECT USING (
  EXISTS (SELECT 1 FROM hall_admins WHERE user_id=auth.uid() AND tenant_id=used_utrs.tenant_id AND is_active=true)
);

-- ============================================================
-- SECTION 6: PERFORMANCE INDEXES
-- ============================================================

-- tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug         ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status       ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_email  ON tenants(owner_email);
CREATE INDEX IF NOT EXISTS idx_tenants_plan_type    ON tenants(plan_type);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at   ON tenants(created_at DESC);

-- hall_admins
CREATE INDEX IF NOT EXISTS idx_hall_admins_tenant   ON hall_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_user     ON hall_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_hall_admins_active   ON hall_admins(user_id, is_active) WHERE is_active=true;

-- sections
CREATE INDEX IF NOT EXISTS idx_sections_tenant      ON sections(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sections_order       ON sections(tenant_id, display_order);

-- seats
CREATE INDEX IF NOT EXISTS idx_seats_tenant_status  ON seats(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_seats_section        ON seats(section_id);
CREATE INDEX IF NOT EXISTS idx_seats_tenant_section ON seats(tenant_id, section_id);

-- subscription_plans
CREATE INDEX IF NOT EXISTS idx_plans_tenant_active  ON subscription_plans(tenant_id, is_active);

-- students
CREATE INDEX IF NOT EXISTS idx_students_tenant      ON students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_phone       ON students(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_students_status      ON students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_students_user        ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_code        ON students(student_code);
CREATE INDEX IF NOT EXISTS idx_students_assigned    ON students(assigned_seat_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at  ON students(created_at DESC);
-- Full-text search (name + phone + email + code)
CREATE INDEX IF NOT EXISTS idx_students_fulltext    ON students
  USING gin(to_tsvector('english',
    full_name || ' ' || COALESCE(phone,'') || ' ' || COALESCE(email,'') || ' ' || COALESCE(student_code,'')
  ));

-- memberships
CREATE INDEX IF NOT EXISTS idx_memberships_tenant       ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_student      ON memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status       ON memberships(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_student_status ON memberships(student_id, status);
CREATE INDEX IF NOT EXISTS idx_memberships_expiry       ON memberships(end_date)         WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_memberships_end_active   ON memberships(tenant_id, end_date) WHERE status='active';
CREATE INDEX IF NOT EXISTS idx_memberships_seat         ON memberships(seat_id);

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_tenant      ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_student     ON payments(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_date        ON payments(tenant_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status      ON payments(tenant_id, status, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_pending     ON payments(tenant_id, created_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_payments_utr         ON payments(tenant_id, utr_number) WHERE utr_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_method      ON payments(tenant_id, payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_membership  ON payments(membership_id);
CREATE INDEX IF NOT EXISTS idx_payments_date_range  ON payments(tenant_id, payment_date, status);

-- seat_booking_requests
CREATE INDEX IF NOT EXISTS idx_sbr_status           ON seat_booking_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sbr_seat             ON seat_booking_requests(requested_seat_id, status);
CREATE INDEX IF NOT EXISTS idx_sbr_pending          ON seat_booking_requests(tenant_id, status)    WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_sbr_pending_hot      ON seat_booking_requests(tenant_id, created_at DESC) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_sbr_student          ON seat_booking_requests(student_id);

-- seat_change_requests
CREATE INDEX IF NOT EXISTS idx_scr_status           ON seat_change_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scr_pending          ON seat_change_requests(tenant_id, status) WHERE status='pending';

-- announcements
CREATE INDEX IF NOT EXISTS idx_announcements_tenant ON announcements(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ann_pinned           ON announcements(tenant_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ann_expires          ON announcements(expires_at) WHERE expires_at IS NOT NULL;

-- complaints
CREATE INDEX IF NOT EXISTS idx_complaints_tenant    ON complaints(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_student   ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_pending   ON complaints(tenant_id, status) WHERE status IN ('open','in_progress');

-- suggestions
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant   ON suggestions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_status   ON suggestions(tenant_id, status);

-- study_resources
CREATE INDEX IF NOT EXISTS idx_resources_tenant     ON study_resources(tenant_id, is_active);

-- waiting_list
CREATE INDEX IF NOT EXISTS idx_waiting_list_tenant  ON waiting_list(tenant_id, status);

-- renewal_requests
CREATE INDEX IF NOT EXISTS idx_renewals_status      ON renewal_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_renewals_student     ON renewal_requests(student_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notif_student        ON notifications(student_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_tenant         ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread         ON notifications(student_id, is_read) WHERE is_read=false;
CREATE INDEX IF NOT EXISTS idx_notif_unread_hot     ON notifications(student_id, created_at DESC) WHERE is_read=false;

-- hall_gallery
CREATE INDEX IF NOT EXISTS idx_gallery_tenant       ON hall_gallery(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_gallery_active       ON hall_gallery(tenant_id, is_active, display_order);

-- contact_inquiries
CREATE INDEX IF NOT EXISTS idx_ci_tenant            ON contact_inquiries(tenant_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ci_unread            ON contact_inquiries(tenant_id, is_read) WHERE is_read=false;

-- platform_announcements
CREATE INDEX IF NOT EXISTS idx_pa_active            ON platform_announcements(is_active, expires_at);

-- auth_lockouts
CREATE INDEX IF NOT EXISTS idx_lockouts_id          ON auth_lockouts(identifier);
CREATE INDEX IF NOT EXISTS idx_lockouts_until       ON auth_lockouts(locked_until) WHERE locked_until IS NOT NULL;

-- refresh_tokens
CREATE INDEX IF NOT EXISTS idx_tokens_user          ON refresh_tokens(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_tokens_expires       ON refresh_tokens(expires_at) WHERE is_revoked=false;
CREATE INDEX IF NOT EXISTS idx_tokens_user_active   ON refresh_tokens(user_id, is_revoked, expires_at) WHERE is_revoked=false;

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_tenant         ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_logs(user_id);

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_user            ON push_tokens(user_id, is_active) WHERE is_active=true;
CREATE INDEX IF NOT EXISTS idx_push_tenant          ON push_tokens(tenant_id, is_active) WHERE is_active=true;

-- system_logs
CREATE INDEX IF NOT EXISTS idx_sys_logs             ON system_logs(log_type, created_at DESC);

-- hall_inquiries
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_status ON hall_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_unread ON hall_inquiries(is_read, created_at DESC);

-- hall_faqs
CREATE INDEX IF NOT EXISTS idx_hall_faqs_tenant     ON hall_faqs(tenant_id, display_order);
CREATE INDEX IF NOT EXISTS idx_faqs_active          ON hall_faqs(tenant_id, is_active, display_order);

-- student_activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_student     ON student_activity_logs(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_tenant      ON student_activity_logs(tenant_id, activity_type, created_at DESC);

-- ml_predictions_cache
CREATE INDEX IF NOT EXISTS idx_ml_cache             ON ml_predictions_cache(tenant_id, prediction_type, expires_at);

-- used_utrs
CREATE INDEX IF NOT EXISTS idx_used_utrs            ON used_utrs(utr_number);
CREATE INDEX IF NOT EXISTS idx_used_utrs_tenant     ON used_utrs(tenant_id);

-- super_admin_billing
CREATE INDEX IF NOT EXISTS idx_sa_billing_tenant    ON super_admin_billing(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sa_billing_status    ON super_admin_billing(status);

-- hall_settings
CREATE INDEX IF NOT EXISTS idx_hall_settings_tenant ON hall_settings(tenant_id);

-- ============================================================
-- SECTION 7: STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('payment-screenshots','payment-screenshots',true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('profile-photos',     'profile-photos',     true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('study-resources',    'study-resources',    true, 10485760, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('hall-logos',         'hall-logos',         true, 5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('gallery-images',     'gallery-images',     true, 8388608,  ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE b TEXT;
BEGIN
  FOREACH b IN ARRAY ARRAY['payment-screenshots','profile-photos','study-resources','hall-logos','gallery-images']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "auth_upload_%s" ON storage.objects', replace(b,'-','_'));
    EXECUTE format('DROP POLICY IF EXISTS "public_read_%s" ON storage.objects', replace(b,'-','_'));
    EXECUTE format('DROP POLICY IF EXISTS "auth_delete_%s" ON storage.objects', replace(b,'-','_'));
    EXECUTE format('CREATE POLICY "auth_upload_%s" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id=%L)', replace(b,'-','_'), b);
    EXECUTE format('CREATE POLICY "public_read_%s" ON storage.objects FOR SELECT TO public USING (bucket_id=%L)', replace(b,'-','_'), b);
    EXECUTE format('CREATE POLICY "auth_delete_%s" ON storage.objects FOR DELETE TO authenticated USING (bucket_id=%L)', replace(b,'-','_'), b);
  END LOOP;
END $$;

-- ============================================================
-- SECTION 8: BACKFILL & DEFAULT DATA
-- ============================================================

UPDATE hall_settings SET
  fee_reminder_days    = '[3,1]'::jsonb         WHERE fee_reminder_days    IS NULL;
UPDATE hall_settings SET
  grace_period_days    = 7                       WHERE grace_period_days    IS NULL;
UPDATE hall_settings SET
  auto_suspend_overdue = true                    WHERE auto_suspend_overdue IS NULL;
UPDATE hall_settings SET
  payment_methods      = '["cash","upi"]'::jsonb WHERE payment_methods      IS NULL;

-- Backfill used_utrs from existing verified payments
INSERT INTO used_utrs (tenant_id, utr_number, student_id, payment_id, verified_at, created_at)
SELECT tenant_id, utr_number, student_id, id,
       COALESCE(verified_at, created_at), created_at
FROM payments WHERE utr_number IS NOT NULL AND status='verified'
ON CONFLICT (utr_number) DO NOTHING;

-- Platform settings defaults
INSERT INTO platform_settings (key, value) VALUES
  ('app_name',             'StudyHub'),
  ('app_version',          '2.0.0'),
  ('maintenance_mode',     'false'),
  ('max_seats_standard',   '100'),
  ('max_seats_premium',    '500'),
  ('max_seats_enterprise', '9999'),
  ('support_email',        'support@studyhub.app'),
  ('onboarding_complete',  'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SECTION 9: SERVICE ROLE GRANTS
-- ============================================================

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON mv_tenant_stats      TO service_role;
GRANT SELECT ON mv_platform_kpis     TO service_role;
GRANT SELECT ON daily_occupancy_stats   TO service_role;
GRANT SELECT ON monthly_revenue_stats   TO service_role;
GRANT SELECT ON monthly_membership_stats TO service_role;

-- ============================================================
-- SECTION 10: SEED ANALYTICS VIEWS
-- ============================================================

SELECT refresh_all_views();

-- ============================================================
-- DONE — StudyHub v2.0 FINAL
-- 34 tables | 5 materialized views | 80+ indexes | 60+ RLS policies
-- 5 storage buckets | full trigger/function set
--
-- NEXT STEPS after running this script:
--   1.  cd backend && node scripts/seed-super-admin.js
--   2.  Login at /super-admin/login
--       Email:    admin@studyhub.app
--       Password: StudyHub@Admin123   ← CHANGE THIS IMMEDIATELY
--   3.  Create first hall → Super Admin → Tenants → Add Hall
--   4.  Login as hall admin at /admin/login → run Setup Wizard
-- ============================================================

SELECT
  'StudyHub v2.0 FINAL — setup complete!' AS status,
  (SELECT COUNT(*) FROM information_schema.tables  WHERE table_schema='public' AND table_type='BASE TABLE') AS tables,
  (SELECT COUNT(*) FROM pg_policies               WHERE schemaname='public') AS rls_policies,
  (SELECT COUNT(*) FROM pg_indexes                WHERE schemaname='public') AS indexes,
  (SELECT COUNT(*) FROM pg_matviews               WHERE schemaname='public') AS materialized_views;
