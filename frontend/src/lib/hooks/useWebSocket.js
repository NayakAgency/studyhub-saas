// ============================================================
// useWebSocket hook
// Connect to WS, subscribe to channels, receive typed events
// ============================================================

import React, { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient } from '../websocket.js';
import useAuthStore from '../../store/authStore.js';

/**
 * @param {string[]} channels   - channel names to subscribe to
 * @param {Object}  handlers    - { [eventType]: handler }
 */
export function useWebSocket(channels = [], handlers = {}) {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Connect / disconnect on token change
  useEffect(() => {
    if (!accessToken) {
      wsClient.disconnect();
      return;
    }
    wsClient.connect(accessToken);
    return () => { /* don't disconnect on unmount — singleton stays alive */ };
  }, [accessToken]);

  // Subscribe to channels while mounted
  useEffect(() => {
    if (!channels.length) return;
    wsClient.subscribe(channels);
    return () => wsClient.unsubscribe(channels);
  }, [channels.join(',')]); // eslint-disable-line

  // Attach handlers
  useEffect(() => {
    const unsubs = Object.entries(handlersRef.current).map(([event, cb]) =>
      wsClient.on(event, (msg) => cb(msg, queryClient))
    );
    return () => unsubs.forEach((fn) => fn());
  }, []); // eslint-disable-line — handlers are kept in ref

  return wsClient;
}

// ── Specific hooks ─────────────────────────────────────────

/** Admin: live dashboard stats + notifications */
export function useAdminWebSocket() {
  const queryClient = useQueryClient();

  return useWebSocket(
    ['seat-updates', 'payment-updates', 'announcements'],
    {
      'dashboard-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      },
      'seat-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['admin', 'seats'] });
        qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      },
      'payment-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['admin', 'fees'] });
        qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      },
      'new-student-notification': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['admin', 'dashboard', 'stats'] });
      },
    }
  );
}

/** Student: live notifications + membership changes */
export function useStudentWebSocket() {
  return useWebSocket(
    ['notifications', 'seat-updates', 'payment-updates'],
    {
      'notification': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['student', 'notifications'] });
        qc.invalidateQueries({ queryKey: ['student', 'notifications', 'count'] });
      },
      'membership-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
        qc.invalidateQueries({ queryKey: ['student', 'membership'] });
      },
      'payment-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['student', 'fees'] });
        qc.invalidateQueries({ queryKey: ['student', 'dashboard'] });
      },
      'seat-update': (_msg, qc) => {
        qc.invalidateQueries({ queryKey: ['student', 'seat'] });
      },
    }
  );
}

/** Connection status indicator hook — returns reactive status string */
export function useWsStatus() {
  const [status, setStatus] = React.useState(() => wsClient.status);

  useEffect(() => {
    const unsubConn = wsClient.on('connected',    () => setStatus('open'));
    const unsubDisc = wsClient.on('disconnected', () => setStatus(wsClient.status));
    // Sync immediately in case status changed between renders
    setStatus(wsClient.status);
    return () => { unsubConn(); unsubDisc(); };
  }, []);

  return status;
}