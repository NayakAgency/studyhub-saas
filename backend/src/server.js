// ============================================================
// Server Entry Point
// Starts Express + WebSocket + cron jobs
// ============================================================

import './config/env.js'; // Validate env vars first
import { createServer } from 'http';
import app from './app.js';
import { env } from './config/env.js';
import { startAllJobs } from './jobs/index.js';
import { wsManager } from './services/websocket.service.js';
import { cacheService } from './services/cache.service.js';

const PORT = env.port;

// Create HTTP server (needed for WebSocket upgrade)
const server = createServer(app);

// Initialize WebSocket
wsManager.initialize(server);
wsManager.startHeartbeat();

server.listen(PORT, async () => {
  console.log(`\n🚀 StudyHub API running on port ${PORT}`);
  console.log(`   Environment : ${env.nodeEnv}`);
  console.log(`   HTTP        : http://localhost:${PORT}`);
  console.log(`   WebSocket   : ws://localhost:${PORT}`);
  console.log(`   Health      : http://localhost:${PORT}/health\n`);

  // Initialize cache (Redis → in-memory fallback)
  await cacheService.initialize();

  // Start cron jobs (production only)
  startAllJobs();
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);

  cacheService.disconnect();

  if (wsManager.wss) {
    wsManager.wss.clients.forEach(ws => ws.terminate());
    wsManager.wss.close();
  }

  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
