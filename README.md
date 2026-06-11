# StudyHub SaaS Platform

A comprehensive multi-tenant study hall management system built with React, Node.js, and Supabase.

## Features

### For Study Hall Owners
- **Multi-tenant architecture** - Each hall gets their own isolated space
- **Complete seat management** - Track availability, bookings, and assignments
- **Student management** - Registration, profiles, membership tracking
- **Payment processing** - Cash, UPI, bank transfers with receipt generation
- **Analytics & reports** - Revenue, occupancy, student behavior insights
- **Automated reminders** - Fee reminders, renewal notifications
- **Complaint management** - Track and resolve student issues
- **Custom branding** - Hall-specific themes and branding

### For Students
- **Online registration** - Self-service account creation
- **Seat booking** - Request preferred seats with payment
- **Payment tracking** - View payment history and due amounts
- **Complaint system** - Submit and track issues
- **Announcements** - Stay updated with hall notifications
- **Mobile responsive** - Works perfectly on all devices

### For Platform Administrators
- **Super admin dashboard** - Manage all halls from one place
- **Tenant onboarding** - Easy hall setup and configuration
- **System monitoring** - Performance metrics and health checks
- **Billing management** - Track platform revenue and subscriptions

## Technology Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Database**: Supabase (PostgreSQL with real-time features)
- **Authentication**: Supabase Auth with custom JWT handling
- **File Storage**: Supabase Storage
- **Deployment**: Vercel (Frontend) + Railway (Backend)

## Quick Start

### Prerequisites
- Node.js 18+ 
- Supabase account
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/hd8d9eojehd-dot/studyhub-saas.git
cd studyhub-saas
```

2. **Setup Database**
   - Create a Supabase project
   - Run the SQL scripts in `supabase/COMPLETE_SETUP.sql`
   - Run additional migrations from `backend/migrations/` in order

3. **Configure Backend**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
```

4. **Configure Frontend**
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your API endpoints
```

5. **Start Development**
```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)  
cd frontend
npm run dev
```

### Seed Super Admin
```bash
cd backend
node scripts/seed-super-admin.js
```

Default super admin credentials:
- Email: `admin@studyhub.app`
- Password: `StudyHub@Admin123`

**⚠️ Change the password after first login!**

## Deployment

See `DEPLOY.md` for detailed deployment instructions to:
- **Frontend**: Vercel
- **Backend**: Railway
- **Database**: Supabase (already configured)

## Architecture

### Multi-tenant Design
- Each study hall is a separate tenant with isolated data
- URL structure: `yourdomain.com/hall-slug`
- Shared infrastructure, isolated data

### Database Schema
- 34 tables with comprehensive relationships
- Row Level Security (RLS) for data isolation
- Automated triggers for business logic
- Full audit logging

### API Design
- RESTful APIs with consistent response formats
- JWT-based authentication
- Role-based access control (Super Admin, Hall Admin, Student)
- Comprehensive error handling

## Security Features

- **Row Level Security**: Database-level tenant isolation
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Comprehensive request validation
- **Audit Logging**: Complete action tracking
- **File Upload Security**: Secure file handling
- **Environment Isolation**: Separate configs per environment

## Performance Optimizations

- **Database Indexing**: Optimized queries for large datasets
- **Caching Layer**: Redis caching for frequent data
- **Connection Pooling**: Efficient database connections
- **Code Splitting**: Lazy-loaded frontend components
- **Image Optimization**: Compressed and resized images
- **Bundle Analysis**: Optimized JavaScript bundles

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - Login (all roles)
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - Logout

### Super Admin APIs
- `GET /api/super-admin/dashboard` - Platform statistics
- `POST /api/super-admin/tenants` - Create new hall
- `GET /api/super-admin/tenants` - List all halls

### Hall Admin APIs
- `GET /api/admin/dashboard` - Hall dashboard
- `POST /api/admin/students` - Add student
- `GET /api/admin/students` - List students
- `POST /api/admin/payments` - Record payment

### Student APIs
- `GET /api/student/profile` - Student profile
- `POST /api/student/complaints` - Submit complaint
- `GET /api/student/payments` - Payment history

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email support@studyhub.app or open an issue on GitHub.

## Roadmap

- [ ] Mobile app (React Native)
- [ ] WhatsApp integration for notifications
- [ ] Advanced analytics with ML insights
- [ ] Integration with payment gateways (Razorpay, Stripe)
- [ ] Multi-language support
- [ ] Advanced reporting and exports
- [ ] Student attendance tracking
- [ ] Biometric integration

---

Built with ❤️ by NayakWorks