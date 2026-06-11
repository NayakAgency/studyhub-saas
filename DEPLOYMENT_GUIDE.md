# StudyHub SaaS - Complete Deployment Guide

## 🚀 Quick Deployment Steps

### Prerequisites
- GitHub account: supabase9949@gmail.com
- Vercel account connected to GitHub
- Railway account for backend hosting
- Supabase project ready

---

## Step 1: Push to GitHub

```bash
# Add all files
git add .
git commit -m "Ready for production deployment"

# Push to GitHub (use supabase9949 account)
git remote set-url origin https://github.com/supabase9949/studyhub-saas.git
git push -u origin main
```

---

## Step 2: Deploy Backend to Railway

1. **Go to Railway**: https://railway.app
2. **Create New Project** → **Deploy from GitHub**
3. **Connect Repository**: `supabase9949/studyhub-saas`
4. **Set Root Directory**: `backend`
5. **Set Environment Variables**:

```env
# Database & Auth
SUPABASE_URL=https://yzryikhmjbvzhrxlnjwx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnlpa2htamJ2emhyeGxuand4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM4Mzk3NTIsImV4cCI6MjA0OTQxNTc1Mn0.--HxI8YGZ4sSLP1n4EmKqfNWso-TuryT0atUEg2BFIY
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnlpa2htamJ2emhyeGxuand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzgzOTc1MiwiZXhwIjoyMDQ5NDE1NzUyfQ.mUsYqsCMQdgpT9BwLUBdgXR40LX4QFWAQRSb6YjiI4U

# JWT Configuration
JWT_SECRET=a8f5f167f44f4964e6c998dee827110c7ea3a4395b3b466f8cd5e4d3c8f4d2f1e8a9b2c3d4e5f6
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# App Configuration
NODE_ENV=production
PORT=3001
APP_NAME=StudyHub
APP_URL=https://studyhub-frontend.vercel.app
ALLOWED_ORIGINS=https://studyhub-frontend.vercel.app

# Optional: Redis Cache (for better performance)
# REDIS_URL=redis://default:password@host:port

# Optional: Email Service (Resend)
# RESEND_API_KEY=re_xxxxxxxxxxxx
# FROM_EMAIL=noreply@yourdomain.com
# FROM_NAME=StudyHub
```

6. **Deploy** - Railway will automatically build and deploy
7. **Note the Railway URL** (e.g., `https://studyhub-backend-production.up.railway.app`)

---

## Step 3: Deploy Frontend to Vercel

1. **Go to Vercel**: https://vercel.com
2. **Import Project** → **Git Repository**
3. **Select**: `supabase9949/studyhub-saas`
4. **Configure Project**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. **Set Environment Variables**:
```env
VITE_API_URL=https://studyhub-backend-production.up.railway.app/api
VITE_WS_URL=wss://studyhub-backend-production.up.railway.app
```

6. **Deploy** - Vercel will build and deploy automatically

---

## Step 4: Update Backend CORS

After Vercel gives you the frontend URL:

1. Go back to **Railway** → **studyhub-backend** → **Variables**
2. Update these variables:
```env
APP_URL=https://your-vercel-app.vercel.app
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app
```

3. **Redeploy backend** (Railway auto-restarts on env changes)

---

## Step 5: Setup Database (Run Once)

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to SQL Editor**
3. **Run the complete setup script**: `supabase/COMPLETE_SETUP.sql`
4. **Run additional migrations** from `backend/migrations/` in order:
   - 002_payment_system.sql
   - 003_performance_optimization.sql
   - 004_analytics_ml.sql
   - 005_push_notifications.sql
   - 006_maintenance_functions.sql
   - 007_analytics_views.sql
   - 008_platform_settings_inquiries.sql
   - 009_hall_faqs_seat_changes.sql
   - 010_maintenance_activity_fixes.sql
   - 011_hall_settings_overdue_columns.sql
   - 012_comprehensive_fixes.sql
   - 013_schema_consistency_fixes.sql
   - 014_payment_stats_functions.sql

---

## Step 6: Seed Super Admin

