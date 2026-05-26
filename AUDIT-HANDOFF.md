# MyPLWeb — Full Audit Handoff Document

## Project Overview

**MyPLWeb** is a personal portfolio and blog platform with a full admin CMS. It runs entirely in Docker on a VPS.

- **Frontend**: Next.js 16 (App Router) — port 3200
- **Backend**: Express.js 5 + Prisma ORM 7 — port 3201
- **Database**: PostgreSQL 16 — port 5432
- **Domain**: Currently accessible at `http://localhost:3200` and `http://localhost:3201`

---

## Docker Stack

File: `docker-compose.yml` at project root.

```
Services:
  db:       PostgreSQL 16, user=myplweb, db=myplweb, password=myplweb_secret
  backend:  Express on port 3001 (mapped to 3201)
  frontend: Next.js on port 3000 (mapped to 3200)
```

### Key Docker Details

- Frontend uses `output: "standalone"` in `next.config.ts` for Docker deployment
- Frontend Dockerfile has a writable `.next/cache` directory fix (`RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next`)
- SSR inside Docker requires `API_INTERNAL_URL=http://backend:3001` (container-to-container) while `NEXT_PUBLIC_API_URL=http://localhost:3201` (browser-to-host)
- `cache: "no-store"` in serverFetch prevents Next.js from baking stale data at build time
- Database data persists in a named Docker volume `pgdata`

### Running the Stack

```bash
docker compose up -d --build          # Build and start everything
docker compose up -d --build frontend # Rebuild only frontend
docker compose up -d --build backend  # Rebuild only backend
docker compose logs frontend -f       # Stream frontend logs
docker compose logs backend -f        # Stream backend logs
docker exec myplweb-db-1 psql -U myplweb -d myplweb  # Direct DB access
```

### After Schema Changes

```bash
docker exec myplweb-backend-1 npx prisma migrate deploy
```

---

## Architecture

### Backend (Express.js 5)

**Entry**: `backend/src/server.ts`
- Express app with CORS, JSON body parser
- JWT auth middleware via `authenticateToken` from `backend/src/middleware/auth.ts`
- Routes registered with `app.use("/api", routeRouter)`

**Routes** (`backend/src/routes/`):
| Route File | Endpoints | Auth |
|---|---|---|
| `auth.ts` | `POST /api/auth/setup` (one-time admin creation), `POST /api/auth/login` | Public |
| `posts.ts` | `GET /api/posts` (public, published), `GET /api/posts?status=all` (admin), `GET /api/posts/admin/:id` (admin, any status), `GET /api/posts/:slug` (public), `POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id` | Write=auth |
| `categories.ts` | `GET /api/categories`, `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` | Write=auth |
| `tags.ts` | `GET /api/tags`, `POST /api/tags`, `PUT /api/tags/:id`, `DELETE /api/tags/:id` | Write=auth |
| `projects.ts` | `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id` | Write=auth |
| `media.ts` | `POST /api/media/upload` (multipart/formData), `GET /api/media` (list uploaded files) | write=auth |
| `settings.ts` | `GET /api/settings` (public), `PUT /api/settings` (auth), `GET /api/experience` (public), `POST /api/experience` (auth), `PUT /api/experience/:id` (auth), `DELETE /api/experience/:id` (auth) | write=auth |
| `analytics.ts` | `GET /api/analytics/pages` (top pages) | auth |

**Database** (`backend/prisma/schema.prisma`):
- Models: `User`, `Post`, `Category`, `Tag`, `Project`, `Media`, `SiteSetting`, `Experience`
- Post-Tag: Many-to-many via `_PostToTag` join table
- `SiteSetting`: Key-value store for dynamic site content (key is unique string, value stores JSON for complex data)
- `Experience`: Ordered timeline entries for about page
- All models use `@@map()` for lowercase table names matching the DB
- `Post.status` is `String` (not enum) to match TEXT column in DB

