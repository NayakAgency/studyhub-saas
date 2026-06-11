// ============================================================
// Push Notification Service - Firebase Cloud Messaging
// Handles mobile push notifications for iOS and Android
// Optional: requires firebase-admin package + FIREBASE_SERVICE_ACCOUNT env
// ============================================================

import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';

// Lazy-load firebase-admin to avoid hard crash if package not installed
let firebaseAdmin = null;
const getFirebase = async () => {
  if (firebaseAdmin) return firebaseAdmin;
  try {
    const { initializeApp, cert } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');
    firebaseAdmin = { initializeApp, cert, getMessaging };
  } catch {
    // firebase-admin not installed — push notifications disabled
  }
  return firebaseAdmin;
};

class PushNotificationService {
  constructor() {
    this.messaging = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!env.firebaseServiceAccount) {
        console.warn('⚠️  Firebase service account not configured. Push notifications disabled.');
        return;
      }

      const fb = await getFirebase();
      if (!fb) {
        console.warn('⚠️  firebase-admin package not installed. Push notifications disabled.');
        return;
      }

      // Initialize Firebase Admin SDK
      const serviceAccount = JSON.parse(env.firebaseServiceAccount);
      const app = fb.initializeApp({ credential: fb.cert(serviceAccount) });
      this.messaging = fb.getMessaging(app);
      this.initialized = true;
      console.log('🔔 Push notification service initialized');
    } catch (error) {
      console.error('[PUSH] Initialization failed:', error.message);
      this.messaging = null;
    }
  }

  // ============================================================
  // Send Push Notification to Single User
  // ============================================================

  async sendToUser(userId, notification, data = {}) {
    if (!this.isAvailable()) return false;

    try {
      // Get user's push tokens
      const { data: tokens, error } = await supabaseAdmin
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error || !tokens?.length) {
        console.log(`[PUSH] No active tokens found for user ${userId}`);
        return false;
      }

      const results = await Promise.allSettled(
        tokens.map(tokenData => this.sendToToken(tokenData.token, notification, data, tokenData.platform))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[PUSH] Sent to ${successful}/${tokens.length} tokens for user ${userId}`);

      return successful > 0;
    } catch (error) {
      console.error(`[PUSH] Send to user failed: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // Send Push Notification to Multiple Users
  // ============================================================

  async sendToUsers(userIds, notification, data = {}) {
    if (!this.isAvailable() || !userIds?.length) return false;

    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendToUser(userId, notification, data))
      );

      const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
      console.log(`[PUSH] Batch send: ${successful}/${userIds.length} users reached`);

      return successful > 0;
    } catch (error) {
      console.error(`[PUSH] Batch send failed: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // Send to Tenant (All Users in Hall)
  // ============================================================

  async sendToTenant(tenantId, notification, data = {}, roleFilter = null) {
    if (!this.isAvailable()) return false;

    try {
      // Get all active tokens for the tenant
      let query = supabaseAdmin
        .from('push_tokens')
        .select(`
          token, platform, user_id,
          user:users!inner(role, tenant_id)
        `)
        .eq('is_active', true)
        .eq('user.tenant_id', tenantId);

      if (roleFilter) {
        query = query.eq('user.role', roleFilter);
      }

      const { data: tokens, error } = await query;

      if (error || !tokens?.length) {
        console.log(`[PUSH] No active tokens found for tenant ${tenantId}`);
        return false;
      }

      // Send to all tokens in batches
      const batchSize = 500; // FCM batch limit
      const batches = [];

      for (let i = 0; i < tokens.length; i += batchSize) {
        batches.push(tokens.slice(i, i + batchSize));
      }

      let totalSent = 0;

      for (const batch of batches) {
        const batchTokens = batch.map(t => t.token);
        const sent = await this.sendMulticast(batchTokens, notification, data);
        totalSent += sent;
      }

      console.log(`[PUSH] Tenant broadcast: ${totalSent}/${tokens.length} notifications sent`);
      return totalSent > 0;
    } catch (error) {
      console.error(`[PUSH] Tenant broadcast failed: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // Core Firebase Messaging Methods
  // ============================================================

  async sendToToken(token, notification, data = {}, platform = null) {
    if (!this.isAvailable()) return false;

    try {
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      };

      // Platform-specific configuration
      if (platform === 'ios') {
        message.apns = {
          payload: {
            aps: {
              badge: data.badge || 1,
              sound: 'default',
              'content-available': 1,
            },
          },
        };
      } else if (platform === 'android') {
        message.android = {
          priority: 'high',
          notification: {
            icon: 'ic_notification',
            color: '#2563EB',
            sound: 'default',
          },
        };
      }

      const response = await this.messaging.send(message);
      console.log(`[PUSH] Message sent successfully: ${response}`);
      return true;
    } catch (error) {
      if (error.code === 'messaging/registration-token-not-registered') {
        // Token is invalid, mark as inactive
        await this.deactivateToken(token);
      }
      console.error(`[PUSH] Send to token failed: ${error.message}`);
      return false;
    }
  }

  async sendMulticast(tokens, notification, data = {}) {
    if (!this.isAvailable() || !tokens?.length) return 0;

    try {
      const message = {
        tokens,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      };

      const response = await this.messaging.sendMulticast(message);
      
      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            if (resp.error?.code === 'messaging/registration-token-not-registered') {
              this.deactivateToken(tokens[idx]);
            }
          }
        });
        
        console.log(`[PUSH] ${response.failureCount} tokens failed, deactivating invalid tokens`);
      }

      return response.successCount;
    } catch (error) {
      console.error(`[PUSH] Multicast send failed: ${error.message}`);
      return 0;
    }
  }

  // ============================================================
  // Topic-based Messaging
  // ============================================================

  async subscribeToTopic(tokens, topic) {
    if (!this.isAvailable() || !tokens?.length) return false;

    try {
      const response = await this.messaging.subscribeToTopic(tokens, topic);
      console.log(`[PUSH] Subscribed ${response.successCount} tokens to topic: ${topic}`);
      return response.successCount > 0;
    } catch (error) {
      console.error(`[PUSH] Topic subscription failed: ${error.message}`);
      return false;
    }
  }

  async unsubscribeFromTopic(tokens, topic) {
    if (!this.isAvailable() || !tokens?.length) return false;

    try {
      const response = await this.messaging.unsubscribeFromTopic(tokens, topic);
      console.log(`[PUSH] Unsubscribed ${response.successCount} tokens from topic: ${topic}`);
      return response.successCount > 0;
    } catch (error) {
      console.error(`[PUSH] Topic unsubscription failed: ${error.message}`);
      return false;
    }
  }

  async sendToTopic(topic, notification, data = {}) {
    if (!this.isAvailable()) return false;

    try {
      const message = {
        topic,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
      };

      const response = await this.messaging.send(message);
      console.log(`[PUSH] Topic message sent: ${response}`);
      return true;
    } catch (error) {
      console.error(`[PUSH] Topic send failed: ${error.message}`);
      return false;
    }
  }

  // ============================================================
  // Token Management
  // ============================================================

  async deactivateToken(token) {
    try {
      await supabaseAdmin
        .from('push_tokens')
        .update({ is_active: false })
        .eq('token', token);
    } catch (error) {
      console.error(`[PUSH] Token deactivation failed: ${error.message}`);
    }
  }

  async cleanupInactiveTokens() {
    try {
      const { error } = await supabaseAdmin
        .from('push_tokens')
        .delete()
        .eq('is_active', false)
        .lt('last_used', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;
      console.log('[PUSH] Cleaned up inactive tokens');
    } catch (error) {
      console.error(`[PUSH] Token cleanup failed: ${error.message}`);
    }
  }

  // ============================================================
  // Notification Templates
  // ============================================================

  createPaymentNotification(amount, status) {
    return {
      title: status === 'success' ? 'Payment Successful' : 'Payment Failed',
      body: status === 'success' 
        ? `Your payment of ₹${amount} has been processed successfully`
        : `Your payment of ₹${amount} failed. Please try again`,
    };
  }

  createMembershipNotification(type, daysLeft = 0) {
    switch (type) {
      case 'expiring':
        return {
          title: 'Membership Expiring Soon',
          body: `Your membership expires in ${daysLeft} days. Renew now to avoid interruption`,
        };
      case 'expired':
        return {
          title: 'Membership Expired',
          body: 'Your membership has expired. Please contact admin to renew',
        };
      case 'renewed':
        return {
          title: 'Membership Renewed',
          body: 'Your membership has been successfully renewed',
        };
      default:
        return {
          title: 'Membership Update',
          body: 'Your membership status has been updated',
        };
    }
  }

  createComplaintNotification(status) {
    return {
      title: 'Complaint Update',
      body: status === 'resolved' 
        ? 'Your complaint has been resolved'
        : `Your complaint status: ${status}`,
    };
  }

  createAnnouncementNotification(title, body) {
    return {
      title: title || 'New Announcement',
      body: body || 'Check the app for the latest announcement',
    };
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  isAvailable() {
    return this.initialized && this.messaging !== null;
  }

  getStatus() {
    return {
      initialized: this.initialized,
      available: this.isAvailable(),
    };
  }
}

// Create singleton instance
export const pushNotificationService = new PushNotificationService();

// Convenience functions for common use cases
export const sendPaymentNotification = (userId, amount, status) => {
  const notification = pushNotificationService.createPaymentNotification(amount, status);
  return pushNotificationService.sendToUser(userId, notification, { 
    type: 'payment',
    amount: amount.toString(),
    status,
  });
};

export const sendMembershipNotification = (userId, type, daysLeft = 0) => {
  const notification = pushNotificationService.createMembershipNotification(type, daysLeft);
  return pushNotificationService.sendToUser(userId, notification, {
    type: 'membership',
    action: type,
    days_left: daysLeft.toString(),
  });
};

export const sendComplaintNotification = (userId, status) => {
  const notification = pushNotificationService.createComplaintNotification(status);
  return pushNotificationService.sendToUser(userId, notification, {
    type: 'complaint',
    status,
  });
};

export const sendAnnouncementToTenant = (tenantId, title, body) => {
  const notification = pushNotificationService.createAnnouncementNotification(title, body);
  return pushNotificationService.sendToTenant(tenantId, notification, {
    type: 'announcement',
  });
};