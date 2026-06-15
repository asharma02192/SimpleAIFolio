#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { StreamableHTTPServerTransport as StreamableHTTPServerTransportType } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { postTools, handlePostTool } from "./tools/posts.js";
import { categoryTools, handleCategoryTool } from "./tools/categories.js";
import { tagTools, handleTagTool } from "./tools/tags.js";
import { projectTools, handleProjectTool } from "./tools/projects.js";
import { mediaTools, handleMediaTool } from "./tools/media.js";
import { settingsTools, handleSettingsTool } from "./tools/settings.js";
import { experienceTools, handleExperienceTool } from "./tools/experience.js";
import { aiWriterTools, handleAiWriterTool } from "./tools/ai-writer.js";
import { analyticsTools, handleAnalyticsTool } from "./tools/analytics.js";
import { newsletterTools, handleNewsletterTool } from "./tools/newsletter.js";
import { contactTools, handleContactTool } from "./tools/contact.js";
import { snippetTools, handleSnippetTool } from "./tools/snippets.js";
import { resourceDefs, readResource } from "./resources.js";
import { promptDefs, getPrompt } from "./prompts.js";
import { getToken, getRemoteApiKey } from "./client.js";

const allTools = [
  ...postTools,
  ...categoryTools,
  ...tagTools,
  ...projectTools,
  ...mediaTools,
  ...settingsTools,
  ...experienceTools,
  ...aiWriterTools,
  ...analyticsTools,
  ...newsletterTools,
  ...contactTools,
  ...snippetTools,
];

function createMcpServer() {
  const server = new Server(
    {
      name: "SimpleAIFolio-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const a = args as Record<string, unknown>;

    if (postTools.some((t) => t.name === name)) return handlePostTool(name, a);
    if (categoryTools.some((t) => t.name === name)) return handleCategoryTool(name, a);
    if (tagTools.some((t) => t.name === name)) return handleTagTool(name, a);
    if (projectTools.some((t) => t.name === name)) return handleProjectTool(name, a);
    if (mediaTools.some((t) => t.name === name)) return handleMediaTool(name, a);
    if (settingsTools.some((t) => t.name === name)) return handleSettingsTool(name, a);
    if (experienceTools.some((t) => t.name === name)) return handleExperienceTool(name, a);
    if (aiWriterTools.some((t) => t.name === name)) return handleAiWriterTool(name, a);
    if (analyticsTools.some((t) => t.name === name)) return handleAnalyticsTool(name, a);
    if (newsletterTools.some((t) => t.name === name)) return handleNewsletterTool(name, a);
    if (contactTools.some((t) => t.name === name)) return handleContactTool(name, a);
    if (snippetTools.some((t) => t.name === name)) return handleSnippetTool(name, a);

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    } as any;
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourceDefs.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const text = await readResource(uri);
    return {
      contents: [{ uri, mimeType: "application/json", text }],
    } as any;
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: promptDefs.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const prompt = getPrompt(name, args as Record<string, unknown>);
    if (!prompt) {
      return { isError: true, content: [{ type: "text", text: `Unknown prompt: ${name}` }] } as any;
    }
    return prompt as any;
  });

  return server;
}