**Migrations**:
- `00001_init` — Initial schema (users, posts, categories, tags, projects, media)
- `00002_settings_experience` — Added site_settings and experiences tables with seed data

### Frontend (Next.js 16 App Router)

**Entry**: `frontend/src/app/layout.tsx` — Root layout with fonts

**Public Pages** (`frontend/src/app/`):
| Page | File | Data Source |
|---|---|---|
| Home | `page.tsx` → `PageWrapper` with `HeroSection`, `SkillsSection`, `RecentWriting`, `ProjectsSection` | `fetchSettings()` + `serverFetch("/api/posts?perPage=3")` + `serverFetch("/api/projects")` |
| About | `about/page.tsx` | `fetchSettings()` + `serverFetch("/api/experience")` |
| Blog listing | `blog/page.tsx` | `serverFetch("/api/posts")` with pagination |
| Blog post | `blog/[slug]/page.tsx` | `serverFetch("/api/posts/:slug")` — uses `marked` for markdown→HTML |
| Projects | `projects/page.tsx` | `serverFetch("/api/projects")` |
| Admin login | `admin/page.tsx` | Client-side auth |

**Admin Pages** (`frontend/src/app/admin/`):
| Page | File | Purpose |
|---|---|---|
| Dashboard | `admin/page.tsx` | Login form |
| Posts list | `admin/posts/page.tsx` | List all posts (published + draft) |
| Post editor | `admin/posts/new/page.tsx` & `admin/posts/[id]/page.tsx` | Create/edit posts with `PostEditorContent.tsx` |
| Projects | `admin/projects/page.tsx` | CRUD for projects |
| Categories | `admin/categories/page.tsx` | CRUD with slug auto-generation |
| Tags | `admin/tags/page.tsx` | CRUD with slug auto-generation |
| Media | `admin/media/page.tsx` | File upload, list files, copy URL |
| Experience | `admin/experience/page.tsx` | CRUD for timeline entries |
| Settings | `admin/settings/page.tsx` | Tabbed editor: Home Page, About Page, Site Wide |

**Key Components**:
- `PageWrapper` (`components/PageWrapper.tsx`) — Wraps pages with `AnnouncementBar` + `Navigation` + `<main>` + `Footer`
- `Navigation` (`components/Navigation.tsx`) — Sticky top nav with page links, solid background
- `AnnouncementBar` (`components/AnnouncementBar.tsx`) — Sticky dark bar above nav, animated (slide-in, blinking dots, shimmer), text from settings API
- `Footer` (`components/Footer.tsx`) — Site footer
- `AdminSidebar` (`components/admin/Sidebar.tsx`) — Admin navigation sidebar
- `PostEditorContent` (`components/admin/PostEditorContent.tsx`) — Full post editor with auto-save, category/tag selection, featured image
- `Toast` (`components/admin/Toast.tsx`) — `UIProvider`/`useUI` context for toast notifications and confirm dialogs (replaces browser alert/confirm)

**Design System** (`frontend/src/app/globals.css`):
- Tailwind CSS v4 with `@theme inline` block
- OKLCH color space with warm 75-degree hue
- CSS custom properties for all colors, spacing, typography, radii
- `--color-accent` is the primary brand color
- `--font-display` and `--font-body` font families
- `.tech-chip` class for skill badges
- `.section-label` class for section labels
- `.prose` class for markdown-rendered blog content (headings, code blocks, lists, strong/em)
- `.announcement-scroll`, `.announcement-dot`, `.announcement-shimmer` for announcement bar animations

**Data Fetching** (`frontend/src/lib/config.ts`):
- `serverFetch<T>(path)` — Server-side fetch using `API_INTERNAL_URL` with `cache: "no-store"`
- `fetchSettings()` — Returns merged object: siteConfig, bioHero, bioAbout, heroStats, skillGroups, announcement
- Fallback: if API unreachable, returns hardcoded defaults from `siteConfig` and `defaultSkillGroups`

