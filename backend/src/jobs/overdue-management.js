// ============================================================
// Cron Job: Overdue Fee Management
// Runs daily at 10:00 AM
// Handles overdue fees and seat suspension logic
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notification.service.js';

export const startOverdueManagementJob = () => {
  cron.schedule('0 10 * * *', async () => {
    console.log('[CRON] Running overdue management job...');

    try {
      const today = new Date();
      const { data: tenants } = await supabaseAdmin
        .from('tenants').select('id, hall_name').eq('status', 'active');

      if (!tenants?.length) {
        console.log('[CRON] No active tenants found');
        return;
      }

      let totalSuspended = 0;

      for (const tenant of tenants) {
        try {
          const { data: settings } = await supabaseAdmin
            .from('hall_settings')
            .select('fee_due_day, grace_period_days, auto_suspend_overdue')
            .eq('tenant_id', tenant.id)
            .single();

          const feeDueDay = settings?.fee_due_day || 5;
          const gracePeriodDays = settings?.grace_period_days || 7;
          const autoSuspend = settings?.auto_suspend_overdue ?? true;

          if (!autoSuspend) {
            console.log(`[CRON] Auto-suspension disabled for ${tenant.hall_name}`);
            continue;
          }

          // Calculate overdue threshold date
          const currentMonth = today.getMonth();
          const currentYear = today.getFullYear();
          let overdueThresholdDate;

          if (today.getDate() > feeDueDay) {
            // Current month due date has passed
            overdueThresholdDate = new Date(currentYear, currentMonth, feeDueDay);
          } else {
            // Previous month due date
            overdueThresholdDate = new Date(currentYear, currentMonth - 1, feeDueDay);
          }

          // Add grace period
          overdueThresholdDate.setDate(overdueThresholdDate.getDate() + gracePeriodDays);

          // Find memberships that are severely overdue
          const { data: overdueMemberships } = await supabaseAdmin
            .from('memberships')
            .select(`
              id, student_id, seat_id, end_date,
              plan:subscription_plans(plan_name, price),
              student:students(full_name, email, phone)
            `)
            .eq('tenant_id', tenant.id)
            .eq('status', 'active')
            .lt('end_date', overdueThresholdDate.toISOString().split('T')[0]);

          let tenantSuspensions = 0;

          for (const membership of (overdueMemberships || [])) {
            // Suspend the membership
            await supabaseAdmin
              .from('memberships')
              .update({ 
                status: 'suspended',
                suspended_at: today.toISOString(),
                suspension_reason: 'overdue_payment'
              })
              .eq('id', membership.id);

            // Mark seat as temporarily unavailable (suspended)
            if (membership.seat_id) {
              await supabaseAdmin
                .from('seats')
                .update({ 
                  status: 'suspended',
                  suspended_student_id: membership.student_id
                })
                .eq('id', membership.seat_id);
            }

            // Notify student about suspension
            await createNotification({
              tenantId: tenant.id,
              studentId: membership.student_id,
              type: NOTIFICATION_TYPES.MEMBERSHIP_SUSPENDED,
              title: 'Membership Suspended',
              body: `Your membership has been suspended due to overdue payment. Please contact admin to resolve and reactivate.`,
              referenceId: membership.id,
              referenceType: 'membership',
            });

            tenantSuspensions++;
          }

          if (tenantSuspensions > 0) {
            console.log(`[CRON] ${tenant.hall_name}: suspended ${tenantSuspensions} overdue memberships`);
          }
          
          totalSuspended += tenantSuspensions;

        } catch (tenantError) {
          console.error(`[CRON] Overdue management error for tenant ${tenant.id}:`, tenantError.message);
        }
      }

      console.log(`[CRON] Overdue management complete: ${totalSuspended} memberships suspended`);
    } catch (error) {
      console.error('[CRON] Overdue management error:', error.message);
    }
  });
};