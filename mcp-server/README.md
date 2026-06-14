# SimpleAIFolio MCP Server

Connect any AI tool (Claude Code, Claude Desktop, ChatGPT, Cursor, Codex) directly to your SimpleAIFolio CMS to manage blog posts.

## Quick Start

### 1. Install dependencies

```bash
cd mcp-server
npm install && npm run build
```

### 2. Configure environment

Copy `.env.example` and set your backend URL and admin credentials:

```bash
MCP_API_URL=http://localhost:3201
MCP_AUTH_EMAIL=admin@example.com
MCP_AUTH_PASSWORD=your-password
```

### 3. Run tests

```bash
MCP_AUTH_EMAIL=admin@example.com MCP_AUTH_PASSWORD=your-password node dist/index.js --test
```

### 4. Connect from Claude Code

Add to your Claude Code MCP settings:

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

### 5. Connect from Claude Desktop

Add to `claude_desktop_config.json`:

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

## Available Tools (All Phases — 59 tools, 6 resources, 6 prompts)

### Posts (12)
| Tool | Description |
|------|-------------|
| `list_posts` | List/search/filter posts by status, category, tag, or search term |
| `get_post` | Get full post by ID or slug |
| `create_post` | Create new post (title, body, excerpt, tags, SEO, scheduling) |
| `update_post` | Update any post field |
| `delete_post` | Delete a post (requires confirm=true) |
| `publish_post` | Publish a draft immediately |
| `schedule_post` | Schedule a post for future publishing |
| `preview_post` | Generate a preview URL for a draft |
| `import_markdown` | Convert markdown to HTML |
| `get_post_reactions` | Get emoji reaction counts |
| `get_post_comments` | List comments on a post |
| `delete_comment` | Delete a comment (moderation) |

### Categories (4)
| Tool | Description |
|------|-------------|
| `list_categories` | List all categories with post counts |
| `create_category` | Create a new category |
| `update_category` | Update a category |
| `delete_category` | Delete a category (requires confirm=true) |

### Tags (4)
| Tool | Description |
|------|-------------|
| `list_tags` | List all tags with post counts |
| `create_tag` | Create a new tag |
| `update_tag` | Update a tag |
| `delete_tag` | Delete a tag (requires confirm=true) |

### Projects (5)
| Tool | Description |
|------|-------------|
| `list_projects` | List all portfolio projects |
| `get_project` | Get a single project by ID |
| `create_project` | Create a new project |
| `update_project` | Update project fields |
| `delete_project` | Delete a project (requires confirm=true) |

### Media (3)
| Tool | Description |
|------|-------------|
| `list_media` | List all uploaded images |
| `upload_media` | Upload an image (base64) to media library |
| `delete_media` | Delete a media file (requires confirm=true) |

### Settings (3)
| Tool | Description |
|------|-------------|
| `get_settings` | Get all site settings |
| `update_settings` | Update site settings (site name, theme, social links, etc.) |
| `publish_scheduled` | Trigger scheduler to publish due posts |

### Experience (4)
| Tool | Description |
|------|-------------|
| `list_experience` | List all experience/timeline entries |
| `create_experience` | Add a new experience entry |
| `update_experience` | Update an experience entry |
| `delete_experience` | Delete an experience entry (requires confirm=true) |

### AI Writer (10)
| Tool | Description |
|------|-------------|
| `list_ai_conversations` | List AI writing conversations (active/archived/all) |
| `create_ai_conversation` | Start a new AI blog conversation with a topic |
| `get_ai_conversation` | Get full conversation detail (messages, brief, draft, proposals) |
| `send_ai_message` | Chat with the AI about the blog post |
| `generate_brief` | Generate a structured content brief from the topic |
| `approve_brief` | Approve the brief (optionally edit fields first) to enable drafting |
| `generate_draft` | Generate the full blog post HTML draft from the approved brief |
| `request_rewrite` | Request an AI rewrite of a specific section (10 actions available) |
| `apply_rewrite` | Apply a generated rewrite proposal to the draft |
| `save_ai_draft` | Save the AI draft to the CMS as a blog post |

