# MyPLWeb - Personal Portfolio & Blog Platform

A portfolio site and blog with an admin CMS.

## Architecture

```text
frontend/  Next.js 16 (App Router, SSR/ISR, Tailwind CSS)
backend/   Express 5 + Prisma 7 + PostgreSQL
```

## Required Environment Variables

Backend:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_URL`
- `ALLOW_INSECURE_JWT_SECRET` (optional local-only override for Docker dev)
- `INSTALL_SECRET` (optional, only if one-time setup should be enabled)

Frontend:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `API_INTERNAL_URL`

Use:
- `backend/.env.example`
- `frontend/.env.example`

## Quick Start

### Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker compose up --build
```

## Access

- Public site: `http://localhost:3200`
- Admin CMS: `http://localhost:3200/admin`
- API: `http://localhost:3201/api/health`

## Testing

Backend API tests:

```bash
cd backend
npm test
```

Frontend Playwright smoke tests:

```bash
cd frontend
npm run test:e2e
```

Optional test env overrides:
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_API_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

## Production Notes

- The backend now validates required env vars at startup and will fail fast if critical values are missing.
- `JWT_SECRET` must not use the placeholder default in production.
- Local Docker compose uses `ALLOW_INSECURE_JWT_SECRET=true` so the bundled dev stack can still boot without a custom secret.
- `INSTALL_SECRET` should only be set when intentionally enabling the one-time setup flow.
- Login, setup, and analytics tracking now have basic rate limiting.
