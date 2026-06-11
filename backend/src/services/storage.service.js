// ============================================================
// Storage Service
// Manages Supabase Storage operations
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

const BUCKETS = {
  PAYMENT_SCREENSHOTS: 'payment-screenshots',
  PROFILE_PHOTOS: 'profile-photos',
  STUDY_RESOURCES: 'study-resources',
  HALL_LOGOS: 'hall-logos',
  GALLERY_IMAGES: 'gallery-images',
};

// Upload a file buffer to Supabase Storage
export const uploadFile = async ({ bucket, tenantId, buffer, mimeType, ext = 'webp' }) => {
  const filename = `${uuidv4()}.${ext}`;
  const path = tenantId ? `${tenantId}/${filename}` : filename;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
};

// Upload profile photo
export const uploadProfilePhoto = async (buffer, tenantId) => {
  return uploadFile({
    bucket: BUCKETS.PROFILE_PHOTOS,
    tenantId,
    buffer,
    mimeType: 'image/webp',
    ext: 'webp',
  });
};

// Upload payment screenshot
export const uploadPaymentScreenshot = async (buffer, tenantId, mimeType) => {
  const ext = mimeType === 'application/pdf' ? 'pdf' : 'webp';
  return uploadFile({
    bucket: BUCKETS.PAYMENT_SCREENSHOTS,
    tenantId,
    buffer,
    mimeType,
    ext,
  });
};

// Upload hall logo
export const uploadHallLogo = async (buffer, tenantId) => {
  return uploadFile({
    bucket: BUCKETS.HALL_LOGOS,
    tenantId,
    buffer,
    mimeType: 'image/webp',
    ext: 'webp',
  });
};

// Upload gallery image
export const uploadGalleryImage = async (buffer, tenantId) => {
  return uploadFile({
    bucket: BUCKETS.GALLERY_IMAGES,
    tenantId,
    buffer,
    mimeType: 'image/webp',
    ext: 'webp',
  });
};

// Upload study resource PDF
export const uploadStudyResource = async (buffer, tenantId) => {
  return uploadFile({
    bucket: BUCKETS.STUDY_RESOURCES,
    tenantId,
    buffer,
    mimeType: 'application/pdf',
    ext: 'pdf',
  });
};

// Delete a file from storage
export const deleteFile = async (bucket, path) => {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);
  if (error) {
    console.error(`Failed to delete file ${path} from ${bucket}:`, error.message);
  }
};

// Extract path from public URL
export const extractPathFromUrl = (url, bucket) => {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const bucketIndex = urlObj.pathname.indexOf(`/${bucket}/`);
    if (bucketIndex === -1) return null;
    return urlObj.pathname.substring(bucketIndex + bucket.length + 2);
  } catch {
    return null;
  }
};

export { BUCKETS };
