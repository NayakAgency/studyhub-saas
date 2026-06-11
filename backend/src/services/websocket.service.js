// ============================================================
// WebSocket Service
// Serverless-safe: all methods are no-ops.
// In production on Vercel, use Supabase Realtime on the client
// for live seat/payment/notification updates.
// ============================================================

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.tenantClients = new Map();
  }

  initialize(_server) {}
  startHeartbeat() {}
  sendToClient(_ws, _msg) {}
  sendToUser(_userId, _msg) { return false; }
  sendToTenant(_tenantId, _msg, _exclude) {}
  sendToTenantRole(_tenantId, _role, _msg) {}
  sendToChannel(_ch, _msg, _tenantId) {}
  broadcastNotification(_t, _s, _n) {}
  broadcastSeatUpdate(_t, _u) {}
  broadcastPaymentUpdate(_t, _u) {}
  broadcastAnnouncement(_t, _a) {}
  broadcastDashboardUpdate(_t, _s) {}
  broadcastMembershipUpdate(_t, _s, _m) {}

  getStats() {
    return {
      mode: 'serverless',
      totalConnections: 0,
      note: 'Use Supabase Realtime on the client for live updates',
    };
  }
}

export const wsManager = new WebSocketManager();

export const broadcastNotification     = () => {};
export const broadcastSeatUpdate       = () => {};
export const broadcastPaymentUpdate    = () => {};
export const broadcastAnnouncement     = () => {};
export const broadcastDashboardUpdate  = () => {};
export const broadcastMembershipUpdate = () => {};
