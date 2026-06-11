# StudyHub — Deployment Guide

## Stack

| Layer    | Platform |
|----------|---------|
| Frontend | Vercel (React + Vite) |
| Backend  | Railway (Node.js 20 + Express) |
| Database | Supabase (PostgreSQL) |
| CI/CD    | GitHub Actions |

---

## Step 1 — Set Up Database (Supabase)

1. Open your Supabase project → **SQL Editor**
2. Paste and run **`supabase/COMPLETE_SETUP.sql`** — creates all 34 tables, RLS policies, indexes, functions, storage buckets
3. Run **`supabase/015_performance_indexes.sql`** — adds composite indexes and materialized views
4. Run **`supabase/016_final_optimizations.sql`** — final index tweaks, unified view refresher

That's it — no need to run individual backend migrations separately.

---

## Step 2 — Seed Super Admin

```bash
cd backend
cp .env.example .env        # fill in your values first
node scripts/seed-super-admin.js
```

Default credentials:
- Email: `admin@studyhub.app`
- Password: `StudyHub@Admin123`

**Change the password immediately after first login.**

---

## Step 3 — Deploy Backend to Railway

1. Push code to GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Select the repo, set **Root Directory** to `backend`
4. Add environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
JWT_SECRET=<min-32-char-random-string>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=production
PORT=3001
APP_URL=https://your-frontend.vercel.app
APP_NAME=StudyHub
ALLOWED_ORIGINS=https://your-frontend.vercel.app
REDIS_URL=
```

5. Railway auto-detects `railway.config.json` and starts `node src/server.js`
6. Note your Railway URL, e.g. `https://studyhub-backend.up.railway.app`

---

## Step 4 — Deploy Frontend to Vercel

### Option A — Vercel Dashboard (manual)

1. Go to [vercel.com](https://vercel.com) → **New Project → Import from GitHub**
2. Set **Root Directory** to `frontend`
3. Add environment variables:

```
VITE_API_URL=https://studyhub-backend.up.railway.app
VITE_WS_URL=wss://studyhub-backend.up.railway.app
```

4. Click **Deploy** — Vercel runs `npm run build` automatically

### Option B — GitHub Actions (automated, recommended)

Add these secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Vercel account token |
| `RAILWAY_TOKEN` | Railway project token |
| `VITE_API_URL` | `https://your-backend.up.railway.app` |
| `VITE_WS_URL` | `wss://your-backend.up.railway.app` |

Every push to `main` will automatically:
- Lint and build the frontend
- Deploy frontend to Vercel
- Deploy backend to Railway

---

## Step 5 — Update CORS After Deploy

Once Vercel assigns a production URL, update Railway env:

```
ALLOWED_ORIGINS=https://your-app.vercel.app
APP_URL=https://your-app.vercel.app
```

Railway restarts automatically on env changes.

---

## Step 6 — Verify

- [ ] `GET /health` → `{ "status": "ok" }`
- [ ] Super Admin login at `/super-admin/login`
- [ ] Create a test tenant via Super Admin → Tenants → Add Hall
- [ ] Login as hall admin at `/admin/login`
- [ ] Complete Setup Wizard (sections, seats, plans)
- [ ] Register a test student at `/:slug/register`
- [ ] Verify student portal at `/:slug/dashboard`

---

## Roles & URLs

| Role | URL |
|------|-----|
| Platform Owner (Super Admin) | `/super-admin/login` |
| Study Hall Admin | `/admin/login` |
| Student | `/:hall-slug/login` |
| Self-registration | `/:hall-slug/register` |
| Hall Public Website | `/:hall-slug` |
| Marketing | `/` |

---

## Local Development

```bash
# Install all
npm run install:all

# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 9000) — separate terminal
cd frontend && npm run dev
```

Vite proxies `/api/*` to `localhost:3001` automatically.

---

## Generate JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Optional: Redis Cache

Improves response times under heavy load. Without it, the backend uses an in-memory cache.

1. Add a Redis service in Railway (or use Upstash free tier)
2. Set `REDIS_URL=rediss://user:pass@host:port` in Railway

---

## Database Migration Run Order

```
supabase/COMPLETE_SETUP.sql         ← Run first (full schema)
supabase/015_performance_indexes.sql ← Run second
supabase/016_final_optimizations.sql ← Run third
```

All scripts are idempotent — safe to re-run.
