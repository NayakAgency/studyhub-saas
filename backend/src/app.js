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
    // Allow requests with no origin (curl, mobile apps, same-origin server calls)
    if (!origin) return callback(null, true);
    // Allow if listed in env or in dev mode
    if (allowed.includes(origin) || env.isDev) return callback(null, true);
    // Allow all vercel.app subdomains during deployment
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow Railway preview URLs
    if (origin.endsWith('.railway.app') || origin.endsWith('.up.railway.app')) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
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
  max: env.isProd ? 20 : 100, // 20 in production, relaxed for dev/test
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
  skip: (req) => {
    // Skip rate limiting for the seeded super admin in production (internal health checks)
    return false;
  },
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
// Backend is deployed standalone on Vercel (studyhub-api-delta.vercel.app).
// All frontend calls use absolute URL: https://studyhub-api-delta.vercel.app/api/...
// Vercel rewrite: /(.*) → /api/index.js
// Express receives the FULL path including /api prefix.

// Public (no auth)
app.use('/api/public', publicHallRoutes);

// Auth
app.use('/api/auth', authLimiter, authRoutes);

// ── Admin ──────────────────────────────────────────────────────
app.use('/api/admin/dashboard',         adminDashboardRoutes);
app.use('/api/admin/students',          adminStudentsRoutes);
app.use('/api/admin/seats',             adminSeatsRoutes);
app.use('/api/admin/sections',          adminSectionsRoutes);
app.use('/api/admin/plans',             adminPlansRoutes);
app.use('/api/admin/fees',              adminFeesRoutes);
app.use('/api/admin/payments',          uploadLimiter, adminPaymentsRoutes);
app.use('/api/admin/bookings',          adminBookingsRoutes);
app.use('/api/admin/applications',      adminBookingsRoutes);
app.use('/api/admin/complaints',        adminComplaintsRoutes);
app.use('/api/admin/announcements',     adminAnnouncementsRoutes);
app.use('/api/admin/renewals',          adminRenewalsRoutes);
app.use('/api/admin/settings',          adminSettingsRoutes);
app.use('/api/admin/reports',           adminReportsRoutes);
app.use('/api/admin/resources',         uploadLimiter, adminResourcesRoutes);
app.use('/api/admin/waiting-list',      adminWaitingListRoutes);
app.use('/api/admin/gallery',           uploadLimiter, adminGalleryRoutes);
app.use('/api/admin/contact-inquiries', adminContactRoutes);
app.use('/api/admin/analytics',         adminAnalyticsRoutes);
app.use('/api/admin/suggestions',       adminSuggestionsRoutes);
app.use('/api/admin/faqs',              adminFaqsRoutes);
app.use('/api/admin/seat-changes',      adminSeatChangesRoutes);

// ── Student ────────────────────────────────────────────────────
app.use('/api/student', studentRoutes);

// ── Mobile ─────────────────────────────────────────────────────
app.use('/api/mobile', mobileRoutes);

// ── Super Admin ────────────────────────────────────────────────
app.use('/api/super-admin/tenants',           superAdminTenantsRoutes);
app.use('/api/super-admin/platform-settings', superAdminPlatformSettingsRoutes);
app.use('/api/super-admin/saas-plans',        superAdminSaasPlansRoutes);
app.use('/api/super-admin',                   superAdminAnalyticsRoutes);
app.use('/api/super-admin',                   superAdminBillingRoutes);

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
