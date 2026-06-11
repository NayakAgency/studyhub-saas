# StudyHub - Database Setup

## Supabase Configuration

### 1. Create Supabase Project

1. Go to https://supabase.com
2. Create new project
3. Save your project URL and API keys

### 2. Environment Variables

Copy these to your backend `.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Migrations

Execute migrations in order (001 to 026) in the Supabase SQL Editor:

```bash
# Copy contents of each migration file and run in SQL Editor
# Start with 001_initial_schema.sql
# End with 026_indexes.sql
```

### 4. Security Checklist

Before deploying:

- [ ] Enable RLS on ALL tables
- [ ] Verify all RLS policies are applied
- [ ] Set JWT expiry to 3600 seconds (1 hour)
- [ ] Enable "Leaked password protection"
- [ ] Enable "Secure email change"
- [ ] Restrict anon key permissions
- [ ] Disable direct REST API access to tables

### 5. Storage Buckets

Create these buckets in Supabase Storage:

1. `payment-screenshots` - Public bucket
2. `profile-photos` - Public bucket
3. `study-resources` - Public bucket
4. `hall-logos` - Public bucket
5. `gallery-images` - Public bucket

Set RLS policies on each bucket to enforce tenant isolation.

## Database Schema

Total Tables: 26

### Core Tables
- tenants
- hall_admins
- super_admins
- students
- sections
- seats

### Operations
- subscription_plans
- memberships
- payments
- seat_booking_requests
- seat_change_requests
- renewal_requests

### Communication
- announcements
- platform_announcements
- notifications
- complaints
- suggestions
- study_resources
- contact_inquiries

### Management
- waiting_list
- hall_settings
- hall_gallery
- super_admin_billing
- audit_logs
- auth_lockouts
- refresh_tokens

## RLS Policies

All tables implement multi-tenant isolation via RLS policies:

1. Tenant isolation - users can only access data from their tenant
2. Super admin bypass - super admins can access all data
3. Role-based access - students/admins have different permissions

## Sequences

- `student_seq` - Auto-increment student codes
- `receipt_seq` - Auto-increment receipt numbers
- `complaint_seq` - Auto-increment complaint numbers
