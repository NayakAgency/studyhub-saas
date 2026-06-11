// ============================================================
// Cache Service
// Serverless-safe in-memory cache (no Redis connection on import).
// Falls back to a simple Map-based TTL cache — works fine for
// Vercel serverless where each function invocation is stateless.
// ============================================================

class CacheService {
  constructor() {
    this._store = new Map(); // { key: { value, expiresAt } }
    this.isConnected = false;
    this.defaultTTL = 300;
  }

  async initialize() {
    // No-op: no external connection needed
    this.isConnected = true;
    return true;
  }

  async disconnect() {}

  _isExpired(entry) {
    return entry.expiresAt && Date.now() > entry.expiresAt;
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (this._isExpired(entry)) {
      this._store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttl = this.defaultTTL) {
    this._store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : null,
    });
    return true;
  }

  async del(key) {
    this._store.delete(key);
    return true;
  }

  async exists(key) {
    const entry = this._store.get(key);
    if (!entry) return false;
    if (this._isExpired(entry)) { this._store.delete(key); return false; }
    return true;
  }

  async increment(key, amount = 1) {
    const current = (await this.get(key)) || 0;
    const next = current + amount;
    await this.set(key, next);
    return next;
  }

  async expire(key, ttl) {
    const entry = this._store.get(key);
    if (!entry) return false;
    entry.expiresAt = Date.now() + ttl * 1000;
    return true;
  }

  async mget(keys) {
    return Promise.all(keys.map(k => this.get(k)));
  }

  async mset(pairs, ttl = this.defaultTTL) {
    await Promise.all(pairs.map(({ key, value }) => this.set(key, value, ttl)));
    return true;
  }

  async deletePattern(pattern) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of this._store.keys()) {
      if (regex.test(key)) this._store.delete(key);
    }
    return true;
  }

  // ── App-specific helpers ──────────────────────────────────
  async getDashboardStats(tid)          { return this.get(`dashboard:${tid}`); }
  async setDashboardStats(tid, s, t=300) { return this.set(`dashboard:${tid}`, s, t); }
  async invalidateDashboardStats(tid)   { return this.del(`dashboard:${tid}`); }

  async getStudentProfile(sid)          { return this.get(`student:${sid}`); }
  async setStudentProfile(sid, p, t=600) { return this.set(`student:${sid}`, p, t); }
  async invalidateStudentProfile(sid)   { return this.del(`student:${sid}`); }

  async getSeatLayout(tid)              { return this.get(`seats:${tid}`); }
  async setSeatLayout(tid, l, t=600)    { return this.set(`seats:${tid}`, l, t); }
  async invalidateSeatLayout(tid)       { return this.del(`seats:${tid}`); }

  async getPaymentStats(tid, period)    { return this.get(`payment_stats:${tid}:${period}`); }
  async setPaymentStats(tid, p, s, t=900) { return this.set(`payment_stats:${tid}:${p}`, s, t); }
  async invalidatePaymentStats(tid)     { return this.deletePattern(`payment_stats:${tid}:*`); }

  async getHallSettings(tid)            { return this.get(`settings:${tid}`); }
  async setHallSettings(tid, s, t=1800) { return this.set(`settings:${tid}`, s, t); }
  async invalidateHallSettings(tid)     { return this.del(`settings:${tid}`); }

  async getSubscriptionPlans(tid)       { return this.get(`plans:${tid}`); }
  async setSubscriptionPlans(tid, p, t=1800) { return this.set(`plans:${tid}`, p, t); }
  async invalidateSubscriptionPlans(tid){ return this.del(`plans:${tid}`); }

  async checkRateLimit(key, maxReqs, windowSec) {
    const current = await this.increment(key, 1);
    if (current === 1) await this.expire(key, windowSec);
    return { allowed: current <= maxReqs, remaining: Math.max(0, maxReqs - current), current };
  }

  async setSession(id, data, ttl=3600) { return this.set(`session:${id}`, data, ttl); }
  async getSession(id)                 { return this.get(`session:${id}`); }
  async deleteSession(id)              { return this.del(`session:${id}`); }
  async extendSession(id, ttl=3600)    { return this.expire(`session:${id}`, ttl); }

  async flushAll() { this._store.clear(); return true; }
  isHealthy()      { return true; }
  generateKey(...parts) { return parts.filter(Boolean).join(':'); }

  getStats() {
    return { connected: true, mode: 'in-memory', size: this._store.size };
  }
}

export const cacheService = new CacheService();
// Initialize immediately (synchronous in-memory — no async needed)
cacheService.isConnected = true;

export const cacheOrFetch = async (key, fetchFn, ttl = 300) => {
  const cached = await cacheService.get(key);
  if (cached !== null) return cached;
  const fresh = await fetchFn();
  await cacheService.set(key, fresh, ttl);
  return fresh;
};
