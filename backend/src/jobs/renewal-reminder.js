// ============================================================
// Cron Job: Renewal Reminders
// Runs daily at 08:00 AM
// Sends renewal reminders for memberships expiring in X days
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notification.service.js';
import { sendRenewalReminderEmail } from '../services/email.service.js';
import { env } from '../config/env.js';

export const startRenewalReminderJob = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Running renewal reminder job...');

    try {
      const today = new Date().toISOString().split('T')[0];

      // Get all active memberships expiring in reminder window
      const { data: memberships } = await supabaseAdmin
        .from('memberships')
        .select(`
          id, end_date, tenant_id, student_id,
          plan:subscription_plans(plan_name),
          student:students(full_name, email, phone),
          tenant:tenants(hall_name, slug)
        `)
        .eq('status', 'active')
        .gte('end_date', today);

      if (!memberships?.length) return;

      let reminded = 0;
      for (const membership of memberships) {
        const daysLeft = Math.ceil(
          (new Date(membership.end_date) - new Date()) / (1000 * 60 * 60 * 24)
        );

        // Get tenant reminder setting
        const { data: settings } = await supabaseAdmin
          .from('hall_settings')
          .select('renewal_reminder_days')
          .eq('tenant_id', membership.tenant_id)
          .single();

        const reminderDays = settings?.renewal_reminder_days || 7;

        if (daysLeft === reminderDays || daysLeft === 3 || daysLeft === 1) {
          // In-app notification
          await createNotification({
            tenantId: membership.tenant_id,
            studentId: membership.student_id,
            type: NOTIFICATION_TYPES.RENEWAL_REMINDER,
            title: 'Membership Expiring Soon',
            body: `Your membership expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Please renew to keep your seat.`,
            referenceId: membership.id,
            referenceType: 'membership',
          });

          // Email if available
          if (membership.student?.email) {
            await sendRenewalReminderEmail({
              studentEmail: membership.student.email,
              studentName: membership.student.full_name,
              expiryDate: membership.end_date,
              hallName: membership.tenant?.hall_name,
              daysLeft,
              loginUrl: `${env.appUrl}/${membership.tenant?.slug}/membership`,
            });
          }

          reminded++;
        }
      }

      console.log(`[CRON] Renewal reminders sent: ${reminded}`);
    } catch (error) {
      console.error('[CRON] Renewal reminder error:', error.message);
    }
  });
};
