# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-06-14

### Added

**Website**
- Portfolio homepage with hero, skills, projects, and recent posts sections
- Blog with syntax highlighting (Shiki), table of contents, reading progress bar
- Post reactions (emoji), comments (threaded), social sharing (X, LinkedIn)
- Page view tracking with counts displayed on posts
- Dynamic Open Graph image generation per blog post
- XML sitemap and RSS feed
- Full-text search across posts and projects
- Contact page with form
- Project detail pages
- Newsletter signup in footer
- Three themes: Light Minimal, Dark Modern, Mono Editorial

**Admin CMS**
- Dashboard with analytics, AI usage stats, cost tracking, ops alerts
- Post editor with scheduling, bulk actions, markdown import
- Category and tag management
- Project portfolio management with tech stacks
- Experience timeline editor
- Media library with automatic WebP conversion + thumbnails
- Contact message inbox with read/unread tracking
- Newsletter subscriber management
- Script snippet manager (GA4, GTM, Facebook Pixel injection)
- Site settings: bio, skills, social links, announcement bar, theme selector

**AI Blog Studio**
- Conversation-based blog post generation
- Structured content briefs with SEO keywords
- Full draft generation with SEO/engagement/readability scores
- AI rewrite proposals (10 actions)
- Research source collection with approval workflow
- Internal link suggestions
- Verification flags for factual claims

**MCP Server**
- 59 tools covering full CMS management
- 6 readable resources (drafts, published, scheduled, settings, stats, subscribers)
- 6 prompt templates (blog post writer, draft review, content audit, weekly summary, portfolio onboarding, portfolio refresh)
- Portfolio onboarding agent with interactive interview flow
- Both stdio (local) and HTTP (remote) transports
- Auto-deploys with Docker, API key auto-generated and managed from admin UI

**Infrastructure**
- Docker Compose with 4 services (frontend, backend, database, MCP server)
- Auto-running database migrations on startup
- Clean seed data (admin user + minimal settings only)
- MIT license

### Security
- JWT-based authentication
- Rate limiting on auth, AI, newsletter, and analytics endpoints
- `confirm: true` safety guard on all destructive MCP operations
- API key protection for MCP HTTP endpoint
- Input validation on all API routes