**Auth** (`frontend/src/lib/auth.tsx`):
- `apiFetch(path, options)` — Client-side fetch with JWT from localStorage
- Detects FormData body and skips Content-Type header (fixes media upload)
- `AuthProvider` context with `useAuth()` hook

---

## Current Seed Data

Run via: `docker exec -i myplweb-db-1 psql -U myplweb -d myplweb < seed-data.sql`

File: `seed-data.sql` at project root.

| Data Type | Count | Details |
|---|---|---|
| Posts (published) | 11 | AI, Web Dev, DevOps, Productivity topics |
| Posts (draft) | 2 | CLI Tool, API Security |
| Categories | 4 | AI & ML, Web Dev, DevOps, Productivity |
| Tags | 20 | React, Next.js, TypeScript, Docker, LLM, etc. |
| Projects | 8 | 4 featured, 4 not featured |
| Experience | 4 | Timeline entries |
| Site Settings | 12 | site_title, tagline, description, author_name, bio_hero, bio_about_1/2/3, social_links, hero_stats, skill_groups, announcement |

---

## What to Audit

### 1. Backend API Validation

Test ALL endpoints for:
- **Correct HTTP status codes** (200, 201, 400, 401, 404)
- **Auth protection** — unauthenticated write requests should return 401
- **Input validation** — missing required fields, empty strings, invalid data
- **Error handling** — graceful errors, no unhandled exceptions
- **Data integrity** — slug uniqueness, cascading deletes, join table consistency

Endpoints to test:
```
POST   /api/auth/login
GET    /api/posts              (with ?status=all, ?page=X, ?perPage=X)
GET    /api/posts/:slug        (published post)
GET    /api/posts/admin/:id    (draft post)
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id
GET    /api/tags
POST   /api/tags
PUT    /api/tags/:id
DELETE /api/tags/:id
GET    /api/projects
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id
GET    /api/settings
PUT    /api/settings
GET    /api/experience
POST   /api/experience
PUT    /api/experience/:id
DELETE /api/experience/:id
POST   /api/media/upload       (multipart/formData)
GET    /api/media
GET    /api/analytics/pages
```

### 2. Frontend Page Rendering (Use Playwright MCP)

Use the `mcp__playwright__*` tools to navigate and verify each page:

**Public Pages:**
- [ ] `http://localhost:3200/` — Home page renders: hero with name/tagline, hero stats, bio card with social links, skills section with 4 groups, recent writing with 3 posts, projects section
- [ ] `http://localhost:3200/about` — About page renders: author name, bio paragraphs, experience timeline (4 entries), skills sidebar, social links card, header navigation, footer
- [ ] `http://localhost:3200/blog` — Blog listing renders: post cards with title, excerpt, date, category badge, tags; pagination works
- [ ] `http://localhost:3200/blog/[slug]` — Blog post renders: title, date, reading time, category, tags, full markdown-rendered body (headings, code blocks, bold text, lists, blockquotes), related posts at bottom
- [ ] `http://localhost:3200/projects` — Projects page renders: project cards with title, description, tech stack chips, featured/not-featured distinction
- [ ] Verify announcement bar: When enabled in settings, a dark sticky bar appears above navigation with animated text and blinking dots
- [ ] Verify navigation: Sticky top bar with solid background, links to Home/About/Blog/Projects, active state highlighting
- [ ] Verify footer: Present on all pages
- [ ] Verify responsive: Test at mobile width (375px) — layout should stack, no horizontal overflow

