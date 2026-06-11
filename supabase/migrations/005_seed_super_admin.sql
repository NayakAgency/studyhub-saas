-- ============================================================
-- StudyHub SaaS Platform - Migration 005: Seed Super Admin
-- ============================================================
-- NOTE: Run this AFTER creating the super admin user in Supabase Auth
-- Replace 'SUPER_ADMIN_USER_ID' with the actual UUID from auth.users

-- Example: After creating auth user via Supabase Auth API or Dashboard
-- INSERT INTO super_admins (user_id, full_name, email)
-- VALUES (
--   'SUPER_ADMIN_USER_ID',  -- Replace with actual UUID
--   'NayakWorks Admin',
--   'admin@studyhub.app'
-- );

-- This SQL is a template - run manually with actual values after auth user creation
-- See backend seed script at: backend/scripts/seed-super-admin.js

-- Insert default platform announcement
-- (Requires super_admin to exist first)
-- INSERT INTO platform_announcements (title, content, type, target, is_active)
-- VALUES (
--   'Welcome to StudyHub',
--   'Welcome to the StudyHub platform! Complete your hall setup to get started.',
--   'info',
--   'all',
--   true
-- );
