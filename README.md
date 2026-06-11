# StudyHub SaaS — Study Hall Management Platform

**Multi-tenant SaaS platform for study hall owners.**  
Built with React 18 + Vite (frontend), Node.js 20 + Express (backend), PostgreSQL via Supabase (database).

---

## 🌐 Live Production URLs

### Portals

| Portal | URL |
|--------|-----|
| 🏠 **Marketing / Home** | https://studyhub-app.vercel.app |
| 🔑 **Unified Login** | https://studyhub-app.vercel.app/login |
| 👑 **Super Admin Login** | https://studyhub-app.vercel.app/super-admin/login |
| 🏛️ **Hall Admin Login** | https://studyhub-app.vercel.app/admin/login |
| 🎓 **Student Login** | https://studyhub-app.vercel.app/{hall-slug}/login |
| 📝 **Student Register** | https://studyhub-app.vercel.app/{hall-slug}/register |
| 📋 **Hall Public Website** | https://studyhub-app.vercel.app/{hall-slug} |

### API & Infrastructure

| Service | URL |
|---------|-----|
| ⚡ **Backend API** | https://studyhub-api-delta.vercel.app |
| 🩺 **Health Check** | https://studyhub-api-delta.vercel.app/health |
| 🗄️ **Supabase Dashboard** | https://supabase.com/dashboard/project/yzryikhmjbvzhrxlnjwx |
| 🗄️ **Supabase SQL Editor** | https://supabase.com/dashboard/project/yzryikhmjbvzhrxlnjwx/sql/new |

### Vercel Projects

| Project | Dashboard |
|---------|-----------|
| Frontend (`studyhub-app`) | https://vercel.com/team_EzhQpcOy4ZmY01mbO9UE7SHu/studyhub-app |
| Backend (`studyhub-api`) | https://vercel.com/team_EzhQpcOy4ZmY01mbO9UE7SHu/studyhub-api |

---

## 🔐 Default Super Admin Credentials

```
URL:      https://studyhub-app.vercel.app/super-admin/login
Email:    admin@studyhub.app
Password: StudyHub@Admin123
```

> **Change the password immediately after first login.**

---

## 🗄️ Database Setup (Run Once in Supabase)

1. Open → https://supabase.com/dashboard/project/yzryikhmjbvzhrxlnjwx/sql/new
2. Paste the **entire contents** of `supabase/STUDYHUB_COMPLETE_FINAL.sql`
3. Click **Run** — takes ~5 seconds
4. Verify the final row shows: `StudyHub v2.0 FINAL — setup complete!`

That single file contains everything:
- 34 tables with constraints
- All triggers & functions
- 80+ performance indexes
- 5 materialized views
- Full RLS policies (60+)
- Storage buckets
- Platform settings defaults

---

## 🚀 GitHub Secrets Required (for CI/CD)

