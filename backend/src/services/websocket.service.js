// ============================================================
// WebSocket Service - Real-time Updates
// Handles live notifications, seat updates, and dashboard stats
// ============================================================

import { WebSocketServer } from 'ws';
import { verifyJWT } from './auth.service.js';
import { supabaseAdmin } from '../config/supabase.js';

class WebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.tenantClients = new Map(); // tenantId -> Set of client IDs
  }

  initialize(server) {
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    console.log('🔗 WebSocket server initialized');
  }

  async handleConnection(ws, request) {
    try {
      // Extract token from query params or headers
      const url = new URL(request.url, 'http://localhost');
      const token = url.searchParams.get('token') || 
                   request.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify JWT token
      const decoded = await verifyJWT(token);
      if (!decoded) {
        ws.close(1008, 'Invalid token');
        return;
      }

      const userId = decoded.sub;
      const tenantId = decoded.tenant_id;
      const role = decoded.role;

      // Store client info
      ws.userId = userId;
      ws.tenantId = tenantId;
      ws.role = role;
      ws.isAlive = true;

      // Add to client maps
      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      if (!this.tenantClients.has(tenantId)) {
        this.tenantClients.set(tenantId, new Set());
      }
      this.tenantClients.get(tenantId).add(userId);

      // Set up heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle incoming messages
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // Handle disconnection
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection',
        status: 'connected',
        userId,
        tenantId,
        role,
        timestamp: new Date().toISOString(),
      });

      console.log(`[WS] ${role} connected: ${userId}`);
    } catch (error) {
      console.error('[WS] Connection error:', error.message);
      ws.close(1011, 'Connection failed');
    }
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        case 'subscribe':
          this.handleSubscription(ws, message);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscription(ws, message);
          break;
          
        default:
          console.log('[WS] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[WS] Message handling error:', error.message);
    }
  }

  handleSubscription(ws, message) {
    const { channels } = message;
    
    if (!ws.subscriptions) {
      ws.subscriptions = new Set();
    }
    
    channels?.forEach(channel => {
      if (this.isChannelAllowed(ws, channel)) {
        ws.subscriptions.add(channel);
      }
    });
    
    this.sendToClient(ws, {
      type: 'subscribed',
      channels: Array.from(ws.subscriptions || []),
    });
  }

  handleUnsubscription(ws, message) {
    const { channels } = message;
    
    if (!ws.subscriptions) return;
    
    channels?.forEach(channel => {
      ws.subscriptions.delete(channel);
    });
    
    this.sendToClient(ws, {
      type: 'unsubscribed',
      channels: Array.from(ws.subscriptions || []),
    });
  }

  isChannelAllowed(ws, channel) {
    const { tenantId, role, userId } = ws;
    
    // Tenant-specific channels
    if (channel.startsWith(`tenant:${tenantId}`)) {
      return true;
    }
    
    // User-specific channels
    if (channel === `user:${userId}`) {
      return true;
    }
    
    // Admin-only channels
    if (channel.startsWith('admin:') && (role === 'hall_admin' || role === 'super_admin')) {
      return channel.includes(tenantId) || role === 'super_admin';
    }
    
    // Global channels (based on role)
    const globalChannels = {
      'notifications':   ['student', 'hall_admin', 'super_admin'],
      'announcements':   ['student', 'hall_admin'],
      'seat-updates':    ['student', 'hall_admin'],
      'payment-updates': ['student', 'hall_admin'],
    };
    
    return globalChannels[channel]?.includes(role);
  }

  handleDisconnection(ws) {
    const { userId, tenantId } = ws;
    
    if (userId && this.clients.has(userId)) {
      const userConnections = this.clients.get(userId);
      userConnections.delete(ws);
      
      if (userConnections.size === 0) {
        this.clients.delete(userId);
        
        if (tenantId && this.tenantClients.has(tenantId)) {
          this.tenantClients.get(tenantId).delete(userId);
        }
      }
    }
    
    console.log(`[WS] Client disconnected: ${userId}`);
  }

  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  // ============================================================
  // Public Broadcasting Methods
  // ============================================================

  // Send to specific user
  sendToUser(userId, message) {
    const userConnections = this.clients.get(userId);
    if (userConnections) {
      userConnections.forEach(ws => {
        this.sendToClient(ws, message);
      });
      return true;
    }
    return false;
  }

  // Send to all users in a tenant
  sendToTenant(tenantId, message, excludeUserId = null) {
    const tenantUsers = this.tenantClients.get(tenantId);
    if (tenantUsers) {
      tenantUsers.forEach(userId => {
        if (userId !== excludeUserId) {
          this.sendToUser(userId, message);
        }
      });
    }
  }

  // Send to users with specific role in tenant
  sendToTenantRole(tenantId, role, message) {
    const tenantUsers = this.tenantClients.get(tenantId);
    if (tenantUsers) {
      tenantUsers.forEach(userId => {
        const userConnections = this.clients.get(userId);
        if (userConnections) {
          userConnections.forEach(ws => {
            if (ws.role === role) {
              this.sendToClient(ws, message);
            }
          });
        }
      });
    }
  }

  // Send to channel subscribers
  sendToChannel(channel, message, tenantId = null) {
    this.clients.forEach((connections, userId) => {
      connections.forEach(ws => {
        if (ws.subscriptions?.has(channel)) {
          // Check tenant filter if specified
          if (!tenantId || ws.tenantId === tenantId) {
            this.sendToClient(ws, {
              ...message,
              channel,
              timestamp: new Date().toISOString(),
            });
          }
        }
      });
    });
  }

  // ============================================================
  // Specific Event Broadcasters
  // ============================================================

  broadcastNotification(tenantId, studentId, notification) {
    this.sendToUser(studentId, {
      type: 'notification',
      data: notification,
    });

    // Also send to admins
    this.sendToTenantRole(tenantId, 'hall_admin', {
      type: 'new-student-notification',
      studentId,
      data: notification,
    });
  }

  broadcastSeatUpdate(tenantId, seatUpdate) {
    this.sendToChannel('seat-updates', {
      type: 'seat-update',
      data: seatUpdate,
    }, tenantId);
  }

  broadcastPaymentUpdate(tenantId, paymentUpdate) {
    this.sendToChannel('payment-updates', {
      type: 'payment-update',
      data: paymentUpdate,
    }, tenantId);
  }

  broadcastAnnouncement(tenantId, announcement) {
    this.sendToChannel('announcements', {
      type: 'announcement',
      data: announcement,
    }, tenantId);
  }

  broadcastDashboardUpdate(tenantId, stats) {
    this.sendToTenantRole(tenantId, 'hall_admin', {
      type: 'dashboard-update',
      data: stats,
    });
  }

  broadcastMembershipUpdate(tenantId, studentId, membership) {
    this.sendToUser(studentId, {
      type: 'membership-update',
      data: membership,
    });

    this.sendToTenantRole(tenantId, 'hall_admin', {
      type: 'student-membership-update',
      studentId,
      data: membership,
    });
  }

  // ============================================================
  // Health & Monitoring
  // ============================================================

  startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((connections) => {
        connections.forEach(ws => {
          if (!ws.isAlive) {
            ws.terminate();
            return;
          }
          
          ws.isAlive = false;
          ws.ping();
        });
      });
    }, 30000); // 30 seconds
  }

  getStats() {
    const totalConnections = Array.from(this.clients.values())
      .reduce((sum, connections) => sum + connections.size, 0);
    
    const tenantStats = {};
    this.tenantClients.forEach((users, tenantId) => {
      tenantStats[tenantId] = users.size;
    });
    
    return {
      totalConnections,
      uniqueUsers: this.clients.size,
      tenantCount: this.tenantClients.size,
      tenantStats,
    };
  }
}

// Create singleton instance
export const wsManager = new WebSocketManager();

// Convenience functions for broadcasting
export const broadcastNotification = (tenantId, studentId, notification) => {
  wsManager.broadcastNotification(tenantId, studentId, notification);
};

export const broadcastSeatUpdate = (tenantId, seatUpdate) => {
  wsManager.broadcastSeatUpdate(tenantId, seatUpdate);
};

export const broadcastPaymentUpdate = (tenantId, paymentUpdate) => {
  wsManager.broadcastPaymentUpdate(tenantId, paymentUpdate);
};

export const broadcastAnnouncement = (tenantId, announcement) => {
  wsManager.broadcastAnnouncement(tenantId, announcement);
};

export const broadcastDashboardUpdate = (tenantId, stats) => {
  wsManager.broadcastDashboardUpdate(tenantId, stats);
};

export const broadcastMembershipUpdate = (tenantId, studentId, membership) => {
  wsManager.broadcastMembershipUpdate(tenantId, studentId, membership);
};