# StudyHub — Deployment Guide

## Stack
- **Frontend**: Vercel (React + Vite)
- **Backend**: Railway (Node.js 20 + Express)
- **Database**: Supabase (PostgreSQL, already configured)

---

## Step 1 — Set Up Database

Your Supabase project is already connected. Run the full schema setup:

1. Go to Supabase Dashboard → SQL Editor
2. Paste and run `supabase/STUDYHUB_SETUP.sql` (full one-shot setup)
3. Then run remaining backend migrations **in order** from `backend/migrations/`:
   - `002_payment_system.sql`
   - `003_performance_optimization.sql`
   - `004_analytics_ml.sql`
   - `005_push_notifications.sql`
   - `006_maintenance_functions.sql`
   - `007_analytics_views.sql`
   - `008_platform_settings_inquiries.sql`
   - `009_hall_faqs_seat_changes.sql`
   - `010_maintenance_activity_fixes.sql`
   - `011_hall_settings_overdue_columns.sql`
   - `012_comprehensive_fixes.sql`
   - `013_schema_consistency_fixes.sql`
   - `014_payment_stats_functions.sql`

---

## Step 2 — Seed Super Admin

Run locally (with backend .env set):
```bash
cd backend
node scripts/seed-super-admin.js
```
Default credentials:
- Email: `admin@studyhub.app`
- Password: `StudyHub@Admin123`

**Change password after first login!**

---

## Step 3 — Deploy Backend to Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo, set **Root Directory** to `backend`
4. Set environment variables in Railway dashboard:

```
SUPABASE_URL=https://yzryikhmjbvzhrxlnjwx.supabase.co
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
JWT_SECRET=<generate-new-32+-char-secret>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
PORT=3001
APP_URL=https://your-frontend.vercel.app
APP_NAME=StudyHub
ALLOWED_ORIGINS=https://your-frontend.vercel.app
REDIS_URL=
```

5. Railway will auto-detect `railway.config.json` and start with `node src/server.js`
6. Note your Railway backend URL (e.g., `https://studyhub-backend.up.railway.app`)

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
2. Set **Root Directory** to `frontend`
3. Set environment variables in Vercel:

```
VITE_API_URL=https://studyhub-backend.up.railway.app/api
VITE_WS_URL=wss://studyhub-backend.up.railway.app
```

4. Deploy — Vercel auto-runs `npm run build`
5. The `vercel.json` handles SPA routing automatically

---

## Step 5 — Update Backend ALLOWED_ORIGINS

Once Vercel gives you the production URL, update Railway env:
```
ALLOWED_ORIGINS=https://studyhub.vercel.app
APP_URL=https://studyhub.vercel.app
```

Redeploy backend on Railway (or it auto-restarts on env change).

---

## Step 6 — Verify Deployment

- [ ] `/health` endpoint returns `{ status: 'ok' }`
- [ ] Super Admin login at `/super-admin/login`
- [ ] Create a test tenant via Super Admin
- [ ] Login as hall admin at `/admin/login`
- [ ] Run setup wizard to configure hall
- [ ] Register a test student
- [ ] Verify student portal at `/:slug`

---

## Optional: Email (Resend)

For real transactional emails (receipts, reminders):
1. Sign up at [resend.com](https://resend.com) (free: 3k emails/month)
2. Add to Railway env:
```
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=StudyHub
```

Without this, emails are silently skipped — in-app notifications still work.

---

## Optional: Redis Cache

For better performance with many tenants:
1. Add Redis service in Railway (or use Upstash)
2. Set `REDIS_URL=rediss://user:pass@host:port` in Railway env
3. Falls back to in-memory cache if not set (fine for low traffic)

---

## Roles & URLs

| Role | URL |
|------|-----|
| Platform Owner (Super Admin) | `/super-admin/login` |
| Study Hall Admin | `/admin/login` |
| Student | `/:hall-slug/login` |
| Student Self-Registration | `/:hall-slug/register` |
| Hall Public Website | `/:hall-slug` |
| Marketing Site | `/` |

---

## Production JWT Secret

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Quick Start (Local Dev)

```bash
# Backend
cd backend
npm install
npm run dev   # runs on :3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # runs on :9000, proxies /api → :3001
```
