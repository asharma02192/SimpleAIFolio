import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import type { Post, PostListResponse, Reaction, Comment } from "../types.js";
import { ok as text, fail as error } from "./helpers.js";

export type { ToolResult } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

export const postTools: Tool[] = [
  {
    name: "list_posts",
    description: "List blog posts with optional filters. Returns paginated results with title, slug, excerpt, status, category, tags, dates.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number", description: "Page number (default 1)", default: 1 },
        perPage: { type: "number", description: "Items per page (default 10, max 50)", default: 10 },
        status: { type: "string", enum: ["PUBLISHED", "DRAFT", "SCHEDULED", "all"], description: "Filter by status. Use 'all' to include drafts (requires admin auth).", default: "PUBLISHED" },
        category: { type: "string", description: "Filter by category slug" },
        tag: { type: "string", description: "Filter by tag slug" },
        search: { type: "string", description: "Search title, excerpt, and body" },
      },
    },
  },
  {
    name: "get_post",
    description: "Get full post detail by ID or slug, including body HTML, tags, category, SEO meta, and author.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
        slug: { type: "string", description: "Post slug" },
      },
    },
  },
  {
    name: "create_post",
    description: "Create a new blog post. Pass body as HTML. Title and slug are required. Set status to PUBLISHED to publish immediately, DRAFT (default), or SCHEDULED with scheduledAt.",
    inputSchema: {
      type: "object",
      required: ["title", "slug"],
      properties: {
        title: { type: "string", description: "Post title" },
        slug: { type: "string", description: "URL-safe slug (e.g. 'my-first-post')" },
        body: { type: "string", description: "Post body as HTML" },
        excerpt: { type: "string", description: "Short summary for listings and SEO" },
        categoryId: { type: "string", description: "UUID of the category" },
        tagIds: { type: "array", items: { type: "string" }, description: "Array of tag UUIDs" },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED", "SCHEDULED"], default: "DRAFT" },
        featuredImage: { type: "string", description: "URL or path to featured image" },
        metaTitle: { type: "string", description: "Custom SEO title" },
        metaDescription: { type: "string", description: "Custom SEO meta description" },
        ogImage: { type: "string", description: "Custom Open Graph image URL" },
        scheduledAt: { type: "string", description: "ISO 8601 datetime for scheduled publish (e.g. '2026-06-20T09:00:00Z')" },
      },
    },
  },
  {
    name: "update_post",
    description: "Update any field of an existing post. Only provided fields will be changed. Can change title, body, excerpt, tags, category, status, SEO meta, featured image, and scheduling.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
        title: { type: "string" },
        slug: { type: "string" },
        body: { type: "string", description: "Post body as HTML" },
        excerpt: { type: "string" },
        categoryId: { type: "string" },
        tagIds: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["DRAFT", "PUBLISHED", "SCHEDULED"] },
        featuredImage: { type: "string" },
        metaTitle: { type: "string" },
        metaDescription: { type: "string" },
        ogImage: { type: "string" },
        scheduledAt: { type: "string", description: "ISO 8601 datetime, or null to clear" },
      },
    },
  },
  {
    name: "delete_post",
    description: "Delete a blog post by ID. This is permanent and cannot be undone.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
  {
    name: "publish_post",
    description: "Publish a post immediately by setting its status to PUBLISHED. Works on drafts and scheduled posts.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
      },
    },
  },
  {
    name: "schedule_post",
    description: "Schedule a post for automatic publishing at a future datetime. Sets status to SCHEDULED and stores the scheduledAt time. Use the scheduler endpoint to publish when due.",
    inputSchema: {
      type: "object",
      required: ["id", "scheduledAt"],
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
        scheduledAt: { type: "string", description: "ISO 8601 datetime (e.g. '2026-06-20T09:00:00Z')" },
      },
    },
  },
  {
    name: "preview_post",
    description: "Generate a preview token for a draft or scheduled post. Returns a URL that can be shared to preview the post before publishing.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Post ID (UUID)" },
      },
    },
  },
  {
    name: "import_markdown",
    description: "Convert markdown text to HTML. Useful for creating posts from markdown content. Returns the parsed HTML and extracted title.",
    inputSchema: {
      type: "object",
      required: ["markdown"],
      properties: {
        markdown: { type: "string", description: "Markdown text to convert to HTML" },
      },
    },
  },
  {
    name: "get_post_reactions",
    description: "Get emoji reaction counts for a post. Returns array of { emoji, count, reacted }.",
    inputSchema: {
      type: "object",
      required: ["postId"],
      properties: {
        postId: { type: "string", description: "Post ID (UUID)" },
      },
    },
  },
  {
    name: "get_post_comments",
    description: "List all comments on a post, ordered chronologically. Includes threaded replies (parentId).",
    inputSchema: {
      type: "object",
      required: ["postId"],
      properties: {
        postId: { type: "string", description: "Post ID (UUID)" },
      },
    },
  },
  {
    name: "delete_comment",
    description: "Delete a comment by ID. Used for moderation.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Comment ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
  {
    name: "list_all_comments",
    description: "List all comments across all posts with optional status filter. Includes post title for context. Use for comment moderation.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["approved", "pending", "spam", "all"], default: "all", description: "Filter by comment status" },
        page: { type: "number", default: 1 },
        perPage: { type: "number", default: 20 },
      },
    },
  },
  {
    name: "update_comment_status",
    description: "Change a comment's moderation status. Use 'approved' to publish, 'pending' to hide, 'spam' to flag.",
    inputSchema: {
      type: "object",
      required: ["id", "status"],
      properties: {
        id: { type: "string", description: "Comment ID (UUID)" },
        status: { type: "string", enum: ["approved", "pending", "spam"], description: "New status for the comment" },
      },
    },
  },
  {
    name: "update_profile",
    description: "Update the admin profile (display name and/or email address). If email changes, the login credentials update immediately.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "New display name" },
        email: { type: "string", description: "New email address (must be unique)" },
      },
    },
  },
];