**Admin Pages (login first):**
- [ ] `http://localhost:3200/admin` — Login form works, redirects to dashboard on success
- [ ] `http://localhost:3200/admin/posts` — Lists all posts (published + draft), "New Post" button visible and styled (40px min-height)
- [ ] `http://localhost:3200/admin/posts/new` — Post editor: title input with border separator, slug auto-generates from title, excerpt textarea, markdown body textarea, category dropdown (min 40px), tag checkboxes, featured image URL input, meta fields, Save Draft + Publish buttons (40px min-height)
- [ ] `http://localhost:3200/admin/posts/[id]` — Existing post loads with all fields populated
- [ ] `http://localhost:3200/admin/projects` — Project CRUD works, buttons properly sized, input fields have focus ring highlight
- [ ] `http://localhost:3200/admin/categories` — Category CRUD works, slug auto-generates from name, description field, focus rings on inputs
- [ ] `http://localhost:3200/admin/tags` — Tag CRUD works, slug auto-generates from name, focus rings on inputs
- [ ] `http://localhost:3200/admin/media` — File upload works, uploaded files listed, click-to-copy URL, error toast on failure
- [ ] `http://localhost:3200/admin/experience` — Experience CRUD works, ordered entries, buttons properly sized
- [ ] `http://localhost:3200/admin/settings` — Three tabs (Home Page, About Page, Site Wide), all fields populate from API, Save All button works, focus rings on all inputs, announcement section with checkbox toggle and live preview, Skills JSON editor

**Playwright Test Flow:**

```
1. Navigate to http://localhost:3200/admin
2. Take snapshot — verify login form visible
3. Login with credentials (get token from DB or use setup endpoint)
4. Navigate to /admin/settings
5. Take snapshot — verify 3 tabs visible
6. Switch to each tab — verify fields render
7. Navigate to /admin/posts
8. Take snapshot — verify post list renders
9. Click "New Post"
10. Fill in title — verify slug auto-populates
11. Fill body with markdown
12. Click Save Draft
13. Verify toast notification appears
14. Navigate to /admin/experience
15. Click "+ New Entry"
16. Fill form — verify all inputs have focus ring
17. Click Create
18. Verify new entry appears in list
19. Navigate to public home page
20. Take snapshot — verify full page renders
21. Scroll down — verify all sections visible
22. Navigate to /blog
23. Take snapshot — verify post list renders
24. Click a post title
25. Verify full blog post renders with markdown formatting
26. Navigate to /about
27. Verify experience timeline renders
28. Navigate to /projects
29. Verify project cards render
```

### 3. Cross-Page Consistency

- [ ] All public pages have consistent header and footer (via PageWrapper)
- [ ] All admin pages have sidebar navigation with correct active states
- [ ] Toast notifications appear within page (not browser alert/confirm popups)
- [ ] All buttons across admin pages have consistent styling (40px min-height, hover effects)
- [ ] All input fields across admin pages have focus ring highlights
- [ ] Navigation links work correctly on all pages
- [ ] No console errors on any page

### 4. Data Flow Validation

- [ ] Create a post in admin → verify it appears on public blog listing
- [ ] Edit settings in admin → verify changes appear on home page
- [ ] Edit about bio in admin → verify changes appear on about page
- [ ] Add experience entry → verify it appears on about page timeline
- [ ] Edit skills in admin → verify they appear on home and about pages
- [ ] Enable announcement bar → verify it appears on all public pages
- [ ] Disable announcement bar → verify it disappears
- [ ] Delete a post → verify it's removed from blog listing
- [ ] Upload media → verify file is accessible
- [ ] Change category → verify post reflects new category

### 5. Edge Cases & Error Handling

- [ ] API unreachable — pages should render with fallback defaults (siteConfig, defaultSkillGroups)
- [ ] Empty state — if no posts/projects exist, pages should show "No posts yet" style messages, not crash
- [ ] Invalid slug — `/blog/nonexistent-post` should handle gracefully
- [ ] Very long text — announcement text, post titles, descriptions should not break layout
- [ ] Special characters in post body (markdown with backticks, pipes, etc.)
- [ ] Duplicate slug creation — should handle gracefully
- [ ] Concurrent edits — no data corruption

### 6. Performance & Build

- [ ] Docker build completes without errors
- [ ] Frontend serves pages without 500 errors
- [ ] Backend responds to all API endpoints
- [ ] No memory leaks visible in `docker stats`
- [ ] Static assets (CSS, JS) load correctly

---

## Known Issues & Recent Fixes

