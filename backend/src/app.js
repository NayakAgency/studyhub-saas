// ============================================================
// Express App Setup — StudyHub API
// ============================================================

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { auditMiddleware } from './middleware/audit.js';

// wsManager and cacheService are lazy-imported only in server.js (not in serverless)
// Provide no-op stubs so health endpoint still works on Vercel
const wsManager = {
  getStats: () => ({ mode: 'serverless', connections: 0, note: 'WebSocket not available in serverless mode' }),
};
const cacheService = {
  getStats: () => ({ connected: false, mode: 'serverless' }),
};

// ── Auth ─────────────────────────────────────────────────────
import authRoutes from './routes/auth.js';

// ── Admin ────────────────────────────────────────────────────
import adminDashboardRoutes    from './routes/admin/dashboard.js';
import adminStudentsRoutes     from './routes/admin/students.js';
import adminSeatsRoutes        from './routes/admin/seats.js';
import adminSectionsRoutes     from './routes/admin/sections.js';
import adminPlansRoutes        from './routes/admin/plans.js';
import adminFeesRoutes         from './routes/admin/fees.js';
import adminPaymentsRoutes     from './routes/admin/payments.js';
import adminBookingsRoutes     from './routes/admin/bookings.js';
import adminComplaintsRoutes   from './routes/admin/complaints.js';
import adminAnnouncementsRoutes from './routes/admin/announcements.js';
import adminRenewalsRoutes     from './routes/admin/renewals.js';
import adminSettingsRoutes     from './routes/admin/settings.js';
import adminReportsRoutes      from './routes/admin/reports.js';
import adminResourcesRoutes    from './routes/admin/resources.js';
import adminWaitingListRoutes  from './routes/admin/waiting-list.js';
import adminGalleryRoutes      from './routes/admin/gallery.js';
import adminContactRoutes      from './routes/admin/contact-inquiries.js';
import adminAnalyticsRoutes    from './routes/admin/analytics.js';
import adminSuggestionsRoutes  from './routes/admin/suggestions.js';
import adminFaqsRoutes         from './routes/admin/faqs.js';
import adminSeatChangesRoutes  from './routes/admin/seat-changes.js';

// ── Student ───────────────────────────────────────────────────
import studentRoutes from './routes/student/index.js';

// ── Mobile ────────────────────────────────────────────────────
import mobileRoutes from './routes/mobile/index.js';

// ── Public ────────────────────────────────────────────────────
import publicHallRoutes from './routes/public/hall.js';

// ── Super Admin ───────────────────────────────────────────────
import superAdminTenantsRoutes       from './routes/super-admin/tenants.js';
import superAdminAnalyticsRoutes     from './routes/super-admin/analytics.js';
import superAdminBillingRoutes       from './routes/super-admin/billing.js';
import superAdminPlatformSettingsRoutes from './routes/super-admin/platform-settings.js';
import superAdminSaasPlansRoutes     from './routes/super-admin/saas-plans.js';

// ─────────────────────────────────────────────────────────────

const app = express();

// ── Security ──────────────────────────────────────────────────
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'"],
      styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc:      ["'self'", 'data:', 'https://*.supabase.co'],
      connectSrc:  ["'self'", 'https://*.supabase.co'],
      fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => {
    const allowed = env.allowedOrigins;
    if (!origin || allowed.includes(origin) || env.isDev) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
}));

// ── Rate Limiting ─────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please slow down.' },
});

// ── Parsing ───────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging ───────────────────────────────────────────────────
app.use(env.isDev ? morgan('dev') : morgan('combined'));

// ── Audit ─────────────────────────────────────────────────────
app.use(auditMiddleware);

// ── Health ────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    version: '1.0.0', 
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    services: {
      websocket: wsManager.getStats(),
      cache: cacheService.getStats(),
    },
  });
});

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────
// Support both /api/... (direct Express server) and /... (Vercel serverless strips /api prefix)
const BASE = ['', '/api'];

BASE.forEach(b => {
// Public (no auth)
app.use(`${b}/public`, publicHallRoutes);

// Auth
app.use(`${b}/auth`, authLimiter, authRoutes);

// ── Admin ──────────────────────────────────────────────────────
app.use(`${b}/admin/dashboard`,         adminDashboardRoutes);
app.use(`${b}/admin/students`,          adminStudentsRoutes);
app.use(`${b}/admin/seats`,             adminSeatsRoutes);
app.use(`${b}/admin/sections`,          adminSectionsRoutes);
app.use(`${b}/admin/plans`,             adminPlansRoutes);
app.use(`${b}/admin/fees`,              adminFeesRoutes);
app.use(`${b}/admin/payments`,          uploadLimiter, adminPaymentsRoutes);
app.use(`${b}/admin/bookings`,          adminBookingsRoutes);
app.use(`${b}/admin/applications`,      adminBookingsRoutes);
app.use(`${b}/admin/complaints`,        adminComplaintsRoutes);
app.use(`${b}/admin/announcements`,     adminAnnouncementsRoutes);
app.use(`${b}/admin/renewals`,          adminRenewalsRoutes);
app.use(`${b}/admin/settings`,          adminSettingsRoutes);
app.use(`${b}/admin/reports`,           adminReportsRoutes);
app.use(`${b}/admin/resources`,         uploadLimiter, adminResourcesRoutes);
app.use(`${b}/admin/waiting-list`,      adminWaitingListRoutes);
app.use(`${b}/admin/gallery`,           uploadLimiter, adminGalleryRoutes);
app.use(`${b}/admin/contact-inquiries`, adminContactRoutes);
app.use(`${b}/admin/analytics`,         adminAnalyticsRoutes);
app.use(`${b}/admin/suggestions`,       adminSuggestionsRoutes);
app.use(`${b}/admin/faqs`,             adminFaqsRoutes);
app.use(`${b}/admin/seat-changes`,     adminSeatChangesRoutes);

// ── Student ────────────────────────────────────────────────────
app.use(`${b}/student`, studentRoutes);

// ── Mobile ─────────────────────────────────────────────────────
app.use(`${b}/mobile`, mobileRoutes);

// ── Super Admin ────────────────────────────────────────────────
app.use(`${b}/super-admin/tenants`,           superAdminTenantsRoutes);
app.use(`${b}/super-admin/platform-settings`, superAdminPlatformSettingsRoutes);
app.use(`${b}/super-admin/saas-plans`,        superAdminSaasPlansRoutes);
app.use(`${b}/super-admin`,                   superAdminAnalyticsRoutes);
app.use(`${b}/super-admin`,                   superAdminBillingRoutes);
}); // end BASE.forEach

// ── 404 ────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Global Error Handler ───────────────────────────────────────
// Never expose stack traces in production
app.use((err, _req, res, _next) => {
  const isDev = env.isDev;
  console.error('[ERROR]', err.message, isDev ? err.stack : '');

  if (err.message?.includes('CORS')) {
    return res.status(403).json({ error: 'CORS policy violation' });
  }

  res.status(err.status || 500).json({
    error: isDev ? err.message : 'An unexpected error occurred',
    ...(isDev && { stack: err.stack }),
  });
});

export default app;
