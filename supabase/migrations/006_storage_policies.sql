-- ============================================================
-- StudyHub — Migration 006: Storage Bucket Policies
-- Run AFTER creating buckets in Supabase Dashboard
-- Buckets to create (all Public read):
--   payment-screenshots, profile-photos, study-resources,
--   hall-logos, gallery-images
-- ============================================================

-- ── payment-screenshots ──────────────────────────────────────
-- Only authenticated users can upload; tenant-scoped paths
INSERT INTO storage.buckets (id, name, public)
  VALUES ('payment-screenshots', 'payment-screenshots', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_payment_screenshots"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-screenshots');

CREATE POLICY "public_read_payment_screenshots"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-screenshots');

CREATE POLICY "auth_delete_payment_screenshots"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'payment-screenshots');

-- ── profile-photos ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('profile-photos', 'profile-photos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_profile_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'profile-photos');

CREATE POLICY "public_read_profile_photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profile-photos');

CREATE POLICY "auth_delete_profile_photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-photos');

-- ── study-resources ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('study-resources', 'study-resources', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_study_resources"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'study-resources');

CREATE POLICY "public_read_study_resources"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'study-resources');

CREATE POLICY "auth_delete_study_resources"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'study-resources');

-- ── hall-logos ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('hall-logos', 'hall-logos', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_hall_logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'hall-logos');

CREATE POLICY "public_read_hall_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'hall-logos');

CREATE POLICY "auth_delete_hall_logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'hall-logos');

-- ── gallery-images ───────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
  VALUES ('gallery-images', 'gallery-images', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "auth_upload_gallery_images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gallery-images');

CREATE POLICY "public_read_gallery_images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'gallery-images');

CREATE POLICY "auth_delete_gallery_images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'gallery-images');
