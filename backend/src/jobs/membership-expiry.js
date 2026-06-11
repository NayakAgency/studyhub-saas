// ============================================================
// Cron Job: Membership Auto-Expiry
// Runs daily at 00:05 AM
// Auto-expires overdue memberships + releases seats
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notification.service.js';

export const startMembershipExpiryJob = () => {
  cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Running membership expiry job...');

    try {
      const today = new Date().toISOString().split('T')[0];

      // Find all active memberships that have expired
      const { data: expiredMemberships } = await supabaseAdmin
        .from('memberships')
        .select('id, tenant_id, student_id, seat_id')
        .eq('status', 'active')
        .lt('end_date', today);

      if (!expiredMemberships?.length) {
        console.log('[CRON] No memberships to expire');
        return;
      }

      console.log(`[CRON] Expiring ${expiredMemberships.length} memberships...`);

      for (const membership of expiredMemberships) {
        // Mark membership expired
        await supabaseAdmin
          .from('memberships')
          .update({ status: 'expired' })
          .eq('id', membership.id);

        // Free the seat
        if (membership.seat_id) {
          // Check no other active memberships for this seat
          const { count } = await supabaseAdmin
            .from('memberships')
            .select('*', { count: 'exact', head: true })
            .eq('seat_id', membership.seat_id)
            .eq('status', 'active')
            .neq('id', membership.id);

          if (!count) {
            await supabaseAdmin
              .from('seats')
              .update({ status: 'available' })
              .eq('id', membership.seat_id);
          }
        }

        // Clear student's assigned seat
        await supabaseAdmin
          .from('students')
          .update({ assigned_seat_id: null })
          .eq('id', membership.student_id)
          .eq('assigned_seat_id', membership.seat_id);

        // Notify student
        await createNotification({
          tenantId: membership.tenant_id,
          studentId: membership.student_id,
          type: NOTIFICATION_TYPES.MEMBERSHIP_EXPIRY,
          title: 'Membership Expired',
          body: 'Your membership has expired. Please contact the admin to renew.',
          referenceId: membership.id,
          referenceType: 'membership',
        });
      }

      console.log(`[CRON] Expired ${expiredMemberships.length} memberships`);
    } catch (error) {
      console.error('[CRON] Membership expiry error:', error.message);
    }
  });
};
