# StudyHub SaaS Platform v1.0

**Full-Stack Multi-Tenant Study Hall Management Platform**

Built for NayakWorks | Production-Grade Enterprise Application

## Tech Stack

### Frontend
- React 18 + Vite
- TailwindCSS
- React Query (TanStack)
- React Router v6
- Zustand
- Framer Motion
- React Hook Form + Zod
- Recharts

### Backend
- Node.js 20 LTS
- Express 5
- Supabase (PostgreSQL)
- JWT Authentication
- Node-cron

### Database
- Supabase PostgreSQL
- Row Level Security (RLS)
- Multi-tenant architecture

## Project Structure

```
studyhub/
├── frontend/          # React 18 + Vite
├── backend/           # Node.js + Express
├── supabase/          # Migrations & RLS policies
└── shared/            # Shared types & utilities
```

## Getting Started

### Prerequisites
- Node.js 20 LTS
- Supabase account
- Resend API key (for emails)

### Installation

See individual README files in:
- `/frontend/README.md`
- `/backend/README.md`
- `/supabase/README.md`

## Multi-Tenant Architecture

Every tenant (study hall) is completely isolated via:
- `tenant_id` column on every table
- Row Level Security (RLS) enforced at database level
- JWT-based tenant context
- Separate storage buckets per tenant

## Roles

1. **Super Admin** - Platform owner (NayakWorks)
2. **Hall Admin** - Study hall owner
3. **Student** - Self-registered users

## Security Features

- JWT authentication with refresh tokens
- Rate limiting on all endpoints
- Helmet security headers
- Input validation with Zod
- File magic byte validation
- Audit logging
- Brute force protection
- Anti-reverse engineering build

## Deployment

- Frontend: Vercel
- Backend: Railway
- Database: Supabase Cloud

## License

Proprietary - NayakWorks © 2024