1. **Prisma table name mismatch** — Fixed with `@@map("users")`, `@@map("posts")`, etc.
2. **PostStatus enum vs TEXT** — Changed to `String @default("DRAFT")` to match DB
3. **Join table name** — `_post_tags` renamed to `_PostToTag`
4. **SSR in Docker** — Added `API_INTERNAL_URL=http://backend:3001` env var
5. **Build-time caching** — Using `cache: "no-store"` instead of revalidation
6. **Frontend cache permissions** — Added writable `.next/cache` in Dockerfile
7. **apiFetch FormData** — Detects FormData and skips Content-Type header
8. **Post categoryId null vs empty string** — Coerces `form.categoryId || null`
9. **Settings route mounting** — Changed from `app.use(settingsRoutes)` to `app.use("/api", settingsRoutes)`
10. **Blog markdown rendering** — Added `marked` library to convert markdown to HTML in blog posts
11. **About page missing PageWrapper** — Fixed to include Navigation and Footer
12. **Admin button sizing** — All admin buttons updated to 40px min-height with proper padding and hover effects
13. **Input focus states** — All admin inputs now have focus ring highlight

---

## File Structure Reference

```
D:\MyPLWeb\
├── docker-compose.yml
├── seed-data.sql
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   │       ├── 00001_init/
│   │       └── 00002_settings_experience/
│   └── src/
│       ├── server.ts
│       ├── middleware/
│       │   └── auth.ts
│       └── routes/
│           ├── auth.ts
│           ├── posts.ts
│           ├── categories.ts
│           ├── tags.ts
│           ├── projects.ts
│           ├── media.ts
│           ├── settings.ts
│           └── analytics.ts
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── globals.css
        │   ├── page.tsx
        │   ├── about/page.tsx
        │   ├── blog/
        │   │   ├── page.tsx
        │   │   └── [slug]/page.tsx
        │   ├── projects/page.tsx
        │   └── admin/
        │       ├── page.tsx
        │       ├── posts/
        │       │   ├── page.tsx
        │       │   ├── new/page.tsx
        │       │   └── [id]/page.tsx
        │       ├── projects/page.tsx
        │       ├── categories/page.tsx
        │       ├── tags/page.tsx
        │       ├── media/page.tsx
        │       ├── experience/page.tsx
        │       └── settings/page.tsx
        ├── components/
        │   ├── PageWrapper.tsx
        │   ├── Navigation.tsx
        │   ├── Footer.tsx
        │   ├── AnnouncementBar.tsx
        │   ├── home/
        │   │   ├── HeroSection.tsx
        │   │   ├── SkillsSection.tsx
        │   │   ├── RecentWriting.tsx
        │   │   └── ProjectsSection.tsx
        │   └── admin/
        │       ├── Sidebar.tsx
        │       ├── PostEditorContent.tsx
        │       └── Toast.tsx
        ├── lib/
        │   ├── config.ts
        │   └── auth.tsx
        └── types/
            └── index.ts
```

---

## Admin Credentials

The admin account is created via a one-time `POST /api/auth/setup` endpoint. Current credentials are stored in the database. To retrieve or reset:

```bash
docker exec myplweb-db-1 psql -U myplweb -d myplweb -c "SELECT email FROM users;"
```

To reset (delete and re-create):
```bash
docker exec myplweb-db-1 psql -U myplweb -d myplweb -c "DELETE FROM users;"
curl -X POST http://localhost:3201/api/auth/setup -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"your-password","name":"Admin"}'
```

---

## Environment Variables

### Backend
- `DATABASE_URL` — PostgreSQL connection string (set in docker-compose.yml)
- `JWT_SECRET` — Secret for signing JWT tokens (set in docker-compose.yml)

### Frontend
- `NEXT_PUBLIC_API_URL` — Backend URL for browser-side fetches (`http://localhost:3201`)
- `API_INTERNAL_URL` — Backend URL for server-side fetches inside Docker (`http://backend:3001`)
- `NEXT_PUBLIC_SITE_URL` — Frontend URL (`http://localhost:3200`)