### Analytics (4)
| Tool | Description |
|------|-------------|
| `get_dashboard_stats` | Full analytics: views, top pages, AI usage, costs, alerts (7/30/90 day windows) |
| `get_page_views` | View count for a specific path |
| `get_top_pages` | Top 10 most viewed pages |
| `get_analytics_alerts` | AI ops alert notification settings |

### Newsletter (3)
| Tool | Description |
|------|-------------|
| `list_subscribers` | List all newsletter subscribers |
| `add_subscriber` | Subscribe an email address |
| `remove_subscriber` | Remove a subscriber (requires confirm=true) |

### Contact Messages (3)
| Tool | Description |
|------|-------------|
| `list_messages` | List contact form submissions (optionally unread only) |
| `mark_message_read` | Mark a message as read |
| `delete_message` | Delete a message (requires confirm=true) |

### Script Snippets (4)
| Tool | Description |
|------|-------------|
| `list_snippets` | List all tracking/analytics snippets (GTM, GA4, Facebook Pixel, etc.) |
| `create_snippet` | Create a new script snippet |
| `update_snippet` | Update snippet code, location, or toggle enabled |
| `delete_snippet` | Delete a snippet (requires confirm=true) |

## Resources (6)

Resources provide structured context that AI tools can read without calling tools:

| Resource URI | Description |
|---|---|
| `posts://drafts` | All draft posts (id, title, slug, excerpt) |
| `posts://published` | All published posts (id, title, slug, excerpt, readingTime) |
| `posts://scheduled` | Posts scheduled for future publishing |
| `site://settings` | Current site configuration |
| `site://stats` | Analytics snapshot (views, posts, top pages, AI usage) |
| `newsletter://subscribers/count` | Active and total subscriber counts |

## Prompts (6)

Pre-built prompt templates for common workflows:

| Prompt | Description | Arguments |
|---|---|---|
| `write-blog-post` | Create a complete blog post from a topic | `topic` (required), `audience` |
| `review-draft` | Review a post for quality, SEO, readability | `identifier` (required: ID or slug) |
| `content-audit` | Audit all published posts for gaps and improvements | — |
| `weekly-summary` | Weekly report: posts, views, subscribers, AI cost | — |
| `setup-portfolio` | **Onboarding agent** — interviews the user and populates their entire site (name, bio, skills, experience, projects, categories, theme) | `info` (optional: pre-provided info) |
| `refresh-portfolio` | Update or add to an existing portfolio (new projects, skills, bio updates) | `changes` (what to update) |

## Running Modes

### Stdio (Local — Claude Code, Claude Desktop)

```bash
MCP_AUTH_EMAIL=admin@example.com MCP_AUTH_PASSWORD=your-password node dist/index.js
```

### HTTP (Remote — ChatGPT, Cursor, web tools)

```bash
MCP_AUTH_EMAIL=admin@example.com MCP_AUTH_PASSWORD=your-password \
MCP_REMOTE_API_KEY=your-secret-key \
node dist/index.js --http
```

Endpoints:
- `POST /mcp` — MCP protocol endpoint (requires `Authorization: Bearer <key>` if `MCP_REMOTE_API_KEY` is set)
- `GET /health` — Health check

### Docker

```bash
# Standalone
docker compose -f docker-compose.mcp.yml up -d --build

# Or integrate with the main SimpleAIFolio stack
# The MCP server connects to the backend container via Docker network
```

## Connecting from AI Tools

### Claude Code
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

### Remote HTTP (ChatGPT, Cursor)
```
URL: http://your-server:3100/mcp
Headers: Authorization: Bearer your-secret-key
```

### Cursor / Windsurf
```json
{
  "mcpServers": {
    "SimpleAIFolio": {
      "url": "http://your-server:3100/mcp",
      "headers": { "Authorization": "Bearer your-secret-key" }
    }
  }
}
```

## Example Prompts

- "List all my draft posts"
- "Create a blog post titled 'Getting Started with Docker' with this content..."
- "Publish the post about TypeScript"
- "Search for posts tagged with 'AI' and show me which ones have the most reactions"
- "Schedule the Docker post for next Monday at 9am"
- "Show me my analytics dashboard for the last 7 days"
- "How many newsletter subscribers do I have?"
- "Run a content audit on my published posts"
