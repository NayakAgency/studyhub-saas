// ============================================================
// Cron Job: Storage Cleanup
// Runs weekly Sunday at 02:00 AM
// Removes orphaned files from Supabase Storage
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { BUCKETS } from '../services/storage.service.js';

export const startStorageCleanupJob = () => {
  cron.schedule('0 2 * * 0', async () => {
    console.log('[CRON] Running storage cleanup job...');

    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Find rejected booking screenshots older than 30 days
      const { data: rejectedBookings } = await supabaseAdmin
        .from('seat_booking_requests')
        .select('payment_screenshot_url')
        .eq('status', 'rejected')
        .lt('created_at', cutoffDate)
        .not('payment_screenshot_url', 'is', null);

      let deleted = 0;
      for (const booking of (rejectedBookings || [])) {
        if (booking.payment_screenshot_url) {
          const url = new URL(booking.payment_screenshot_url);
          const pathParts = url.pathname.split('/');
          const bucketIdx = pathParts.indexOf(BUCKETS.PAYMENT_SCREENSHOTS);
          if (bucketIdx !== -1) {
            const filePath = pathParts.slice(bucketIdx + 1).join('/');
            const { error } = await supabaseAdmin.storage
              .from(BUCKETS.PAYMENT_SCREENSHOTS)
              .remove([filePath]);
            if (!error) deleted++;
          }
        }
      }

      console.log(`[CRON] Storage cleanup: deleted ${deleted} orphaned files`);
    } catch (error) {
      console.error('[CRON] Storage cleanup error:', error.message);
    }
  });
};
