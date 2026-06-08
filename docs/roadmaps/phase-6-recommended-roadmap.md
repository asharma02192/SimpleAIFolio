# Phase 6 Recommended Roadmap

## Purpose

This document captures the remaining non-blocking work after Phases 1 through 5, the release-readiness pass, and AI Blog Studio Phases 1 through 5.

The app is currently stable, release-ready, and functionally complete for the implemented scope. The items below are the next recommended backlog, ordered by production value and risk reduction.

## Current Status

Completed:

- Security hardening
- Admin CRUD reliability fixes
- CMS/public-site correctness fixes
- Admin mobile and UX polish
- Testing and production hardening
- AI Blog Studio foundation
- AI brief, draft, and save-as-draft flow
- Research integration with disabled, mock, and Exa support
- Source approval workflow
- References block support
- Server-stored rewrite proposals
- Internal link suggestions
- Verification flags
- Docker-compatible backend AI and Exa configuration

Not currently blocking release:

- The main site works
- Admin publishing works
- Published posts appear publicly
- Drafts remain excluded from public blog, sitemap, and feed
- AI-generated drafts remain private until manually published

## Priority Summary

### High Priority

1. Shared rate limiting for multi-instance deployments
2. Stronger automated coverage for remaining CRUD/API edge cases
3. Dedicated HTML sanitization library review/replacement
4. Better production monitoring and alerting

### Medium Priority

1. Explicit frontend revalidation hooks after publish/update/delete
2. AI usage, token, and cost observability
3. AI conversation cleanup/archive UX
4. Richer AI fact-check and source verification tooling
5. Better citation/reference formatting controls

### Low Priority

1. Streaming AI responses
2. Section-level internal-link insertion tools
3. Richer rewrite targeting by exact selection/range
4. Historical analytics-driven content pattern suggestions

## Recommended Backlog

## 1. Platform Hardening

### 1.1 Shared Rate Limiting

Problem:

- Current login, setup, analytics, and AI/research rate limiting is in-memory.
- This is fine for a single-instance deployment but weak for horizontally scaled production.

Recommended change:

- Move rate limit state to shared storage such as Redis.
- Keep existing route behavior and thresholds unless production traffic suggests tuning.

Why this matters:

- Prevents brute-force and spam controls from resetting per instance.
- Makes behavior predictable under load balancers and multiple containers.

Suggested areas:

- `backend/src/middleware/rate-limit.ts`
- auth routes
- analytics routes
- admin AI routes

### 1.2 Production Monitoring and Alerting

Problem:

- Logging is improved, but full production monitoring is still limited.

Recommended change:

- Add centralized error tracking and alerting.
- Add dashboards for backend errors, auth failures, AI failures, and upload failures.
- Add health/latency monitoring for AI and research providers.

Why this matters:

- The app is now feature-rich enough that failure visibility matters.
- AI and research integrations need operational visibility.

## 2. Testing Expansion

### 2.1 Backend API Coverage Expansion

Problem:

- Security and auth coverage is strong, but broader CRUD edge cases are still thinner than ideal.

Recommended tests:

- category duplicate/update/delete edge cases
- tag duplicate/update/delete edge cases
- project thumbnail and media edge cases
- experience create/update/delete failures
- publish/unpublish transitions
- slug collision handling under more cases
- AI source approval edge cases with unusual payloads

Suggested areas:

- `backend/src/routes/*.test.ts`

### 2.2 Frontend E2E Expansion

Problem:

- The current Playwright suite covers core smoke flows well, but not every admin failure path.

Recommended tests:

- failed delete leaves item visible for categories/tags/projects/media
- publish/unpublish visibility transitions
- references toggle with mixed approved/rejected sources
- verification flag warning visibility on risky drafts
- AI rewrite proposal reject/apply edge cases
- media invalid file combinations and repeated upload behavior

Suggested areas:

- `frontend/tests/e2e/admin.spec.ts`
- `frontend/tests/e2e/public.spec.ts`

## 3. Content Freshness and Revalidation

### 3.1 Explicit Revalidation Hooks

Problem:

- Publish visibility is fixed, but the long-term model should be more deliberate.
- Some freshness currently depends on route-level rendering/caching choices rather than explicit content invalidation.

Recommended change:

- Add explicit frontend revalidation hooks for:
  - blog listing
  - blog detail
  - homepage recent posts sections
  - sitemap
  - feed

Why this matters:

- Keeps performance and correctness balanced.
- Avoids future stale-content regressions as caching evolves.

## 4. AI Trust and Operations

### 4.1 Dedicated Sanitizer Review

Problem:

- Generated and edited HTML is currently protected by custom sanitization logic.

Recommended change:

- Review replacement with a battle-tested sanitizer library if it fits the stack and deployment constraints.
- If keeping the custom sanitizer, add more hostile-input tests and documented threat assumptions.

Why this matters:

- AI-generated content is a long-term trust boundary.
- Sanitization is one of the most security-sensitive areas in the app.

### 4.2 AI Usage and Cost Observability

Problem:

- AI flows work, but cost and usage reporting are still limited.

Recommended change:

- Track per-conversation provider usage metadata
- record estimated tokens and cost where available
- surface failures/timeouts in admin logs or diagnostics

Why this matters:

- Helps manage provider spend
- helps debug model/provider quality issues
- helps compare AI and research provider value over time

### 4.3 Better Fact-Check Workflow

Problem:

- Verification flags and source approval now exist, but publish-time editorial trust can still be improved.

Recommended change:

- Add a stronger fact-check review flow before final publish
- allow admin review of risky claims in one place
- add “remove/soften unsupported claim” helpers
- link verification flags more tightly to approved sources

Why this matters:

- This is one of the highest-value upgrades for AI trust.

### 4.4 Citation and References Workflow

Problem:

- References work, but the formatting and review controls are intentionally basic.

Recommended change:

- Add cleaner citation style options
- allow optional reference ordering
- allow source-by-source inclusion controls
- add preview-specific warnings for stale/weak sources

## 5. AI Writer UX Improvements

### 5.1 Conversation Management

Problem:

- AI conversation history can get noisy over time.

Recommended change:

- Add archive/delete controls for conversations
- add better status filters
- add sort controls such as newest, draft-ready, saved

Why this matters:

- Improves day-to-day usability for a growing AI writing backlog.

### 5.2 Rewrite Precision

Problem:

- Rewrite proposals are safe now, but still relatively broad.

Recommended change:

- Add section targeting by heading
- add exact selected-text targeting
- add finer proposal diff previews before apply

Why this matters:

- Reduces accidental broad rewrites
- makes the tool feel more editorial and less all-or-nothing

### 5.3 Streaming Responses

Problem:

- AI and research requests currently resolve in full-response mode.

Recommended change:

- Add optional streaming for chat, brief generation, draft generation, and rewrite proposals.

Why this matters:

- Better perceived performance
- better transparency during long-running AI requests

## 6. Content Intelligence Improvements

### 6.1 Historical Content Pattern Suggestions

Problem:

- Engagement insights already use available data, but the guidance can get smarter.

Recommended change:

- detect high-performing title patterns
- compare categories and tags more deeply
- surface “similar post exists” or “content gap” suggestions earlier

### 6.2 Internal Link Insertion Helpers

Problem:

- Internal link suggestions exist, but insertion is manual.

Recommended change:

- allow admin to apply suggested internal links into the draft with review
- keep this approval-based, not automatic

## Suggested Delivery Order

### Phase 6A: Reliability and Safety

1. shared rate limiting
2. backend/API test expansion
3. frontend E2E failure-path expansion
4. sanitizer hardening review

### Phase 6B: Content Freshness and Observability

1. explicit revalidation hooks
2. AI usage/cost observability
3. monitoring and alerting improvements

### Phase 6C: AI Trust and Editorial Controls

1. stronger fact-check workflow
2. richer citation/reference review
3. better verification tooling

### Phase 6D: AI Writer UX

1. conversation archive/delete/filter
2. section-precise rewrites
3. streaming responses
4. internal-link application helpers

## Recommended Go-Forward Decision

If the next goal is production safety at scale:

- Start with Phase 6A

If the next goal is better editorial quality and AI trust:

- Start with Phase 6C

If the next goal is day-to-day admin productivity:

- Start with Phase 6D

## Final Recommendation

The best next step is:

1. shared rate limiting
2. expanded automated coverage
3. explicit revalidation hooks
4. stronger AI fact-check/editorial trust flow

That order reduces operational risk first, then improves content correctness and editorial confidence.
