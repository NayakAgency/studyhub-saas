// ============================================================
// Cache Invalidation Middleware
// Automatically invalidates caches when data changes
// ============================================================

import { cacheService } from '../services/cache.service.js';
import { 
  broadcastSeatUpdate, 
  broadcastMembershipUpdate, 
  broadcastDashboardUpdate 
} from '../services/websocket.service.js';

// Define cache invalidation rules
const invalidationRules = {
  // Student-related operations
  students: {
    caches: ['dashboard', 'student_profile'],
    broadcast: 'dashboard_update',
  },
  
  // Seat-related operations  
  seats: {
    caches: ['dashboard', 'seat_layout'],
    broadcast: 'seat_update',
  },
  
  // Membership-related operations
  memberships: {
    caches: ['dashboard', 'student_profile'],
    broadcast: 'membership_update',
  },
  
  // Payment-related operations
  payments: {
    caches: ['dashboard', 'payment_stats'],
    broadcast: 'dashboard_update',
  },
  
  // Settings-related operations
  hall_settings: {
    caches: ['settings'],
    broadcast: null,
  },
  
  // Subscription plans
  subscription_plans: {
    caches: ['plans'],
    broadcast: null,
  },
};

export const cacheInvalidationMiddleware = (tableName) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Only process successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            await invalidateCachesForTable(tableName, req);
          } catch (error) {
            console.error('[CACHE-INVALIDATION] Error:', error.message);
          }
        });
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };
};

async function invalidateCachesForTable(tableName, req) {
  const rules = invalidationRules[tableName];
  if (!rules) return;
  
  const tenantId = req.user?.tenant_id || req.tenantId;
  if (!tenantId) return;
  
  console.log(`[CACHE-INVALIDATION] Processing ${tableName} for tenant ${tenantId}`);
  
  // Invalidate specified caches
  const invalidationPromises = rules.caches.map(async (cacheType) => {
    switch (cacheType) {
      case 'dashboard':
        return cacheService.invalidateDashboardStats(tenantId);
        
      case 'student_profile':
        if (req.user?.student_id) {
          return cacheService.invalidateStudentProfile(req.user.student_id);
        }
        break;
        
      case 'seat_layout':
        return cacheService.invalidateSeatLayout(tenantId);
        
      case 'payment_stats':
        return cacheService.invalidatePaymentStats(tenantId);
        
      case 'settings':
        return cacheService.invalidateHallSettings(tenantId);
        
      case 'plans':
        return cacheService.invalidateSubscriptionPlans(tenantId);
        
      default:
        console.warn(`[CACHE-INVALIDATION] Unknown cache type: ${cacheType}`);
    }
  });
  
  await Promise.all(invalidationPromises.filter(Boolean));
  
  // Broadcast real-time updates
  if (rules.broadcast) {
    await broadcastUpdates(rules.broadcast, tableName, tenantId, req);
  }
}

async function broadcastUpdates(broadcastType, tableName, tenantId, req) {
  try {
    switch (broadcastType) {
      case 'seat_update':
        broadcastSeatUpdate(tenantId, {
          type: 'seats_changed',
          timestamp: new Date().toISOString(),
        });
        break;
        
      case 'membership_update':
        if (req.user?.student_id) {
          broadcastMembershipUpdate(tenantId, req.user.student_id, {
            type: 'membership_changed',
            timestamp: new Date().toISOString(),
          });
        }
        break;
        
      case 'dashboard_update':
        // Fetch fresh stats and broadcast
        const freshStats = await getFreshDashboardStats(tenantId);
        if (freshStats) {
          broadcastDashboardUpdate(tenantId, freshStats);
        }
        break;
        
      default:
        console.warn(`[CACHE-INVALIDATION] Unknown broadcast type: ${broadcastType}`);
    }
  } catch (error) {
    console.error(`[CACHE-INVALIDATION] Broadcast error for ${broadcastType}:`, error.message);
  }
}

async function getFreshDashboardStats(tenantId) {
  try {
    // Import here to avoid circular dependencies
    const { supabaseAdmin } = await import('../config/supabase.js');
    
    const { data: stats } = await supabaseAdmin
      .rpc('get_tenant_dashboard_stats', { p_tenant_id: tenantId });
    
    return stats?.[0] || null;
  } catch (error) {
    console.error('[CACHE-INVALIDATION] Failed to fetch fresh dashboard stats:', error.message);
    return null;
  }
}

// Convenience functions for manual cache invalidation
export const invalidateStudentCaches = (tenantId, studentId) => {
  return Promise.all([
    cacheService.invalidateDashboardStats(tenantId),
    cacheService.invalidateStudentProfile(studentId),
  ]);
};

export const invalidatePaymentCaches = (tenantId) => {
  return Promise.all([
    cacheService.invalidateDashboardStats(tenantId),
    cacheService.invalidatePaymentStats(tenantId),
  ]);
};

export const invalidateSeatCaches = (tenantId) => {
  return Promise.all([
    cacheService.invalidateDashboardStats(tenantId),
    cacheService.invalidateSeatLayout(tenantId),
  ]);
};

export const invalidateAllTenantCaches = (tenantId) => {
  return Promise.all([
    cacheService.invalidateDashboardStats(tenantId),
    cacheService.invalidateSeatLayout(tenantId),
    cacheService.invalidatePaymentStats(tenantId),
    cacheService.invalidateHallSettings(tenantId),
    cacheService.invalidateSubscriptionPlans(tenantId),
  ]);
};