**Option A: Via Railway Terminal**
1. Go to Railway Dashboard → Your Project → Deployments
2. Click on latest deployment → **View Logs**
3. In Railway terminal, run:
```bash
npm run seed
```

**Option B: Via Local with Production DB**
1. Create `backend/.env.production`:
```env
SUPABASE_URL=https://yzryikhmjbvzhrxlnjwx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6cnlpa2htamJ2emhyeGxuand4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMzgzOTc1MiwiZXhwIjoyMDQ5NDE1NzUyfQ.mUsYqsCMQdgpT9BwLUBdgXR40LX4QFWAQRSb6YjiI4U
```
2. Run locally:
```bash
cd backend
NODE_ENV=production npm run seed
```

**Super Admin Credentials:**
- Email: `admin@studyhub.app`
- Password: `StudyHub@Admin123`

⚠️ **IMPORTANT**: Change password after first login!

---

## Step 7: Verification Checklist

### Backend Health Check
- [ ] Visit: `https://your-railway-url/health`
- [ ] Should return: `{"status": "ok", "timestamp": "..."}`

### Super Admin Access
- [ ] Visit: `https://your-vercel-url/super-admin/login`
- [ ] Login with default credentials
- [ ] Change password immediately
- [ ] Create a test tenant

### Hall Admin Access
- [ ] Visit: `https://your-vercel-url/admin/login`
- [ ] Login with tenant admin credentials
- [ ] Complete setup wizard
- [ ] Configure hall settings

### Student Portal
- [ ] Visit: `https://your-vercel-url/{tenant-slug}`
- [ ] Register as new student
- [ ] Verify email/SMS (if configured)
- [ ] Test seat booking flow

### API Endpoints
- [ ] Test authentication: `POST /api/auth/login`
- [ ] Test protected routes with JWT
- [ ] Verify CORS is working
- [ ] Check WebSocket connection

---

## Step 8: Post-Deployment Configuration

### Domain Setup (Optional)
1. **Custom Domain on Vercel**:
   - Vercel Dashboard → Project → Settings → Domains
   - Add your custom domain
   - Update Railway `ALLOWED_ORIGINS` and `APP_URL`

2. **Subdomain Structure**:
   - Main app: `app.yourdomain.com`
   - API: `api.yourdomain.com` (optional)
   - Admin: `admin.yourdomain.com` (optional)

### Email Configuration (Optional)
1. **Sign up for Resend**: https://resend.com
2. **Add to Railway env**:
```env
RESEND_API_KEY=re_xxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=StudyHub
```

### Performance Optimization
1. **Add Redis** (Railway Redis plugin or Upstash)
2. **Enable Vercel Analytics**
3. **Configure CDN** for static assets
4. **Set up monitoring** (Railway built-in + external)

---

## 🎉 Deployment Complete!

Your StudyHub SaaS platform is now live and ready for clients!

**URLs:**
- **Frontend**: https://your-app.vercel.app
- **Backend API**: https://your-backend.up.railway.app
- **Super Admin**: https://your-app.vercel.app/super-admin
- **Health Check**: https://your-backend.up.railway.app/health

**Next Steps:**
1. Create your first study hall tenant
2. Test the complete user flow
3. Configure email notifications
4. Set up monitoring and backups
5. Create user documentation
6. Launch to your clients! 🚀

---

## Troubleshooting

### Common Issues:

**1. CORS Errors**
- Check `ALLOWED_ORIGINS` in Railway matches Vercel URL
- Ensure no trailing slashes

**2. Database Connection Issues**
- Verify Supabase credentials
- Check if SQL scripts ran successfully
- Test connection in Railway logs

**3. Authentication Issues**
- Verify JWT_SECRET is set correctly
- Check if super admin was seeded
- Ensure Supabase RLS policies are active

**4. Build Failures**
- Check Node.js version (must be 18+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

**5. WebSocket Issues**
- Ensure WSS protocol for production
- Check Railway supports WebSocket (it does)
- Verify CORS allows WebSocket upgrades

Need help? Check the logs in Railway/Vercel dashboards or open an issue on GitHub.