-- ============================================================
-- Push Notifications Migration
-- Firebase FCM push token storage for mobile devices
-- ============================================================

-- Push tokens table for storing FCM registration tokens
CREATE TABLE IF NOT EXISTS push_tokens (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id      UUID REFERENCES students(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id       TEXT NOT NULL,
  device_model    TEXT,
  os_version      TEXT,
  app_version     TEXT,
  is_active       BOOLEAN DEFAULT true,
  last_used       TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one token per user per device
  UNIQUE (user_id, device_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active 
  ON push_tokens(user_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_tokens_student_active 
  ON push_tokens(student_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_tokens_tenant 
  ON push_tokens(tenant_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_push_tokens_token 
  ON push_tokens(token) 
  WHERE is_active = true;

-- RLS Policies
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tokens
CREATE POLICY push_tokens_select_own 
  ON push_tokens FOR SELECT 
  USING (user_id = auth.uid());

-- Users can insert/update their own tokens
CREATE POLICY push_tokens_insert_own 
  ON push_tokens FOR INSERT 
  WITH CHECK (user_id = auth.uid());

CREATE POLICY push_tokens_update_own 
  ON push_tokens FOR UPDATE 
  USING (user_id = auth.uid());

-- Users can deactivate their own tokens
CREATE POLICY push_tokens_delete_own 
  ON push_tokens FOR DELETE 
  USING (user_id = auth.uid());

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER push_tokens_updated_at_trigger
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();

-- Function to deactivate old/stale tokens
CREATE OR REPLACE FUNCTION deactivate_stale_push_tokens(
  p_days_inactive INTEGER DEFAULT 90
)
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE push_tokens
  SET is_active = false
  WHERE is_active = true
    AND last_used < NOW() - (p_days_inactive || ' days')::INTERVAL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get active tokens for a student
CREATE OR REPLACE FUNCTION get_student_push_tokens(
  p_student_id UUID
)
RETURNS TABLE (
  token       TEXT,
  platform    TEXT,
  device_id   TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.platform, pt.device_id
  FROM push_tokens pt
  WHERE pt.student_id = p_student_id
    AND pt.is_active = true
    AND pt.last_used > NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to get active tokens for a tenant (for broadcasting)
CREATE OR REPLACE FUNCTION get_tenant_push_tokens(
  p_tenant_id UUID,
  p_platform  TEXT DEFAULT NULL
)
RETURNS TABLE (
  token       TEXT,
  student_id  UUID,
  platform    TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.token, pt.student_id, pt.platform
  FROM push_tokens pt
  WHERE pt.tenant_id = p_tenant_id
    AND pt.is_active = true
    AND pt.last_used > NOW() - INTERVAL '90 days'
    AND (p_platform IS NULL OR pt.platform = p_platform);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE push_tokens IS 'Firebase Cloud Messaging push notification tokens for mobile devices';
COMMENT ON FUNCTION deactivate_stale_push_tokens IS 'Deactivates push tokens that have not been used for the specified number of days';
COMMENT ON FUNCTION get_student_push_tokens IS 'Returns all active push tokens for a specific student';
COMMENT ON FUNCTION get_tenant_push_tokens IS 'Returns all active push tokens for students in a tenant (for broadcasting)';