async function main() {
  const isTest = process.argv.includes("--test");
  const isHttp = process.argv.includes("--http") || process.env.MCP_HTTP === "true";
  const httpPort = parseInt(process.env.MCP_HTTP_PORT || "3100", 10);

  if (isTest) {
    await runTests();
    process.exit(0);
    return;
  }

  const token = await getToken();
  if (!token) {
    process.stderr.write(
      "Warning: Could not authenticate to backend API.\n" +
      "Set MCP_AUTH_EMAIL + MCP_AUTH_PASSWORD or MCP_API_TOKEN environment variables.\n\n"
    );
  }

  if (isHttp) {
    const { createServer } = await import("node:http");
    const { StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const { randomUUID } = await import("node:crypto");

    const transports = new Map<string, StreamableHTTPServerTransportType>();

    const httpServer = createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", tools: allTools.length, resources: resourceDefs.length, prompts: promptDefs.length }));
        return;
      }

      if (req.url === "/mcp" && ["POST", "GET", "DELETE"].includes(req.method || "")) {
        const remoteApiKey = await getRemoteApiKey();
        if (remoteApiKey) {
          const authHeader = req.headers["authorization"] || "";
          const providedKey = String(authHeader).replace(/^Bearer\s+/i, "");
          if (providedKey !== remoteApiKey) {
            res.writeHead(401, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid API key" }));
            return;
          }
        }

        let body = "";
        if (req.method === "POST") {
          for await (const chunk of req) body += chunk;
        }
        const parsedBody = body ? JSON.parse(body) : undefined;

        const sessionIdHeader = req.headers["mcp-session-id"];
        const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

        try {
          const existingTransport = sessionId ? transports.get(sessionId) : undefined;

          if (existingTransport) {
            await existingTransport.handleRequest(req, res, parsedBody);
            return;
          }

          if (req.method === "POST" && !sessionId && isInitializeRequest(parsedBody)) {
            const transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (newSessionId: string) => {
                transports.set(newSessionId, transport);
              },
            });

            transport.onclose = () => {
              const closedSessionId = transport.sessionId;
              if (closedSessionId) transports.delete(closedSessionId);
            };

            const requestServer = createMcpServer();
            await requestServer.connect(transport);
            await transport.handleRequest(req, res, parsedBody);
            return;
          }

          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: No valid session ID provided" },
            id: null,
          }));
          return;
        } catch (error) {
          process.stderr.write(`Error handling MCP request: ${error instanceof Error ? error.message : String(error)}\n`);
          if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            }));
          }
          return;
        }
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found. Use POST /mcp or GET /health" }));
    });

    httpServer.listen(httpPort, () => {
      process.stderr.write(`SimpleAIFolio MCP server running on HTTP :${httpPort}\n`);
      process.stderr.write(`  POST /mcp   — MCP protocol endpoint (stateful)\n`);
      process.stderr.write(`  GET  /health — Health check\n`);
    });
  } else {
    const transport = new StdioServerTransport();
    const server = createMcpServer();
    await server.connect(transport);
    process.stderr.write("SimpleAIFolio MCP server running on stdio\n");
  }
}

