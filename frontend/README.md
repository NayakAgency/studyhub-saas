# StudyHub Frontend

## Setup

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL if backend is not on same origin
```

## Development

```bash
npm run dev
```

## Build (Production)

```bash
npm run build
```

## Environment Variables

Create `.env` in frontend root:

```
VITE_API_URL=/api
```

For separate backend deployment:
```
VITE_API_URL=https://your-railway-backend.up.railway.app/api
```

## Deployment (Vercel)

1. Connect GitHub repo to Vercel
2. Set `VITE_API_URL` environment variable
3. Build command: `npm run build`
4. Output directory: `dist`

## Project Structure

```
src/
├── components/
│   ├── admin/       - Admin-specific components
│   ├── auth/        - Auth protection
│   └── ui/          - Reusable UI library
├── lib/
│   ├── api.js       - Axios client with interceptors
│   └── utils.js     - Helper functions
├── pages/
│   ├── admin/       - Hall admin portal
│   ├── hall/        - Public hall website
│   ├── marketing/   - StudyHub homepage
│   ├── student/     - Student portal
│   └── super-admin/ - Super admin portal
├── store/
│   ├── authStore.js - Authentication state
│   └── uiStore.js   - UI state (sidebar, etc.)
└── App.jsx          - Routing
```

## Notes

- All routes are code-split with React.lazy
- Auth state persisted in localStorage via Zustand persist
- React Query for all server state (5min stale time)
- Framer Motion for all page/component transitions
- TailwindCSS with custom design tokens