Go to **GitHub → Repository → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `VERCEL_TOKEN` | Your Vercel account token |
| `VERCEL_ORG_ID` | `team_EzhQpcOy4ZmY01mbO9UE7SHu` |
| `VERCEL_PROJECT_ID_FRONTEND` | `prj_8EUYLQVn9whPJtCd8u3upVHg4rum` |
| `VERCEL_PROJECT_ID_BACKEND` | `prj_7XZ1Fq2ot3FmWLRivg26XAqOnEc8` |
| `VITE_API_URL` | `https://studyhub-api-delta.vercel.app/api` |
| `VITE_WS_URL` | *(leave blank for Vercel serverless)* |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   studyhub-app.vercel.app                │
│              React 18 + Vite + Tailwind CSS              │
│     (SPA — all routes served via index.html rewrite)     │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS /api/*
┌────────────────────────▼────────────────────────────────┐
│             studyhub-api-delta.vercel.app                │
│           Node.js 20 + Express (serverless fn)           │
│      JWT auth · Rate limiting · CORS · Helmet            │
└────────────────────────┬────────────────────────────────┘
                         │ Supabase JS SDK
┌────────────────────────▼────────────────────────────────┐
│        yzryikhmjbvzhrxlnjwx.supabase.co                 │
│    PostgreSQL · RLS · Storage · Auth · Realtime          │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
/
├── frontend/               React + Vite app
│   ├── src/
│   │   ├── pages/          Route-level page components
│   │   │   ├── admin/      Hall admin portal
│   │   │   ├── student/    Student portal
│   │   │   ├── super-admin/ Platform owner portal
│   │   │   ├── hall/       Public hall website
│   │   │   └── marketing/  Landing page
│   │   ├── components/     Shared UI components
│   │   ├── store/          Zustand state stores
│   │   └── lib/            API client, utilities
│   ├── vercel.json         SPA rewrite + cache headers
│   └── vite.config.js      Build config + code splitting
│
├── backend/                Express API server
│   ├── src/
│   │   ├── routes/         API route handlers
│   │   │   ├── admin/      Hall admin endpoints
│   │   │   ├── student/    Student endpoints
│   │   │   ├── super-admin/ Platform endpoints
│   │   │   ├── mobile/     Mobile app endpoints
│   │   │   └── public/     No-auth public endpoints
│   │   ├── middleware/     Auth, audit, upload, CORS
│   │   ├── jobs/           Cron jobs (reminders, cleanup)
│   │   └── config/         Supabase + env config
│   ├── api/index.js        Vercel serverless entry point
│   └── vercel.json         60s function timeout config
│
├── supabase/
│   └── STUDYHUB_COMPLETE_FINAL.sql   ← USE THIS (single file, run once)
│
└── .github/workflows/ci-cd.yml       Auto-deploy on push to main
```

---

## 🧑‍💻 Local Development

```bash
# 1. Install all dependencies
npm run install:all

# 2. Copy and fill env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start backend (port 3001)
npm run dev:backend

# 4. Start frontend (port 9000) — separate terminal
npm run dev:frontend
```

Vite automatically proxies `/api/*` → `localhost:3001`.

---

## 👥 User Roles & Access

| Role | Login URL | Default Credentials |
|------|-----------|---------------------|
| **Super Admin** | `/super-admin/login` | admin@studyhub.app / StudyHub@Admin123 |
| **Hall Admin** | `/admin/login` | Created via Super Admin |
| **Student** | `/{slug}/login` | Self-registered or created by admin |

### Student Portal Pages (`/{slug}/...`)

| Page | Path |
|------|------|
| Dashboard | `/{slug}/dashboard` |
| Profile | `/{slug}/profile` |
| My Seat | `/{slug}/seat` |
| Membership | `/{slug}/membership` |
| Fees | `/{slug}/fees` |
| Book Seat | `/{slug}/book-seat` |
| Complaints | `/{slug}/complaints` |
| Suggestions | `/{slug}/suggestions` |
| Notifications | `/{slug}/notifications` |
| ID Card | `/{slug}/id-card` |
| Resources | `/{slug}/resources` |

### Hall Public Website (`/{slug}/...`)

| Page | Path |
|------|------|
| Home | `/{slug}` |
| About | `/{slug}/about` |
| Facilities | `/{slug}/facilities` |
| Plans | `/{slug}/plans` |
| Seats | `/{slug}/seats` |
| Gallery | `/{slug}/gallery` |
| Contact | `/{slug}/contact` |
| FAQs | `/{slug}/faqs` |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, TanStack Query |
| Backend | Node.js 20, Express 5, JWT, Multer, Helmet |
| Database | PostgreSQL (Supabase), Row Level Security |
| Storage | Supabase Storage |
| Auth | Supabase Auth + Custom JWT |
| Deployment | Vercel (both frontend + backend) |
| CI/CD | GitHub Actions |

---

## ✅ Post-Deploy Checklist

- [ ] Run `STUDYHUB_COMPLETE_FINAL.sql` in Supabase SQL Editor
- [ ] Verify `/health` endpoint returns `{"status":"ok"}`
- [ ] Login to Super Admin and change password
- [ ] Create first study hall tenant
- [ ] Test student registration at `/{slug}/register`
- [ ] Confirm frontend at `https://studyhub-app.vercel.app` loads
- [ ] Add GitHub secrets for automated deploys
- [ ] (Optional) Add Redis URL in Railway for caching
- [ ] (Optional) Configure Supabase SMTP for email notifications

---

**Built with ❤️ by NayakWorks**