async function runTests() {
  process.stderr.write("=== SimpleAIFolio MCP Server — End-to-End Tests ===\n\n");

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      passed++;
      process.stderr.write(`  ✓ ${name}\n`);
    } catch (e) {
      failed++;
      process.stderr.write(`  ✗ ${name}\n`);
      process.stderr.write(`    ${e instanceof Error ? e.message : String(e)}\n`);
    }
  }

  function assert(condition: unknown, msg: string): asserts condition {
    if (!condition) throw new Error(msg);
  }

  // Auth test
  await test("authenticate to backend", async () => {
    const token = getToken();
    assert(token, "No token received — check MCP_AUTH_EMAIL/MCP_AUTH_PASSWORD");
  });

  // list_posts — may be empty on fresh deploy
  await test("list_posts returns paginated results", async () => {
    const result = await handlePostTool("list_posts", { perPage: 3 });
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(parsed.posts), "Expected posts array");
    assert(typeof parsed.total === "number", "Expected total count");
  });

  // list_posts with status=all
  await test("list_posts with status=all works", async () => {
    const result = await handlePostTool("list_posts", { status: "all", perPage: 3 });
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(parsed.posts), "Expected posts array");
  });

  // list_posts with search
  await test("list_posts search works", async () => {
    const result = await handlePostTool("list_posts", { search: "test", perPage: 3 });
    const parsed = JSON.parse(result.content[0]?.text || "{}");
    assert(parsed.posts, "Expected posts array");
  });

  // create_post — runs before read tests so they have data on fresh deploy
  let createdPostId: string | null = null;
  let createdPostSlug: string | null = null;
  await test("create_post as draft", async () => {
    const result = await handlePostTool("create_post", {
      title: "MCP Test Post — Safe to Delete",
      slug: `mcp-test-${Date.now()}`,
      body: "<p>This is a test post created by the MCP server test suite.</p>",
      excerpt: "Test post from MCP",
      status: "DRAFT",
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, `Expected success: ${JSON.stringify(data)}`);
    assert(data.post?.id, "Expected post id");
    createdPostId = data.post.id;
    createdPostSlug = data.post.slug;
  });

  // get_post by slug
  await test("get_post by slug", async () => {
    assert(createdPostSlug, "No created post slug");
    const result = await handlePostTool("get_post", { slug: createdPostSlug });
    const post = JSON.parse(result.content[0]?.text || "{}");
    assert(post.title, "Expected post title");
    assert(post.body !== undefined, "Expected post body");
  });

  // get_post by id (admin endpoint)
  await test("get_post by id (admin)", async () => {
    assert(createdPostId, "No created post id");
    const result = await handlePostTool("get_post", { id: createdPostId });
    const post = JSON.parse(result.content[0]?.text || "{}");
    assert(post.title, "Expected post title");
  });

  // update_post
  await test("update_post title", async () => {
    assert(createdPostId, "No created post to update");
    const result = await handlePostTool("update_post", {
      id: createdPostId,
      title: "MCP Test Post — Updated Title",
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    assert(data.post?.title === "MCP Test Post — Updated Title", "Expected updated title");
  });

  // publish_post
  await test("publish_post", async () => {
    assert(createdPostId, "No created post to publish");
    const result = await handlePostTool("publish_post", { id: createdPostId });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // schedule_post
  await test("schedule_post", async () => {
    assert(createdPostId, "No created post to schedule");
    const future = new Date(Date.now() + 86400000).toISOString();
    const result = await handlePostTool("schedule_post", { id: createdPostId, scheduledAt: future });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // preview_post
  await test("preview_post generates token", async () => {
    assert(createdPostId, "No created post to preview");
    const result = await handlePostTool("preview_post", { id: createdPostId });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.previewUrl, "Expected preview URL");
    assert(data.previewUrl.includes("?preview="), "Expected preview token in URL");
  });

  // import_markdown
  await test("import_markdown converts to HTML", async () => {
    const result = await handlePostTool("import_markdown", {
      markdown: "# Hello World\n\nThis is **bold** text.",
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.html, "Expected HTML output");
    assert(data.title === "Hello World", `Expected title "Hello World", got "${data.title}"`);
    assert(data.html.includes("<strong>bold</strong>"), "Expected bold HTML");
  });

  // get_post_reactions
  await test("get_post_reactions returns array", async () => {
    assert(createdPostId, "No created post for reactions test");
    const result = await handlePostTool("get_post_reactions", { postId: createdPostId });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.reactions), "Expected reactions array");
  });

  // get_post_comments
  await test("get_post_comments returns array", async () => {
    assert(createdPostId, "No created post for comments test");
    const result = await handlePostTool("get_post_comments", { postId: createdPostId });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.comments), "Expected comments array");
  });

  // delete_post (cleanup)
  await test("delete_post with confirm", async () => {
    assert(createdPostId, "No created post to delete");
    const result = await handlePostTool("delete_post", { id: createdPostId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // delete_post without confirm (should fail)
  await test("delete_post without confirm is blocked", async () => {
    const result = await handlePostTool("delete_post", { id: "fake-id", confirm: false });
    assert(result.isError, "Expected error when confirm=false");
  });

  await test("list_all_comments returns paginated results", async () => {
    const result = await handlePostTool("list_all_comments", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.total === "number", "Expected total count");
    assert(Array.isArray(data.data), "Expected data array");
  });

  await test("list_all_comments with status filter", async () => {
    const result = await handlePostTool("list_all_comments", { status: "approved" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.total === "number", "Expected total count");
  });

  await test("update_comment_status validates status", async () => {
    const result = await handlePostTool("update_comment_status", { id: "fake-id", status: "invalid" });
    assert(result.isError, "Expected error for invalid status");
  });

  await test("update_profile validates input", async () => {
    const result = await handlePostTool("update_profile", { email: "not-an-email" });
    assert(result.isError, "Expected error for invalid email");
  });

  // ── Phase 2: Categories, Tags, Projects, Media, Settings, Experience ──

  // Categories
  await test("list_categories returns array", async () => {
    const result = await handleCategoryTool("list_categories", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.categories), "Expected categories array");
  });

  let createdCategoryId: string | null = null;
  await test("create_category", async () => {
    const result = await handleCategoryTool("create_category", {
      name: `MCP Test Cat ${Date.now()}`,
      slug: `mcp-test-cat-${Date.now()}`,
      description: "Test category from MCP",
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    assert(data.category?.id, "Expected category id");
    createdCategoryId = data.category.id;
  });

  await test("update_category", async () => {
    assert(createdCategoryId, "No category to update");
    const result = await handleCategoryTool("update_category", { id: createdCategoryId, description: "Updated by MCP" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  await test("delete_category", async () => {
    assert(createdCategoryId, "No category to delete");
    const result = await handleCategoryTool("delete_category", { id: createdCategoryId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // Tags
  await test("list_tags returns array", async () => {
    const result = await handleTagTool("list_tags", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.tags), "Expected tags array");
  });

  let createdTagId: string | null = null;
  await test("create_tag", async () => {
    const result = await handleTagTool("create_tag", { name: `mcp-test-${Date.now()}`, slug: `mcp-test-${Date.now()}` });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    createdTagId = data.tag?.id;
  });

  await test("update_tag", async () => {
    assert(createdTagId, "No tag to update");
    const result = await handleTagTool("update_tag", { id: createdTagId, name: `mcp-updated-${Date.now()}` });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  await test("delete_tag", async () => {
    assert(createdTagId, "No tag to delete");
    const result = await handleTagTool("delete_tag", { id: createdTagId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // Projects
  await test("list_projects returns array", async () => {
    const result = await handleProjectTool("list_projects", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.projects), "Expected projects array");
  });

  let createdProjectId: string | null = null;
  await test("create_project", async () => {
    const result = await handleProjectTool("create_project", {
      title: `MCP Test Project ${Date.now()}`,
      description: "A test project from MCP",
      techStack: ["TypeScript", "MCP"],
      featured: false,
      order: 999,
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    createdProjectId = data.project?.id;
  });

  await test("update_project", async () => {
    assert(createdProjectId, "No project to update");
    const result = await handleProjectTool("update_project", { id: createdProjectId, description: "Updated by MCP" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  await test("delete_project", async () => {
    assert(createdProjectId, "No project to delete");
    const result = await handleProjectTool("delete_project", { id: createdProjectId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // Media
  await test("list_media returns array", async () => {
    const result = await handleMediaTool("list_media", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.media), "Expected media array");
  });

  // Settings
  await test("get_settings returns object", async () => {
    const result = await handleSettingsTool("get_settings", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.settings === "object", "Expected settings object");
  });

  await test("publish_scheduled returns count", async () => {
    const result = await handleSettingsTool("publish_scheduled", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    assert(typeof data.published === "number", "Expected published count");
  });

  // Experience
  await test("list_experience returns array", async () => {
    const result = await handleExperienceTool("list_experience", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.experience), "Expected experience array");
  });

  let createdExpId: string | null = null;
  await test("create_experience", async () => {
    const result = await handleExperienceTool("create_experience", {
      role: `MCP Test Role ${Date.now()}`,
      period: "2026",
      description: "Test experience from MCP",
      order: 999,
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    createdExpId = data.experience?.id;
  });

  await test("update_experience", async () => {
    assert(createdExpId, "No experience to update");
    const result = await handleExperienceTool("update_experience", { id: createdExpId, description: "Updated by MCP" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  await test("delete_experience", async () => {
    assert(createdExpId, "No experience to delete");
    const result = await handleExperienceTool("delete_experience", { id: createdExpId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // ── Phase 3: AI Writer ──

  await test("list_ai_conversations returns list", async () => {
    const result = await handleAiWriterTool("list_ai_conversations", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.total === "number", "Expected total count");
    assert(Array.isArray(data.items), "Expected items array");
  });

  let aiConvId: string | null = null;
  await test("get_ai_conversation detail", async () => {
    const listResult = await handleAiWriterTool("list_ai_conversations", { filter: "all" });
    const list = JSON.parse(listResult.content[0]?.text || "{}");
    assert(list.items?.length > 0, "Expected at least 1 conversation");
    aiConvId = list.items[0].id;
  });

  await test("get_ai_conversation by id", async () => {
    assert(aiConvId, "No conversation ID");
    const result = await handleAiWriterTool("get_ai_conversation", { id: aiConvId });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.id, "Expected conversation id");
    assert(data.title, "Expected title");
  });

  await test("list_ai_conversations search", async () => {
    const result = await handleAiWriterTool("list_ai_conversations", { search: "test", filter: "all" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.total === "number", "Expected total count");
  });

  // create_ai_conversation / generate_brief / generate_draft / etc. require AI provider
  // — test graceful failure when AI is not configured
  await test("create_ai_conversation handles no AI gracefully", async () => {
    const result = await handleAiWriterTool("create_ai_conversation", { topic: "MCP test topic" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    if (result.isError) {
      assert(data?.text?.includes("AI provider") || data?.text?.includes("Failed"), "Expected AI error message");
    } else {
      assert(data.success || data.conversationId, "Expected success if AI configured");
    }
  });

  // ── Phase 4: Analytics, Newsletter, Contact, Snippets ──

  // Analytics
  await test("get_dashboard_stats returns stats", async () => {
    const result = await handleAnalyticsTool("get_dashboard_stats", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.totalViews === "number", "Expected totalViews");
    assert(typeof data.totalPosts === "number", "Expected totalPosts");
    assert(Array.isArray(data.topPages), "Expected topPages array");
  });

  await test("get_dashboard_stats with 7-day window", async () => {
    const result = await handleAnalyticsTool("get_dashboard_stats", { windowDays: 7 });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.totalViews === "number", "Expected totalViews");
  });

  await test("get_page_views for homepage", async () => {
    const result = await handleAnalyticsTool("get_page_views", { path: "/" });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data.views === "number", "Expected view count");
  });

  await test("get_top_pages returns array", async () => {
    const result = await handleAnalyticsTool("get_top_pages", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.topPages), "Expected topPages array");
  });

  await test("get_analytics_alerts returns config", async () => {
    const result = await handleAnalyticsTool("get_analytics_alerts", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(typeof data === "object", "Expected alert settings object");
  });

  // Newsletter
  await test("list_subscribers returns array", async () => {
    const result = await handleNewsletterTool("list_subscribers", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.subscribers), "Expected subscribers array");
    assert(typeof data.total === "number", "Expected total count");
  });

  await test("add_subscriber adds email", async () => {
    const result = await handleNewsletterTool("add_subscriber", { email: `mcp-test-${Date.now()}@example.com` });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    assert(data.id, "Expected subscriber ID");
  });

  await test("remove_subscriber without confirm is blocked", async () => {
    const result = await handleNewsletterTool("remove_subscriber", { id: "fake-id", confirm: false });
    assert(result.isError, "Expected error when confirm=false");
  });

  // Contact
  await test("list_messages returns array", async () => {
    const result = await handleContactTool("list_messages", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.messages), "Expected messages array");
    assert(typeof data.unread === "number", "Expected unread count");
  });

  await test("delete_message without confirm is blocked", async () => {
    const result = await handleContactTool("delete_message", { id: "fake-id", confirm: false });
    assert(result.isError, "Expected error when confirm=false");
  });

  // Snippets
  await test("list_snippets returns array", async () => {
    const result = await handleSnippetTool("list_snippets", {});
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(Array.isArray(data.snippets), "Expected snippets array");
  });

  let createdSnippetId: string | null = null;
  await test("create_snippet", async () => {
    const result = await handleSnippetTool("create_snippet", {
      name: `MCP Test Snippet ${Date.now()}`,
      code: "<!-- test -->",
      location: "body_end",
      enabled: false,
    });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
    createdSnippetId = data.snippet?.id;
  });

  await test("update_snippet", async () => {
    assert(createdSnippetId, "No snippet to update");
    const result = await handleSnippetTool("update_snippet", { id: createdSnippetId, enabled: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  await test("delete_snippet", async () => {
    assert(createdSnippetId, "No snippet to delete");
    const result = await handleSnippetTool("delete_snippet", { id: createdSnippetId, confirm: true });
    const data = JSON.parse(result.content[0]?.text || "{}");
    assert(data.success, "Expected success");
  });

  // ── Phase 5: Resources & Prompts ──

  // Resources
  await test("6 resources registered", () => {
    assert(resourceDefs.length === 6, `Expected 6 resources, got ${resourceDefs.length}`);
  });

  await test("read posts://drafts resource", async () => {
    const text = await readResource("posts://drafts");
    const data = JSON.parse(text);
    assert(Array.isArray(data.drafts), "Expected drafts array");
    assert(typeof data.count === "number", "Expected count");
  });

  await test("read posts://published resource", async () => {
    const text = await readResource("posts://published");
    const data = JSON.parse(text);
    assert(Array.isArray(data.published), "Expected published array");
    assert(typeof data.count === "number", "Expected count");
  });

  await test("read posts://scheduled resource", async () => {
    const text = await readResource("posts://scheduled");
    const data = JSON.parse(text);
    assert(Array.isArray(data.scheduled), "Expected scheduled array");
  });

  await test("read site://settings resource", async () => {
    const text = await readResource("site://settings");
    const data = JSON.parse(text);
    assert(typeof data === "object", "Expected settings object");
  });

  await test("read site://stats resource", async () => {
    const text = await readResource("site://stats");
    const data = JSON.parse(text);
    assert(typeof data.totalViews === "number", "Expected totalViews");
  });

  await test("read newsletter://subscribers/count resource", async () => {
    const text = await readResource("newsletter://subscribers/count");
    const data = JSON.parse(text);
    assert(typeof data.total === "number", "Expected total");
    assert(typeof data.active === "number", "Expected active");
  });

  // Prompts
  await test("6 prompts registered", () => {
    assert(promptDefs.length === 6, `Expected 6 prompts, got ${promptDefs.length}`);
  });

  await test("write-blog-post prompt generates message", () => {
    const prompt = getPrompt("write-blog-post", { topic: "Docker Best Practices" });
    assert(prompt, "Expected prompt");
    assert(prompt!.messages.length > 0, "Expected messages");
    assert(prompt!.messages[0].content.text.includes("Docker Best Practices"), "Expected topic in text");
  });

  await test("review-draft prompt generates message", () => {
    const prompt = getPrompt("review-draft", { identifier: "test-slug" });
    assert(prompt, "Expected prompt");
    assert(prompt!.messages[0].content.text.includes("test-slug"), "Expected identifier in text");
  });

  await test("content-audit prompt generates message", () => {
    const prompt = getPrompt("content-audit", {});
    assert(prompt, "Expected prompt");
    assert(prompt!.messages[0].content.text.includes("content audit"), "Expected audit text");
  });

  await test("weekly-summary prompt generates message", () => {
    const prompt = getPrompt("weekly-summary", {});
    assert(prompt, "Expected prompt");
    assert(prompt!.messages[0].content.text.includes("weekly"), "Expected weekly text");
  });

  await test("setup-portfolio prompt has onboarding instructions", () => {
    const prompt = getPrompt("setup-portfolio", {});
    assert(prompt, "Expected prompt");
    const text = prompt!.messages[0].content.text;
    assert(text.includes("Phase 1: Gather Information"), "Expected Phase 1");
    assert(text.includes("update_settings"), "Expected tool call instructions");
    assert(text.includes("create_experience"), "Expected experience instructions");
    assert(text.includes("create_project"), "Expected project instructions");
    assert(text.includes("create_category"), "Expected category instructions");
    assert(text.includes("skill_groups"), "Expected skill_groups reference");
    assert(text.includes("NEVER create duplicate"), "Expected safety rules");
  });

  await test("setup-portfolio with initial info works", () => {
    const prompt = getPrompt("setup-portfolio", { info: "I'm Jane, a React developer from Canada" });
    assert(prompt, "Expected prompt");
    assert(prompt!.messages[0].content.text.includes("Jane"), "Expected user info in prompt");
  });

  await test("refresh-portfolio prompt has update instructions", () => {
    const prompt = getPrompt("refresh-portfolio", { changes: "add a new project" });
    assert(prompt, "Expected prompt");
    const text = prompt!.messages[0].content.text;
    assert(text.includes("add a new project"), "Expected user changes in prompt");
    assert(text.includes("NEVER overwrite"), "Expected safety rules");
    assert(text.includes("list_projects"), "Expected current state check");
  });

  // Tool count check
  await test("all 65 tools, 6 resources, 6 prompts registered", async () => {
    assert(allTools.length === 65, `Expected 65 tools, got ${allTools.length}`);
    assert(resourceDefs.length === 6, `Expected 6 resources`);
    assert(promptDefs.length === 6, `Expected 6 prompts`);
  });

  process.stderr.write(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
