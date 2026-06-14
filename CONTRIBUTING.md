# Contributing to SimpleAIFolio

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Quick Start for Contributors

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/SimpleAIFolio.git
cd SimpleAIFolio

# Set up upstream
git remote add upstream https://github.com/asharma02192/SimpleAIFolio.git

# Install dependencies for all services
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd mcp-server && npm install && cd ..

# Start the stack
cp .env.example .env
# Edit .env with your local settings
docker compose up -d --build
```

## Development Workflow

### Running Services Individually (Without Docker)

For active development, it's faster to run services directly:

```bash
# Terminal 1 — Backend
cd backend
npm run dev    # Runs on :3001

# Terminal 2 — Frontend
cd frontend
npm run dev    # Runs on :3000

# Terminal 3 — MCP Server (optional)
cd mcp-server
npm run build && node dist/index.js
```

### Database Changes

If you modify `backend/prisma/schema.prisma`:

```bash
cd backend

# Create a migration
npx prisma migrate dev --name your_change_description

# Reset database (dev only — destroys data)
npx prisma migrate reset
```

Never edit existing migration files. Always create new ones.

### Code Style

- **TypeScript** for all services
- **No `any` types** — use proper interfaces
- **Functional React** with hooks (no class components)
- **Tailwind CSS** for styling (no CSS modules)
- Follow existing naming conventions in each file

### Testing

Run tests before submitting a PR:

```bash
# Backend
cd backend && npm test

# Frontend e2e
cd frontend && npm run test:e2e

# MCP Server
cd mcp-server && MCP_API_URL=http://localhost:3201 MCP_AUTH_EMAIL=admin@example.com MCP_AUTH_PASSWORD=your-pass node dist/index.js --test
```

All tests must pass.

## Submitting Changes

1. **Create a branch** from `master`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** — keep commits focused and descriptive

3. **Test everything** — see commands above

4. **Push and create a PR**:
   ```bash
   git push origin feat/your-feature-name
   ```
   Then open a Pull Request on GitHub.

### PR Checklist

- [ ] Branch name follows `feat/`, `fix/`, `docs/`, or `refactor/` prefix
- [ ] All tests pass
- [ ] No new TypeScript errors
- [ ] No secrets or personal data in the diff
- [ ] If adding a new feature, it's covered by tests
- [ ] If adding a new MCP tool, it's registered in `index.ts` and tested

## Project Structure

| Directory | What Lives Here |
|-----------|----------------|
| `frontend/` | Next.js app (pages, components, styles) |
| `backend/` | Express API (routes, services, database) |
| `mcp-server/` | MCP server (tools, resources, prompts) |
| `docs/` | Architecture docs and roadmaps |

## Adding New MCP Tools

1. Create a new file in `mcp-server/src/tools/your-domain.ts`
2. Define tools with proper `inputSchema` (JSON Schema)
3. Implement `handleYourDomainTool()` with all tool logic
4. Import and register in `mcp-server/src/index.ts`
5. Add tests in the test runner section of `index.ts`
6. Update the tool count assertion

## Reporting Bugs

Use [GitHub Issues](https://github.com/asharma02192/SimpleAIFolio/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Docker/logs output (remove any secrets)
- Your `.env` settings (remove passwords and secrets)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
