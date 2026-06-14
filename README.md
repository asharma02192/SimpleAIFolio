# SimpleAIFolio — Portfolio & Blog Platform with MCP Server

A full-stack personal portfolio and blog platform with a built-in admin CMS, AI blog studio, and an MCP server that lets you manage your entire site from any AI tool (Claude Code, ChatGPT, Cursor).

## Features

**Website**
- Portfolio homepage with hero, skills, projects, and recent posts
- Blog with syntax highlighting, table of contents, reading progress bar, reactions, comments, and social sharing
- Contact page with form
- Project detail pages
- Full-text search across posts and projects
- SEO: dynamic sitemap, Open Graph images, RSS feed
- 3 built-in themes (light, dark, monochrome)

**Admin CMS** (`/admin`)
- Dashboard with analytics, AI usage stats, and ops alerts
- Post editor with scheduling, bulk actions, markdown import
- Categories, tags, projects, experience timeline
- Media library with image optimization (WebP + thumbnails)
- Contact message inbox
- Newsletter subscriber management
- Tracking pixel / script snippet manager
- Site settings (bio, skills, social links, theme, announcement bar)

**AI Blog Studio** (`/admin/ai-writer`)
- Conversation-based blog post generation
- Structured content briefs from a topic
- Full draft generation with SEO scores
- AI rewrite proposals (10 actions)
- Research sources with approval workflow
- Internal link suggestions

**MCP Server** (59 tools, 6 resources, 6 prompts)
- Connect any AI tool to manage your entire site
- Blog post CRUD, scheduling, publishing
- Portfolio onboarding agent (`setup-portfolio` prompt)
- Content audit, weekly summary, draft review prompts
- Auto-deploys with Docker, API key managed from admin settings

## Quick Start

```bash
git clone https://github.com/yourusername/SimpleAIFolio.git
cd SimpleAIFolio
cp .env.example .env
# Edit .env — set DB_PASSWORD, JWT_SECRET, admin credentials
docker compose up -d --build
```

That's it. The site will be available at:
- **Website**: http://localhost:3200
- **Admin CMS**: http://localhost:3200/admin
- **API**: http://localhost:3201/api/health
- **MCP Server**: http://localhost:3100/health

## First-Time Setup

After deploying, you have two options to configure your portfolio:

### Option A: Admin Panel
Go to **Admin > Settings** and fill in your name, bio, skills, social links, and theme.

### Option B: AI Onboarding (Recommended)
Connect an AI tool (Claude Code, ChatGPT, Cursor) to the MCP server and say:

> "Set up my portfolio"

The onboarding agent will interview you and populate the entire site automatically. See the MCP Server section below.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4 |
| Backend | Express 5, Prisma 7, PostgreSQL 16 |
| MCP Server | TypeScript, @modelcontextprotocol/sdk |
| Infrastructure | Docker, Docker Compose |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌───────────────┐
│  Frontend   │────▶│  Backend    │────▶│  PostgreSQL   │
│  Next.js    │     │  Express    │     │               │
│  :3200      │     │  :3201      │     │  :5432        │
└─────────────┘     └──────┬──────┘     └───────────────┘
                           │
                    ┌──────▼──────┐
                    │  MCP Server │
                    │  :3100      │
                    └─────────────┘
```

All three services are defined in `docker-compose.yml` and deploy together.

## MCP Server

The MCP server lets you control your site from any AI tool that supports MCP.

### Connecting

Go to **Admin > Settings > Site Wide > MCP Server** to find your:
- Connection URL
- API key (masked, with copy button)
- Regenerate key button

### Supported AI Tools

**Claude Code / Desktop (stdio)**
```json
{
  "mcpServers": {
    "SimpleAIFolio": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "MCP_API_URL": "http://localhost:3201",
        "MCP_AUTH_EMAIL": "admin@example.com",
        "MCP_AUTH_PASSWORD": "your-password"
      }
    }
  }
}
```

**Cursor / ChatGPT / Windsurf (HTTP)**
```
URL: http://your-server:3100/mcp
Header: Authorization: Bearer your-api-key
```

### Available Operations

| Category | Count | Examples |
|----------|-------|---------|
| Posts | 12 | list, get, create, update, delete, publish, schedule |
| Categories | 4 | list, create, update, delete |
| Tags | 4 | list, create, update, delete |
| Projects | 5 | list, get, create, update, delete |
| Media | 3 | list, upload, delete |
| Settings | 3 | get, update, trigger scheduler |
| Experience | 4 | list, create, update, delete |
| AI Writer | 10 | create conversation, generate brief/draft, rewrite, save |
| Analytics | 4 | dashboard stats, page views, top pages, alerts |
| Newsletter | 3 | list, add, remove subscribers |
| Contact | 3 | list, mark read, delete messages |
| Snippets | 4 | list, create, update, delete tracking scripts |

See [`mcp-server/README.md`](./mcp-server/README.md) for full details.

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_PASSWORD` | Yes | — | PostgreSQL password |
| `JWT_SECRET` | Yes | — | JWT signing secret (use `openssl rand -hex 32`) |
| `REVALIDATE_SECRET` | Yes | — | Frontend cache invalidation secret |
| `SEED_ADMIN_EMAIL` | Yes | — | Admin login email |
| `SEED_ADMIN_PASSWORD` | Yes | — | Admin login password |
| `SEED_ADMIN_NAME` | No | `Admin` | Admin display name |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3201` | Public API URL |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3200` | Public site URL |

AI Writer settings are configured from the admin panel (Settings > AI Configuration), not env vars.

### Custom Domain (Production)

1. Update `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` in your `.env`
2. Point your domain to the server
3. Put a reverse proxy (nginx/Caddy) in front for HTTPS
4. For the MCP server, proxy `mcp.yourdomain.com/mcp` to `localhost:3100`

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# MCP Server
cd mcp-server && npm install && npm run dev
```

### Testing

```bash
# Backend tests
cd backend && npm test

# Frontend e2e tests
cd frontend && npm run test:e2e

# MCP Server tests (requires running backend)
cd mcp-server && MCP_AUTH_EMAIL=admin@example.com MCP_AUTH_PASSWORD=your-pass node dist/index.js --test
```

## Project Structure

```
SimpleAIFolio/
├── frontend/          # Next.js 16 app (SSR/ISR, Tailwind v4)
│   ├── src/app/       # App Router pages
│   ├── src/components/# React components
│   └── src/lib/       # Config, utilities
├── backend/           # Express 5 API
│   ├── src/routes/    # API route handlers
│   ├── src/services/  # AI, research, revalidation services
│   ├── prisma/        # Schema + migrations
│   └── docker-entrypoint.sh
├── mcp-server/        # MCP server for AI tool integration
│   ├── src/tools/     # 59 MCP tools
│   ├── src/resources.ts
│   └── src/prompts.ts
├── docker-compose.yml # All services
├── .env.example       # Configuration template
└── LICENSE
```

## License

[MIT](./LICENSE)
