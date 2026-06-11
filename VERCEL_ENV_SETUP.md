# Vercel Environment Variables — Set These NOW

Both Vercel projects need env vars set in their dashboards.
Vercel does NOT read `.env.production` for server-side/function variables —
they must be set in the Vercel dashboard or via CLI.

---

## 1. Frontend Project — studyhub-app
Dashboard: https://vercel.com/team_EzhQpcOy4ZmY01mbO9UE7SHu/studyhub-app/settings/environment-variables

Add these under **Production** environment:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://studyhub-api-delta.vercel.app/api` |
| `VITE_WS_URL` | *(leave blank)* |

> These are build-time vars — Vite bakes them into the JS bundle at build.
> They are also already in `frontend/.env.production` which was committed,
> so Vercel will pick them up automatically from that file too.

---

## 2. Backend Project — studyhub-api
Dashboard: https://vercel.com/team_EzhQpcOy4ZmY01mbO9UE7SHu/studyhub-api/settings/environment-variables

Add these under **Production** environment:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://yzryikhmjbvzhrxlnjwx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnlpa2htamJ2emhyeGxuand4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMDE5MDUsImV4cCI6MjA5NjU3NzkwNX0.5QknGM6-Kj3r2zs0M5_PveNqv_BgE-O41kCzYpd38cY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnlpa2htamJ2emhyeGxuand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTAwMTkwNSwiZXhwIjoyMDk2NTc3OTA1fQ.-zBZ4C9Pm5qDUV_C-94wwKUzZJVyjhKzO23z-N8AC80` |
| `JWT_SECRET` | `studyhub-super-secret-jwt-key-nayakworks-2024-minimum32chars` |
| `JWT_EXPIRES_IN` | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `NODE_ENV` | `production` |
| `APP_NAME` | `StudyHub` |
| `APP_URL` | `https://studyhub-app.vercel.app` |
| `ALLOWED_ORIGINS` | `https://studyhub-app.vercel.app,https://studyhub-api-delta.vercel.app` |

After adding — click **Redeploy** on the latest deployment in both projects.

---

## Quick CLI method (if Vercel CLI is installed locally)

```bash
# Frontend
cd frontend
vercel env add VITE_API_URL production
# enter: https://studyhub-api-delta.vercel.app/api

# Backend  
cd ../backend
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add JWT_SECRET production
vercel env add NODE_ENV production
vercel env add APP_URL production
vercel env add ALLOWED_ORIGINS production
```

---

## Verify deployment is working

1. https://studyhub-api-delta.vercel.app/health
   → should return `{"status":"ok","environment":"production"}`

2. https://studyhub-app.vercel.app
   → should load the StudyHub marketing page

3. https://studyhub-app.vercel.app/super-admin/login
   → should load the login form

If health check returns 500, the backend env vars are missing — set them in Vercel dashboard and redeploy.
