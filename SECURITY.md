# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public GitHub issue**
2. Use **[GitHub Private Security Advisories](https://github.com/asharma02192/SimpleAIFolio/security/advisories/new)** to report privately
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

You will receive a response within 48 hours. We will credit you in the fix announcement (unless you prefer to remain anonymous).

## Security Best Practices for Deployments

When deploying SimpleAIFolio, follow these guidelines:

### Required

- **Change all default passwords** — `DB_PASSWORD`, `SEED_ADMIN_PASSWORD`
- **Generate unique secrets** — Use `openssl rand -hex 32` for `JWT_SECRET` and `REVALIDATE_SECRET`
- **Use HTTPS** — Put a reverse proxy (nginx/Caddy) with TLS in front of all services
- **Set the MCP API key** — Auto-generated on first boot; verify it in Admin > Settings > MCP Server
- **Keep the admin panel protected** — Don't expose port 3200 without auth

### Recommended

- **Firewall unused ports** — Only expose 80/443 (via reverse proxy). Keep 3200, 3201, 3100, 5432 internal
- **Regular updates** — `git pull && docker compose up -d --build` to get security patches
- **Database backups** — Schedule regular `pg_dump` backups
- **Rate limiting** — The app includes built-in rate limiting for auth, AI, and newsletter endpoints. Keep it enabled
- **Monitor AI costs** — Check Admin > Dashboard > AI Ops for cost spikes and failure rates

### MCP Server Security

The MCP server has two access modes:

| Mode | Security | Use Case |
|------|----------|----------|
| **stdio** (local) | No network exposure — runs on your machine | Claude Code, Claude Desktop |
| **HTTP** (remote) | API key required — `Authorization: Bearer <key>` | Cursor, ChatGPT, remote access |

If using HTTP mode on a VPS:
- Always set `MCP_REMOTE_API_KEY` (or use the auto-generated key from the admin panel)
- Proxy through HTTPS (never expose the MCP server over plain HTTP)
- Regenerate the key if you suspect it's compromised (Admin > Settings > MCP Server > Regenerate Key)

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest `master` | Yes |
| Older versions | No — update to latest |

## Disclosure Timeline

- **Day 0**: Vulnerability reported
- **Day 1**: Acknowledgment sent
- **Day 7-30**: Fix developed and tested
- **Release**: Fix published, reporter credited
