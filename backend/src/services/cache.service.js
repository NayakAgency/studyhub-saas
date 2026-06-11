// ============================================================
// Cache Service - Redis Integration
// Handles caching for frequently accessed data
// ============================================================

import { createClient } from 'redis';
import { env } from '../config/env.js';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 300; // 5 minutes default TTL
  }

  async initialize() {
    if (!env.redisUrl && !env.isDev) {
      console.warn('⚠️  Redis not configured. Caching disabled.');
      return;
    }

    try {
      this.client = createClient({
        url: env.redisUrl || 'redis://localhost:6379',
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) return new Error('Redis connection failed');
            return Math.min(retries * 50, 2000);
          },
        },
      });

      this.client.on('error', (err) => {
        console.error('[REDIS] Connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[REDIS] Connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('[REDIS] Ready for commands');
        this.isConnected = true;
      });

      this.client.on('end', () => {
        console.log('[REDIS] Connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
      console.log('🔄 Redis cache initialized');
    } catch (error) {
      console.error('[REDIS] Initialization failed:', error.message);
      this.client = null;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
    }
  }

  // ============================================================
  // Core Cache Operations
  // ============================================================

  async get(key) {
    if (!this.isConnected || !this.client) return null;

    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`[CACHE] Get failed for key ${key}:`, error.message);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[CACHE] Set failed for key ${key}:`, error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`[CACHE] Delete failed for key ${key}:`, error.message);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) return false;

    try {
      return await this.client.exists(key) === 1;
    } catch (error) {
      console.error(`[CACHE] Exists check failed for key ${key}:`, error.message);
      return false;
    }
  }

  async increment(key, amount = 1) {
    if (!this.isConnected || !this.client) return null;

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`[CACHE] Increment failed for key ${key}:`, error.message);
      return null;
    }
  }

  async expire(key, ttl) {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error(`[CACHE] Expire failed for key ${key}:`, error.message);
      return false;
    }
  }

  // ============================================================
  // Batch Operations
  // ============================================================

  async mget(keys) {
    if (!this.isConnected || !this.client || !keys.length) return [];

    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value ? JSON.parse(value) : null);
    } catch (error) {
      console.error('[CACHE] Multi-get failed:', error.message);
      return [];
    }
  }

  async mset(keyValuePairs, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client || !keyValuePairs.length) return false;

    try {
      const pipeline = this.client.multi();
      
      keyValuePairs.forEach(({ key, value }) => {
        pipeline.setEx(key, ttl, JSON.stringify(value));
      });
      
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('[CACHE] Multi-set failed:', error.message);
      return false;
    }
  }

  async deletePattern(pattern) {
    if (!this.isConnected || !this.client) return false;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return true;
    } catch (error) {
      console.error(`[CACHE] Delete pattern failed for ${pattern}:`, error.message);
      return false;
    }
  }

  // ============================================================
  // Application-Specific Cache Methods
  // ============================================================

  // Dashboard statistics cache
  async getDashboardStats(tenantId) {
    return await this.get(`dashboard:${tenantId}`);
  }

  async setDashboardStats(tenantId, stats, ttl = 300) {
    return await this.set(`dashboard:${tenantId}`, stats, ttl);
  }

  async invalidateDashboardStats(tenantId) {
    return await this.del(`dashboard:${tenantId}`);
  }

  // Student profile cache
  async getStudentProfile(studentId) {
    return await this.get(`student:${studentId}`);
  }

  async setStudentProfile(studentId, profile, ttl = 600) {
    return await this.set(`student:${studentId}`, profile, ttl);
  }

  async invalidateStudentProfile(studentId) {
    return await this.del(`student:${studentId}`);
  }

  // Seat layout cache
  async getSeatLayout(tenantId) {
    return await this.get(`seats:${tenantId}`);
  }

  async setSeatLayout(tenantId, layout, ttl = 600) {
    return await this.set(`seats:${tenantId}`, layout, ttl);
  }

  async invalidateSeatLayout(tenantId) {
    return await this.del(`seats:${tenantId}`);
  }

  // Payment statistics cache
  async getPaymentStats(tenantId, period) {
    return await this.get(`payment_stats:${tenantId}:${period}`);
  }

  async setPaymentStats(tenantId, period, stats, ttl = 900) {
    return await this.set(`payment_stats:${tenantId}:${period}`, stats, ttl);
  }

  async invalidatePaymentStats(tenantId) {
    return await this.deletePattern(`payment_stats:${tenantId}:*`);
  }

  // Hall settings cache
  async getHallSettings(tenantId) {
    return await this.get(`settings:${tenantId}`);
  }

  async setHallSettings(tenantId, settings, ttl = 1800) {
    return await this.set(`settings:${tenantId}`, settings, ttl);
  }

  async invalidateHallSettings(tenantId) {
    return await this.del(`settings:${tenantId}`);
  }

  // Subscription plans cache
  async getSubscriptionPlans(tenantId) {
    return await this.get(`plans:${tenantId}`);
  }

  async setSubscriptionPlans(tenantId, plans, ttl = 1800) {
    return await this.set(`plans:${tenantId}`, plans, ttl);
  }

  async invalidateSubscriptionPlans(tenantId) {
    return await this.del(`plans:${tenantId}`);
  }

  // ============================================================
  // Rate Limiting
  // ============================================================

  async checkRateLimit(key, maxRequests, windowSeconds) {
    if (!this.isConnected || !this.client) return { allowed: true, remaining: maxRequests };

    try {
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      
      const remaining = Math.max(0, maxRequests - current);
      const allowed = current <= maxRequests;
      
      return { allowed, remaining, current };
    } catch (error) {
      console.error(`[CACHE] Rate limit check failed for ${key}:`, error.message);
      return { allowed: true, remaining: maxRequests };
    }
  }

  // ============================================================
  // Session Storage
  // ============================================================

  async setSession(sessionId, data, ttl = 3600) {
    return await this.set(`session:${sessionId}`, data, ttl);
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    return await this.del(`session:${sessionId}`);
  }

  async extendSession(sessionId, ttl = 3600) {
    return await this.expire(`session:${sessionId}`, ttl);
  }

  // ============================================================
  // Cache Warming
  // ============================================================

  async warmCache(tenantId) {
    if (!this.isConnected) return;

    try {
      console.log(`[CACHE] Warming cache for tenant ${tenantId}`);
      
      // This would be called with actual data from the database
      // Implementation would depend on your specific needs
      
      return true;
    } catch (error) {
      console.error(`[CACHE] Cache warming failed for tenant ${tenantId}:`, error.message);
      return false;
    }
  }

  // ============================================================
  // Monitoring & Health
  // ============================================================

  async getInfo() {
    if (!this.isConnected || !this.client) {
      return { connected: false, info: null };
    }

    try {
      const info = await this.client.info();
      const memoryUsage = await this.client.info('memory');
      
      return {
        connected: true,
        info: {
          server: info,
          memory: memoryUsage,
        },
      };
    } catch (error) {
      console.error('[CACHE] Info retrieval failed:', error.message);
      return { connected: false, error: error.message };
    }
  }

  async flushAll() {
    if (!this.isConnected || !this.client) return false;

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('[CACHE] Flush all failed:', error.message);
      return false;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  generateKey(...parts) {
    return parts.filter(Boolean).join(':');
  }

  isHealthy() {
    return this.isConnected && this.client;
  }

  getStats() {
    return {
      connected: this.isConnected,
      client: !!this.client,
    };
  }
}

// Create singleton instance
export const cacheService = new CacheService();

// Convenience wrapper for cache-or-fetch pattern
export const cacheOrFetch = async (key, fetchFunction, ttl = 300) => {
  // Try to get from cache first
  const cached = await cacheService.get(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const fresh = await fetchFunction();
  
  // Cache the result
  await cacheService.set(key, fresh, ttl);
  
  return fresh;
};