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
- `AI_PROVIDER`
- `AI_API_KEY` (required for live AI providers)
- `AI_BASE_URL` (required for live OpenAI-compatible providers)
- `AI_MODEL` (required for live OpenAI-compatible providers)
- `AI_TEMPERATURE` (optional)
- `AI_MAX_TOKENS` (optional)
- `AI_RATE_LIMIT_WINDOW_MS` (optional)
- `AI_RATE_LIMIT_MAX` (optional)
- `RATE_LIMIT_STORE` (optional, `memory` to force local in-memory limiting; otherwise the backend uses the database store when available)
- `RESEARCH_PROVIDER` (optional, supported: `disabled`, `exa`, `mock`)
- `RESEARCH_API_KEY` (optional)

Frontend:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SITE_URL`
- `API_INTERNAL_URL`

Use:
- `backend/.env.example`
- `frontend/.env.example`

Docker Compose notes:
- The backend container loads AI and research settings from `backend/.env`.
- Compose-level URL overrides such as `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_SITE_URL` still come from the repo root shell environment or a repo-root `.env` file if you need to override the local Docker defaults.
- Valid research provider values are `disabled`, `mock`, and `exa`.

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

Optional live research verification:

```bash
cd backend
npm run verify:research
```

The live research verification only runs when `RESEARCH_PROVIDER=exa` and `RESEARCH_API_KEY` are both present. Otherwise it exits cleanly without making a live provider call.
The verifier now loads `backend/.env` automatically when you run it from the backend folder.

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
- AI Blog Studio is admin-only and runs from backend routes under `/api/admin/ai`.
- Do not expose AI secrets in frontend env vars. Use backend-only `AI_*` configuration.
- For local Docker development, the bundled stack uses `AI_PROVIDER=mock` so the AI writer can be exercised without a live external model.
- Research is also backend-only. Keep `RESEARCH_PROVIDER=disabled` unless a server-side provider such as `exa` is configured with `RESEARCH_API_KEY`.
- AI Blog Studio source approval is admin-only. Only approved sources can be included in the optional References block when saving an AI draft into the CMS.
- Rewrite proposals are stored and applied server-side by proposal ID; the browser does not directly overwrite stored draft content.
