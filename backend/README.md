# StudyHub Backend API

## Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in your Supabase credentials and JWT secret
```

## Run Database Migrations

In Supabase SQL Editor, run **in order**:

**Core schema (required):**
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_functions_triggers.sql`
3. `supabase/migrations/003_rls_policies.sql`
4. `supabase/migrations/004_indexes.sql`
5. `supabase/migrations/005_seed_super_admin.sql` *(optional — creates refresh_tokens table)*
6. `supabase/migrations/006_storage_policies.sql`

**Feature extensions (recommended):**
7. `backend/migrations/002_payment_system.sql` — UPI/Cash payment columns
8. `backend/migrations/003_performance_optimization.sql` — indexes + materialized views
9. `backend/migrations/004_analytics_ml.sql` — analytics views + ML functions
10. `backend/migrations/005_push_notifications.sql` — push_tokens table
11. `backend/migrations/006_maintenance_functions.sql` — DB maintenance functions
12. `backend/migrations/007_analytics_views.sql` — creates `daily_occupancy_stats`, `monthly_revenue_stats` views required by the analytics service

> **Tip:** `supabase/FULL_SETUP.sql` runs everything in one shot for a fresh database.

## Seed Super Admin

```bash
SUPER_ADMIN_EMAIL=admin@studyhub.app \
SUPER_ADMIN_PASSWORD=YourSecurePassword@1 \
SUPER_ADMIN_NAME="NayakWorks Admin" \
node scripts/seed-super-admin.js
```

## Development

```bash
npm run dev
```

## Production

```bash
npm start
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (never expose!) |
| `JWT_SECRET` | ✅ | Min 32-char secret for JWT signing |
| `JWT_EXPIRES_IN` | ✅ | Access token expiry (default: `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | ✅ | Refresh token expiry (default: `7d`) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `PORT` | ✅ | Server port (default: `3001`) |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `APP_URL` | ✅ | Frontend URL (e.g. `https://app.studyhub.in`) |
| `APP_NAME` | — | Platform name (default: `StudyHub`) |
| `REDIS_URL` | Optional | Redis for caching (falls back to in-memory) |
| `FIREBASE_SERVICE_ACCOUNT` | Optional | Firebase Admin JSON for push notifications |
| `RESEND_API_KEY` | Optional | Resend API key for transactional email (free: 3k/month) |
| `FROM_EMAIL` | Optional | From address for emails (default: `noreply@studyhub.app`) |
| `FROM_NAME` | Optional | From name for emails (default: `APP_NAME`) |

> **Email** — set `RESEND_API_KEY` for real email delivery (welcome, receipts, reminders).
> Without it, emails are logged to console in development (no-op in production — recommended to set).
> Auth emails (password reset, magic links) are still handled by Supabase Auth.

## API Structure

```
/api/auth/*              - Authentication (login, register, refresh, logout)
/api/admin/*             - Hall admin routes (students, seats, plans, fees, ...)
/api/student/*           - Student routes (profile, membership, payments, ...)
/api/mobile/*            - Mobile app API (optimized responses + push tokens)
/api/super-admin/*       - Super admin routes (tenants, billing, analytics)
/api/public/:slug/*      - Public hall website data (no auth)
/health                  - Health check (JSON status)
```

## Key Features

- **Multi-tenant** — each study hall is isolated via tenant_id + Supabase RLS
- **JWT auth** — HS256, short-lived access tokens + 7-day refresh rotation
- **Real-time** — WebSocket server for live seat maps, dashboard, notifications
- **Payments** — UPI (UTR verification) + Cash only, no payment gateway
- **Cron jobs** — 6 scheduled jobs: membership expiry, fee/renewal reminders, overdue management, storage cleanup, DB maintenance
- **File uploads** — Multer + Sharp + magic byte validation → Supabase Storage
- **Analytics** — Occupancy prediction, revenue forecasting, churn analysis

## Deployment (Railway)

1. Connect GitHub repo to Railway
2. Set all environment variables in Railway dashboard
3. Railway auto-deploys on push to main

The `railway.config.json` sets:
- Start command: `node src/server.js`
- Health check: `/health`
