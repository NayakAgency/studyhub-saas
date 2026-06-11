-- ============================================================
-- StudyHub SaaS Platform - Migration 001: Core Tables
-- ============================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create sequences for auto-numbering
CREATE SEQUENCE IF NOT EXISTS student_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS receipt_seq START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS complaint_seq START 1 INCREMENT 1;

-- ============================================================
-- 1. tenants (study halls registered on the platform)
-- ============================================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hall_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,           -- URL identifier: studyhub.app/hall/slug
  owner_name TEXT NOT NULL,
  owner_email TEXT UNIQUE NOT NULL,
  owner_phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  logo_url TEXT,
  theme_color TEXT DEFAULT '#2563EB',  -- Per-hall accent color
  status TEXT DEFAULT 'active' CHECK (status IN ('active','suspended','trial','pending')),
  plan_type TEXT DEFAULT 'standard' CHECK (plan_type IN ('standard','premium','enterprise')),
  billing_type TEXT DEFAULT 'monthly' CHECK (billing_type IN ('monthly','yearly','one_time')),
  billing_amount NUMERIC(10,2),
  next_billing_date DATE,
  trial_ends_at TIMESTAMPTZ,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. super_admins (platform administrators)
-- ============================================================
CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. hall_admins
-- ============================================================
CREATE TABLE hall_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'owner' CHECK (role IN ('owner','staff')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. sections (AC, Non-AC, Cabin, etc. per hall)
-- ============================================================
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- e.g. "AC Section", "Cabin"
  description TEXT,
  color_code TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. seats
-- ============================================================
CREATE TABLE seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  section_id UUID REFERENCES sections(id) ON DELETE CASCADE,
  seat_number TEXT NOT NULL,           -- e.g. "A-01", "CAB-3"
  row_position INTEGER,
  col_position INTEGER,
  status TEXT DEFAULT 'available' CHECK (status IN ('available','occupied','blocked','reserved','maintenance')),
  seat_type TEXT DEFAULT 'standard' CHECK (seat_type IN ('standard','premium','cabin')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, seat_number)
);

-- ============================================================
-- 5. subscription_plans
-- ============================================================
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  description TEXT,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('slot_based','full_day','open_hours')),
  time_slots JSONB,                    -- [{"label":"Morning","start":"06:00","end":"12:00"}]
  validity_type TEXT CHECK (validity_type IN ('daily','weekly','monthly','custom')),
  validity_days INTEGER,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. students
-- ============================================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_code TEXT,                   -- Auto-generated: SH-2024-0001
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('male','female','other')),
  address TEXT,
  profile_photo_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relation TEXT,
  preferred_seat_id UUID REFERENCES seats(id),
  assigned_seat_id UUID REFERENCES seats(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','inactive','suspended','rejected')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. memberships
-- ============================================================
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  seat_id UUID REFERENCES seats(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','pending')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. payments
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  membership_id UUID REFERENCES memberships(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('cash','upi')),
  utr_number TEXT,
  payment_screenshot_url TEXT,
  payment_date DATE NOT NULL,
  recorded_by UUID,
  status TEXT DEFAULT 'verified' CHECK (status IN ('pending','verified','rejected')),
  notes TEXT,
  receipt_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-tenant unique constraint on receipt_number
ALTER TABLE payments ADD CONSTRAINT payments_receipt_tenant_unique UNIQUE (tenant_id, receipt_number);

-- ============================================================
-- 9. seat_booking_requests (from student portal)
-- ============================================================
CREATE TABLE seat_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  requested_seat_id UUID REFERENCES seats(id),
  plan_id UUID REFERENCES subscription_plans(id),
  payment_screenshot_url TEXT,
  utr_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. seat_change_requests
-- ============================================================
CREATE TABLE seat_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  current_seat_id UUID REFERENCES seats(id),
  requested_seat_id UUID REFERENCES seats(id),
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. announcements
-- ============================================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'general' CHECK (type IN ('general','holiday','maintenance','fee_reminder','urgent')),
  is_pinned BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. complaints
-- ============================================================
CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  complaint_number TEXT,               -- Auto-generated: CMP-2024-0001
  category TEXT CHECK (category IN ('seat','facility','staff','payment','cleanliness','other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  admin_response TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. suggestions
-- ============================================================
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'received' CHECK (status IN ('received','reviewed','implemented')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. study_resources
-- ============================================================
CREATE TABLE study_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  subject_tag TEXT,
  uploaded_by UUID,
  download_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. waiting_list
-- ============================================================
CREATE TABLE waiting_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  preferred_plan_id UUID REFERENCES subscription_plans(id),
  preferred_section TEXT,
  notes TEXT,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','notified','converted','removed')),
  converted_student_id UUID REFERENCES students(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. renewal_requests
-- ============================================================
CREATE TABLE renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  current_membership_id UUID REFERENCES memberships(id),
  requested_plan_id UUID REFERENCES subscription_plans(id),
  payment_method TEXT,
  utr_number TEXT,
  payment_screenshot_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. hall_settings
-- ============================================================
CREATE TABLE hall_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hall_open_time TIME DEFAULT '06:00',
  hall_close_time TIME DEFAULT '22:00',
  working_days JSONB DEFAULT '["Mon","Tue","Wed","Thu","Fri","Sat"]',
  fee_due_day INTEGER DEFAULT 5,
  renewal_reminder_days INTEGER DEFAULT 7,
  max_complaint_days INTEGER DEFAULT 7,
  currency_symbol TEXT DEFAULT '₹',
  website_enabled BOOLEAN DEFAULT true,
  public_seat_visibility BOOLEAN DEFAULT true,
  terms_and_conditions TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. super_admin_billing (SaaS billing for tenants)
-- ============================================================
CREATE TABLE super_admin_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE,
  amount NUMERIC(10,2),
  billing_period_start DATE,
  billing_period_end DATE,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid','pending','overdue')),
  payment_method TEXT,
  payment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. audit_logs
-- ============================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. notifications
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('announcement','fee_reminder','seat_change','complaint_update','membership_expiry','renewal_reminder','general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 22. hall_gallery
-- ============================================================
CREATE TABLE hall_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 23. contact_inquiries
-- ============================================================
CREATE TABLE contact_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 24. platform_announcements (super admin → all tenants)
-- ============================================================
CREATE TABLE platform_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','warning','maintenance','update')),
  target TEXT DEFAULT 'all' CHECK (target IN ('all','admins_only')),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES super_admins(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 25. auth_lockouts
-- ============================================================
CREATE TABLE auth_lockouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  attempt_count INTEGER DEFAULT 1,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier)
);

-- ============================================================
-- 26. refresh_tokens
-- ============================================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
