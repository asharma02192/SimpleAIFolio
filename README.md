# MyPLWeb — Personal Portfolio & Blog Platform

A clean, technically precise portfolio website with an integrated blog and admin CMS.

## Architecture

```
frontend/     Next.js 16 (App Router, SSR/SSG, Tailwind CSS)
backend/      Express.js + Prisma ORM + PostgreSQL
```

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+

### Backend Setup

```bash
cd backend
cp .env .env.local  # Edit with your DB credentials
npm install
npx prisma migrate dev --name init
npm run db:seed      # Create admin account
npm run dev
```

### Frontend Setup

```bash
cd frontend
cp .env.local .env.local  # Edit API URL if needed
npm install
npm run dev
```

### Access

- **Public site**: http://localhost:3000
- **Admin CMS**: http://localhost:3000/admin
- **API**: http://localhost:3001/api/health

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, skills, recent writing, projects |
| `/about` | Bio, experience, skills taxonomy |
| `/blog` | Blog listing with category/tag filters |
| `/blog/[slug]` | Individual blog post |
| `/projects` | Project showcase |
| `/admin` | Admin login |
| `/admin/posts` | Post management |
| `/admin/posts/new` | Create new post |
| `/admin/posts/[id]/edit` | Edit post |
| `/admin/categories` | Category CRUD |
| `/admin/tags` | Tag CRUD |
| `/admin/projects` | Project CRUD |
| `/admin/media` | Media library with image optimization |
| `/admin/analytics` | Analytics dashboard |

## Deployment (VPS)

```bash
# Backend
cd backend
npm run build
pm2 start dist/server.js --name myplweb-api

# Frontend
cd frontend
npm run build
pm2 start node_modules/.bin/next start --name myplweb-web
```

With Nginx reverse proxy + Let's Encrypt SSL.

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS v4
- **Backend**: Express.js, Prisma ORM, JWT auth
- **Database**: PostgreSQL
- **Image Processing**: Sharp (resize, WebP conversion)
- **Editor**: HTML textarea (Tiptap WYSIWYG ready)
- **Fonts**: Source Serif 4 (display), Manrope (body), JetBrains Mono (monospace)
