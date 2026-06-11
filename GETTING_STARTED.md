# StudyHub — Getting Started Guide

## Prerequisites

- Node.js 20 LTS (`node -v` should show v20.x)
- A [Supabase](https://supabase.com) account (free tier works)

---

## Step 1 — Clone & Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

---

## Step 2 — Supabase Setup

### 2a. Create a Supabase Project
1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Note your **Project URL** and **API Keys** (Settings → API)

### 2b. Run Database Schema
In Supabase Dashboard → **SQL Editor**, paste and run the full contents of:

```
supabase/STUDYHUB_SETUP.sql
```

This is a single, complete, idempotent script — safe to re-run.

Then run these incremental migrations in order (also in SQL Editor):
```
backend/migrations/002_payment_system.sql
backend/migrations/003_performance_optimization.sql
backend/migrations/004_analytics_ml.sql
backend/migrations/005_push_notifications.sql
backend/migrations/006_maintenance_functions.sql
backend/migrations/007_analytics_views.sql
backend/migrations/008_platform_settings_inquiries.sql
backend/migrations/009_hall_faqs_seat_changes.sql
backend/migrations/010_maintenance_activity_fixes.sql
backend/migrations/011_hall_settings_overdue_columns.sql
backend/migrations/012_comprehensive_fixes.sql
backend/migrations/013_schema_consistency_fixes.sql
backend/migrations/014_payment_stats_functions.sql
```

### 2c. Create Storage Buckets
In Supabase Dashboard → **Storage**, create these buckets (all **Public**):

| Bucket Name           | Purpose                         |
|-----------------------|---------------------------------|
| `payment-screenshots` | UPI payment proof uploads       |
| `profile-photos`      | Student profile pictures        |
| `study-resources`     | PDF study materials             |
| `hall-logos`          | Study hall logos                |
| `gallery-images`      | Hall gallery photos             |

### 2d. Authentication Settings
In Supabase Dashboard → **Authentication** → **Settings**:
- Set **JWT expiry** to `3600` seconds (1 hour)
- Enable **Leaked password protection**

---

## Step 3 — Configure Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` with your values:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=generate-a-32-char-random-string-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
NODE_ENV=development
PORT=3001
ALLOWED_ORIGINS=http://localhost:9000
APP_URL=http://localhost:9000
APP_NAME=StudyHub
```

**Generate a JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Step 4 — Seed Super Admin

```bash
cd backend

# Windows CMD:
set SUPER_ADMIN_EMAIL=admin@studyhub.app
set SUPER_ADMIN_PASSWORD=Admin@123456
set SUPER_ADMIN_NAME=NayakWorks Admin
node scripts/seed-super-admin.js

# Mac/Linux:
SUPER_ADMIN_EMAIL=admin@studyhub.app \
SUPER_ADMIN_PASSWORD=Admin@123456 \
SUPER_ADMIN_NAME="NayakWorks Admin" \
node scripts/seed-super-admin.js
```

⚠️ **Change this password immediately after first login!**

---

## Step 5 — Configure Frontend

```bash
cd frontend
cp .env.example .env
```

For development, leave `.env` empty — the Vite dev server proxies `/api` to `localhost:3001`.

---

## Step 6 — Run in Development

Open **two terminals**:

**Terminal 1 — Backend (port 3001):**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend (port 9000):**
```bash
cd frontend
npm run dev
```

---

## Step 7 — First Login

1. Open http://localhost:9000/super-admin/login
2. Login with your seeded super admin credentials
3. Go to **Study Halls** → **Add Hall** to create your first tenant
4. The hall admin logs in at `/admin/login` with the generated temp password
5. Hall admin completes the **Setup Wizard** (sections, seats, plans)
6. Students register at `/:slug/register`

---

## Deployment

### Frontend → Vercel
1. Connect your GitHub repo to [Vercel](https://vercel.com)
2. Set **Root Directory**: `frontend`
3. Set **Build Command**: `npm run build`
4. Set **Output Directory**: `dist`
5. Add env var: `VITE_API_URL=https://your-backend.railway.app/api`
6. Deploy ✅

### Backend → Railway
1. Connect your GitHub repo to [Railway](https://railway.app)
2. Set **Root Directory**: `backend`
3. Set **Start Command**: `node src/server.js`
4. Add all environment variables from `.env`
5. Set `NODE_ENV=production`
6. Update `ALLOWED_ORIGINS` to your Vercel frontend URL
7. Deploy ✅

---

## Project Structure

```
studyhub/
├── backend/
│   ├── src/
│   │   ├── app.js           # Express setup + all routes
│   │   ├── server.js        # Entry point + WebSocket + cron
│   │   ├── config/          # Supabase client, env validation
│   │   ├── middleware/      # Auth, upload, audit, validate, etc.
│   │   ├── routes/
│   │   │   ├── admin/       # 21 hall-admin route files
│   │   │   ├── student/     # Student portal routes
│   │   │   ├── super-admin/ # Platform management routes
│   │   │   └── public/      # Public hall website routes
│   │   ├── services/        # Business logic (auth, payments, analytics, WS, etc.)
│   │   └── jobs/            # 6 cron jobs (production only)
│   ├── migrations/          # 14 incremental SQL migrations
│   └── scripts/             # seed-super-admin.js
│
├── frontend/
│   └── src/
│       ├── components/      # 21 reusable UI components
│       ├── pages/
│       │   ├── admin/       # Full hall admin portal (22 pages)
│       │   ├── student/     # Student portal (14 pages, slug-scoped)
│       │   ├── hall/        # Public hall website (9 pages)
│       │   ├── super-admin/ # Platform management (12 pages)
│       │   └── marketing/   # StudyHub SaaS homepage
│       ├── lib/             # API client, hooks, utils, WebSocket
│       └── store/           # Zustand auth + UI state
│
├── supabase/
│   └── STUDYHUB_SETUP.sql   # Complete DB setup (idempotent)
│
└── shared/                  # Shared constants + types
```

---

## Default URLs

| Portal | URL | Who |
|--------|-----|-----|
| Marketing Home | `/` | Public |
| Hall Public Website | `/:slug` | Public |
| Student Register | `/:slug/register` | New students |
| Student Login | `/:slug/login` | Students |
| Student Dashboard | `/:slug/dashboard` | Logged-in students |
| Admin Login | `/admin/login` | Hall admins |
| Admin Dashboard | `/admin/dashboard` | Hall admins |
| Super Admin Login | `/super-admin/login` | NayakWorks only |
| Super Admin Dashboard | `/super-admin/dashboard` | NayakWorks only |

---

## Email / Notifications

StudyHub uses **in-app notifications** (no email provider needed). All student alerts (fee reminders, membership expiry, payment updates, etc.) appear in the student portal's Notifications page.

Transactional auth emails (password reset, signup confirmation) are handled by **Supabase Auth's built-in email system**. Configure SMTP in:
> Supabase Dashboard → Authentication → Settings → SMTP

---

## Security Notes

- Never commit `.env` — it's in `.gitignore`
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — never expose to frontend
- JWT secret should be 48+ chars of random entropy
- Production builds strip all `console.log` and source maps
- Rate limiting: 200 req/15min global, 10 req/15min on auth
- Brute force lockout after 5 failed login attempts (15 min cooldown)
- File uploads: magic byte validation + Sharp image processing (strips EXIF)
- Multi-tenant isolation: Row Level Security on every table

---

Built by **NayakWorks** | StudyHub SaaS v1.0
