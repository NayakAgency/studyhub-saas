-- ============================================================
-- Migration 008 — Platform Settings & Hall Inquiries
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. platform_settings (key-value store for SaaS config) ───
CREATE TABLE IF NOT EXISTS platform_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_all_ps" ON platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = true)
);

-- ── 2. hall_inquiries (client/owner demo request form) ────────
-- Stores requests from prospective hall owners on the marketing site.
-- These appear in the super-admin requests inbox.
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

ALTER TABLE hall_inquiries ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "sa_all_inquiries" ON hall_inquiries FOR ALL USING (
  EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid() AND is_active = true)
);
-- Public can only INSERT (submit form)
CREATE POLICY "public_insert_inquiry" ON hall_inquiries FOR INSERT WITH CHECK (true);

-- Index for unread count
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_status
  ON hall_inquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hall_inquiries_unread
  ON hall_inquiries(is_read, created_at DESC);

-- ── 3. Seat reservation logic — trigger ───────────────────────
-- When a student submits a booking request (status='pending'),
-- mark the requested seat as 'reserved'.
-- When the request is rejected/cancelled, free the seat back to 'available'.
-- When approved, the seat goes to 'occupied' (handled by existing membership trigger).

CREATE OR REPLACE FUNCTION sync_seat_on_booking_request()
RETURNS TRIGGER AS $$
BEGIN
  -- New pending request → reserve the seat
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.requested_seat_id IS NOT NULL) THEN
    UPDATE seats
    SET status = 'reserved'
    WHERE id = NEW.requested_seat_id
      AND status = 'available';  -- only reserve if actually free
    RETURN NEW;
  END IF;

  -- Status changed
  IF (TG_OP = 'UPDATE' AND NEW.requested_seat_id IS NOT NULL) THEN
    -- Rejected or cancelled → free the seat
    IF NEW.status IN ('rejected','cancelled') AND OLD.status = 'pending' THEN
      -- Only free it if no other pending request holds it
      IF NOT EXISTS (
        SELECT 1 FROM seat_booking_requests
        WHERE requested_seat_id = NEW.requested_seat_id
          AND status = 'pending'
          AND id != NEW.id
      ) THEN
        UPDATE seats
        SET status = 'available'
        WHERE id = NEW.requested_seat_id
          AND status = 'reserved';
      END IF;
    END IF;

    -- Approved → seat will go to 'occupied' via the membership trigger
    -- (no action needed here, membership insert handles it)
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_seat_on_booking_request ON seat_booking_requests;
CREATE TRIGGER trg_sync_seat_on_booking_request
  AFTER INSERT OR UPDATE ON seat_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_seat_on_booking_request();

-- ── 4. Also handle student self-registration preferred_seat ───
-- When a student registers with a preferred seat (status=pending),
-- reserve the preferred seat so others can't pick it.

CREATE OR REPLACE FUNCTION sync_seat_on_student_register()
RETURNS TRIGGER AS $$
BEGIN
  -- New pending student with a preferred seat → reserve it
  IF (TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.preferred_seat_id IS NOT NULL) THEN
    UPDATE seats
    SET status = 'reserved'
    WHERE id = NEW.preferred_seat_id
      AND status = 'available';
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Student rejected → free the preferred seat
    IF NEW.status = 'rejected' AND OLD.status = 'pending' AND OLD.preferred_seat_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM seat_booking_requests
        WHERE requested_seat_id = OLD.preferred_seat_id
          AND status = 'pending'
      ) AND NOT EXISTS (
        SELECT 1 FROM students
        WHERE preferred_seat_id = OLD.preferred_seat_id
          AND status = 'pending'
          AND id != OLD.id
      ) THEN
        UPDATE seats
        SET status = 'available'
        WHERE id = OLD.preferred_seat_id
          AND status = 'reserved';
      END IF;
    END IF;

    -- Student activated → seat goes to occupied via membership trigger
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_seat_on_student_register ON students;
CREATE TRIGGER trg_sync_seat_on_student_register
  AFTER INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION sync_seat_on_student_register();

SELECT 'Migration 008 complete — platform_settings, hall_inquiries, seat reservation triggers' AS result;
