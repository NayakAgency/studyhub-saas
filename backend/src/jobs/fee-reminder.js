// ============================================================
// Cron Job: Fee Reminders
// Runs daily at 09:00 AM
// ============================================================

import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase.js';
import { createNotification, NOTIFICATION_TYPES } from '../services/notification.service.js';
import { sendFeeReminderEmail } from '../services/email.service.js';

export const startFeeReminderJob = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Running fee reminder job...');

    try {
      const today = new Date();
      const currentDay = today.getDate();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();

      const { data: tenants } = await supabaseAdmin
        .from('tenants').select('id, hall_name, slug').eq('status', 'active');

      if (!tenants?.length) {
        console.log('[CRON] No active tenants found');
        return;
      }

      let totalReminders = 0;

      for (const tenant of tenants) {
        try {
          const { data: settings } = await supabaseAdmin
            .from('hall_settings')
            .select('fee_due_day, currency_symbol, fee_reminder_days')
            .eq('tenant_id', tenant.id)
            .single();

          const feeDueDay = settings?.fee_due_day || 5;
          const reminderDays = settings?.fee_reminder_days || [3, 1]; // Remind 3 days and 1 day before
          
          // Calculate due date for current month
          const currentMonthDueDate = new Date(currentYear, currentMonth, feeDueDay);
          const nextMonthDueDate = new Date(currentYear, currentMonth + 1, feeDueDay);
          
          // Determine which due date to use
          let relevantDueDate;
          if (currentDay <= feeDueDay) {
            relevantDueDate = currentMonthDueDate;
          } else {
            relevantDueDate = nextMonthDueDate;
          }

          const daysUntilDue = Math.ceil((relevantDueDate - today) / (1000 * 60 * 60 * 24));

          // Check if today is a reminder day or due date
          const shouldSendReminder = reminderDays.includes(daysUntilDue) || daysUntilDue === 0;

          if (!shouldSendReminder) continue;

          // Find students with active memberships who need fee reminders
          const { data: memberships } = await supabaseAdmin
            .from('memberships')
            .select(`
              id, student_id, end_date,
              plan:subscription_plans(plan_name, price),
              student:students(full_name, email)
            `)
            .eq('tenant_id', tenant.id)
            .eq('status', 'active');

          if (!memberships?.length) continue;

          let tenantReminders = 0;

          for (const membership of memberships) {
            // Check if membership needs renewal payment
            const membershipEndDate = new Date(membership.end_date);
            const needsRenewal = membershipEndDate <= relevantDueDate;

            if (!needsRenewal) continue;

            const reminderType = daysUntilDue === 0 ? 'overdue' : 'reminder';
            const title = daysUntilDue === 0 ? 'Fee Overdue' : 'Fee Reminder';
            const urgencyText = daysUntilDue === 0 
              ? 'is now overdue' 
              : `is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`;

            // Create notification
            await createNotification({
              tenantId: tenant.id,
              studentId: membership.student_id,
              type: NOTIFICATION_TYPES.FEE_REMINDER,
              title,
              body: `Your membership fee of ${settings?.currency_symbol || '₹'}${membership.plan?.price} ${urgencyText}. Please renew to maintain your seat.`,
              referenceId: membership.id,
              referenceType: 'membership',
            });

            // Send email if available
            if (membership.student?.email) {
              await sendFeeReminderEmail({
                studentEmail: membership.student.email,
                studentName: membership.student.full_name,
                dueAmount: membership.plan?.price,
                hallName: tenant.hall_name,
                dueDate: relevantDueDate.toLocaleDateString(),
                currencySymbol: settings?.currency_symbol || '₹',
                isOverdue: daysUntilDue === 0,
                daysUntilDue,
                slug: tenant.slug,
              });
            }

            tenantReminders++;
          }

          console.log(`[CRON] ${tenant.hall_name}: sent ${tenantReminders} fee reminders`);
          totalReminders += tenantReminders;

        } catch (tenantError) {
          console.error(`[CRON] Fee reminder error for tenant ${tenant.id}:`, tenantError.message);
        }
      }

      console.log(`[CRON] Fee reminders complete: ${totalReminders} total`);
    } catch (error) {
      console.error('[CRON] Fee reminder error:', error.message);
    }
  });
};
