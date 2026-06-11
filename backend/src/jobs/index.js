// ============================================================
// Cron Jobs Manager
// Centralized management of all scheduled jobs
// ============================================================

import { startRenewalReminderJob } from './renewal-reminder.js';
import { startFeeReminderJob } from './fee-reminder.js';
import { startMembershipExpiryJob } from './membership-expiry.js';
import { startOverdueManagementJob } from './overdue-management.js';
import { startStorageCleanupJob } from './storage-cleanup.js';
import { startMaintenanceJob } from './maintenance.js';
import { env } from '../config/env.js';

// Job registry with metadata
const JOBS = [
  {
    name: 'membership-expiry',
    description: 'Auto-expires overdue memberships and releases seats',
    schedule: '5 0 * * *', // 00:05 AM daily
    startFunction: startMembershipExpiryJob,
    enabled: true,
  },
  {
    name: 'renewal-reminder',
    description: 'Sends renewal reminders for expiring memberships',
    schedule: '0 8 * * *', // 08:00 AM daily
    startFunction: startRenewalReminderJob,
    enabled: true,
  },
  {
    name: 'fee-reminder',
    description: 'Sends fee payment reminders',
    schedule: '0 9 * * *', // 09:00 AM daily
    startFunction: startFeeReminderJob,
    enabled: true,
  },
  {
    name: 'overdue-management',
    description: 'Handles overdue payments and seat suspension',
    schedule: '0 10 * * *', // 10:00 AM daily
    startFunction: startOverdueManagementJob,
    enabled: true,
  },
  {
    name: 'storage-cleanup',
    description: 'Removes orphaned files from storage',
    schedule: '0 2 * * 0', // 02:00 AM every Sunday
    startFunction: startStorageCleanupJob,
    enabled: true,
  },
  {
    name: 'database-maintenance',
    description: 'Refreshes views and cleans up database',
    schedule: '0 3 * * *', // 03:00 AM daily
    startFunction: startMaintenanceJob,
    enabled: true,
  },
];

export const startAllJobs = () => {
  console.log('\n⏰ Initializing cron jobs...');
  
  if (!env.isProd) {
    console.log('ℹ️  Cron jobs disabled in development mode');
    console.log('   Set NODE_ENV=production to enable cron jobs\n');
    return;
  }

  let startedCount = 0;

  JOBS.forEach((job) => {
    if (job.enabled) {
      try {
        job.startFunction();
        console.log(`   ✓ ${job.name}: ${job.description}`);
        console.log(`     Schedule: ${job.schedule}`);
        startedCount++;
      } catch (error) {
        console.error(`   ✗ Failed to start ${job.name}:`, error.message);
      }
    } else {
      console.log(`   - ${job.name}: disabled`);
    }
  });

  console.log(`\n✅ ${startedCount}/${JOBS.length} cron jobs started successfully\n`);
};

export const listJobs = () => {
  return JOBS.map(({ startFunction, ...job }) => job);
};

// Health check for jobs (can be used by monitoring)
export const getJobsHealth = () => {
  return {
    total: JOBS.length,
    enabled: JOBS.filter(j => j.enabled).length,
    environment: env.nodeEnv,
    cronEnabled: env.isProd,
  };
};