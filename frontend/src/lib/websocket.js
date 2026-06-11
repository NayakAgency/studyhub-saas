// ============================================================
// WebSocket Client
// Manages real-time connection with automatic reconnection
// ============================================================

const WS_URL = import.meta.env.VITE_WS_URL || 
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
  (import.meta.env.VITE_API_HOST || window.location.host);

const MAX_RETRIES     = 8;
const BASE_DELAY_MS   = 1000;

class WebSocketClient {
  constructor() {
    this.ws            = null;
    this.token         = null;
    this.retries       = 0;
    this.retryTimer    = null;
    this.listeners     = new Map();   // event → Set<callback>
    this.subscriptions = new Set();   // channel names to resubscribe on reconnect
    this.connected     = false;
    this.intentionalClose = false;
  }

  // ── Public API ──────────────────────────────────────────────

  connect(token) {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.token = token;
    this.intentionalClose = false;
    this._open();
  }

  disconnect() {
    this.intentionalClose = true;
    clearTimeout(this.retryTimer);
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
    this.retries   = 0;
  }

  subscribe(channels) {
    channels.forEach(ch => this.subscriptions.add(ch));
    if (this.connected) {
      this._send({ type: 'subscribe', channels });
    }
  }

  unsubscribe(channels) {
    channels.forEach(ch => this.subscriptions.delete(ch));
    if (this.connected) {
      this._send({ type: 'unsubscribe', channels });
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback); // returns unsubscribe fn
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  // ── Internal ────────────────────────────────────────────────

  _open() {
    try {
      this.ws = new WebSocket(`${WS_URL}?token=${this.token}`);

      this.ws.onopen = () => {
        this.connected = true;
        this.retries   = 0;
        console.log('[WS] Connected');
        this._emit('connected');

        // Re-subscribe to all channels after reconnect
        if (this.subscriptions.size > 0) {
          this._send({ type: 'subscribe', channels: Array.from(this.subscriptions) });
        }
      };

      this.ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data);
          this._emit(msg.type, msg);
          this._emit('*', msg); // wildcard listener
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onclose = (e) => {
        this.connected = false;
        this._emit('disconnected', { code: e.code, reason: e.reason });

        if (!this.intentionalClose && this.retries < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, this.retries);
          this.retries++;
          console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.retries})`);
          this.retryTimer = setTimeout(() => this._open(), delay);
        }
      };

      this.ws.onerror = (e) => {
        console.error('[WS] Error:', e);
        this._emit('error', e);
      };
    } catch (err) {
      console.error('[WS] Failed to open:', err);
    }
  }

  _send(payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch { /* ignore listener errors */ }
    });
  }

  get status() {
    if (!this.ws) return 'disconnected';
    return ['connecting', 'open', 'closing', 'closed'][this.ws.readyState] ?? 'unknown';
  }
}

// Singleton
export const wsClient = new WebSocketClient();