export async function handlePostTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_posts": {
      const params = new URLSearchParams();
      if (args.page) params.set("page", String(args.page));
      if (args.perPage) params.set("perPage", String(args.perPage));
      if (args.status) params.set("status", String(args.status));
      if (args.category) params.set("category", String(args.category));
      if (args.tag) params.set("tag", String(args.tag));
      if (args.search) params.set("search", String(args.search));

      const { status, data } = await apiRequest<PostListResponse>("GET", `/api/posts?${params}`);
      if (status !== 200) return error(data);

      const posts = data.data.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        status: p.status,
        publishedAt: p.publishedAt,
        category: p.category?.name || null,
        tags: p.tags?.map((t) => t.name) || [],
        readingTime: p.readingTime,
      }));

      return text({ posts, total: data.total, page: data.page, perPage: data.perPage, totalPages: data.totalPages });
    }

    case "get_post": {
      let status: number;
      let data: unknown;

      if (args.slug) {
        ({ status, data } = await apiRequest<Post>("GET", `/api/posts/${args.slug}`, undefined, false));
      } else if (args.id) {
        ({ status, data } = await apiRequest<Post>("GET", `/api/posts/admin/${args.id}`));
      } else {
        return error("Either 'id' or 'slug' is required");
      }

      if (status !== 200) return error(data);
      return text(data);
    }

    case "create_post": {
      const body: Record<string, unknown> = {};
      if (args.title) body.title = args.title;
      if (args.slug) body.slug = args.slug;
      if (args.body) body.body = args.body;
      if (args.excerpt !== undefined) body.excerpt = args.excerpt;
      if (args.categoryId !== undefined) body.categoryId = args.categoryId;
      if (args.tagIds !== undefined) body.tagIds = args.tagIds;
      if (args.status) body.status = args.status;
      if (args.featuredImage !== undefined) body.featuredImage = args.featuredImage;
      if (args.metaTitle !== undefined) body.metaTitle = args.metaTitle;
      if (args.metaDescription !== undefined) body.metaDescription = args.metaDescription;
      if (args.ogImage !== undefined) body.ogImage = args.ogImage;
      if (args.scheduledAt) body.scheduledAt = args.scheduledAt;

      const { status, data } = await apiRequest<Post>("POST", "/api/posts", body);
      if (status !== 201) return error(data);
      return text({ success: true, post: { id: data.id, slug: data.slug, title: data.title, status: data.status } });
    }

    case "update_post": {
      const { id, ...updates } = args;
      if (!id) return error("Post 'id' is required");
      const body: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) body[k] = v;
      }

      const { status, data } = await apiRequest<Post>("PUT", `/api/posts/${id}`, body);
      if (status !== 200) return error(data);
      return text({ success: true, post: { id: data.id, slug: data.slug, title: data.title, status: data.status } });
    }

    case "delete_post": {
      if (!args.confirm) return error("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/posts/${args.id}`);
      if (status !== 204) return error(data);
      return text({ success: true, deleted: true, id: args.id });
    }

    case "publish_post": {
      const { status, data } = await apiRequest<Post>("PUT", `/api/posts/${args.id}`, { status: "PUBLISHED" });
      if (status !== 200) return error(data);
      return text({ success: true, published: true, post: { id: data.id, slug: data.slug, title: data.title } });
    }

    case "schedule_post": {
      const { status, data } = await apiRequest<Post>("PUT", `/api/posts/${args.id}`, { status: "SCHEDULED", scheduledAt: args.scheduledAt });
      if (status !== 200) return error(data);
      return text({ success: true, scheduled: true, post: { id: data.id, slug: data.slug, title: data.title, scheduledAt: data.scheduledAt } });
    }

    case "preview_post": {
      const { status, data } = await apiRequest<{ slug: string; previewToken: string }>("POST", `/api/posts/${args.id}/preview-token`);
      if (status !== 200) return error(data);
      const baseUrl = process.env.MCP_SITE_URL || "http://localhost:3200";
      return text({ previewUrl: `${baseUrl}/blog/${data.slug}?preview=${data.previewToken}` });
    }

    case "import_markdown": {
      const { status, data } = await apiRequest<{ html: string; title: string }>("POST", "/api/posts/import-markdown", { markdown: args.markdown });
      if (status !== 200) return error(data);
      return text(data);
    }

    case "get_post_reactions": {
      const { status, data } = await apiRequest<Reaction[]>("GET", `/api/posts/${args.postId}/reactions`, undefined, false);
      if (status !== 200) return error(data);
      return text({ reactions: data });
    }

    case "get_post_comments": {
      const { status, data } = await apiRequest<Comment[]>("GET", `/api/posts/${args.postId}/comments`, undefined, false);
      if (status !== 200) return error(data);
      return text({ comments: data });
    }

    case "delete_comment": {
      if (!args.confirm) return error("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/admin/comments/${args.id}`);
      if (status !== 204) return error(data);
      return text({ success: true, deleted: true, id: args.id });
    }

    case "list_all_comments": {
      const params = new URLSearchParams();
      if (args.status && args.status !== "all") params.set("status", String(args.status));
      if (args.page) params.set("page", String(args.page));
      if (args.perPage) params.set("perPage", String(args.perPage));
      const { status, data } = await apiRequest<{ data: unknown[]; total: number; page: number; perPage: number; totalPages: number }>("GET", `/api/admin/comments?${params}`);
      if (status !== 200) return error(data);
      return text(data);
    }

    case "update_comment_status": {
      const { status, data } = await apiRequest("PUT", `/api/admin/comments/${args.id}/status`, { status: args.status });
      if (status !== 200) return error(data);
      return text({ success: true, id: args.id, status: args.status });
    }

    case "update_profile": {
      const body: Record<string, string> = {};
      if (args.name) body.name = String(args.name);
      if (args.email) body.email = String(args.email);
      const { status, data } = await apiRequest<{ user: { id: string; name: string; email: string } }>("PUT", "/api/auth/profile", body);
      if (status !== 200) return error(data);
      return text({ success: true, profile: { name: data.user.name, email: data.user.email } });
    }

    default:
      return error(`Unknown tool: ${name}`);
  }
}
