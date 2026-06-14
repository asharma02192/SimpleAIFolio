import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

export const aiWriterTools: Tool[] = [
  {
    name: "list_ai_conversations",
    description: "List AI writer conversations. Each conversation is a blog post being drafted with AI assistance. Returns id, title, topic, status, and timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["active", "archived", "all"], default: "active", description: "Filter conversations by status" },
        search: { type: "string", description: "Search title and topic" },
        page: { type: "number", default: 1 },
        pageSize: { type: "number", default: 25 },
      },
    },
  },
  {
    name: "create_ai_conversation",
    description: "Start a new AI blog writing conversation with a topic. The AI will respond with a clarification message to help refine the direction. Requires a configured AI provider.",
    inputSchema: {
      type: "object",
      required: ["topic"],
      properties: {
        topic: { type: "string", description: "The blog post topic to write about (max 240 chars)" },
      },
    },
  },
  {
    name: "get_ai_conversation",
    description: "Get full detail of an AI conversation including messages, brief, draft (with HTML content, SEO scores, recommendations), research sources, and rewrite proposals.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
      },
    },
  },
  {
    name: "send_ai_message",
    description: "Send a message in an AI conversation. The AI will reply with guidance, suggestions, or clarifications about the blog post being written.",
    inputSchema: {
      type: "object",
      required: ["id", "message"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
        message: { type: "string", description: "Message text (max 4000 chars)" },
      },
    },
  },
  {
    name: "generate_brief",
    description: "Generate a structured content brief from the AI based on the conversation topic and messages. The brief includes audience, goal, tone, keywords, word count, and content type. Must be called before generating a draft.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
      },
    },
  },
  {
    name: "approve_brief",
    description: "Approve the AI-generated brief, enabling draft generation. Optionally edit brief fields before approving. Once approved, call generate_draft to create the full blog post.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
        topic: { type: "string", description: "Override the brief topic" },
        audience: { type: "string", description: "Override target audience" },
        goal: { type: "string", description: "Override content goal" },
        tone: { type: "string", description: "Override writing tone" },
        primaryKeyword: { type: "string", description: "Override primary SEO keyword" },
        secondaryKeywords: { type: "array", items: { type: "string" }, description: "Override secondary keywords" },
        wordCount: { type: "number", description: "Target word count (300-5000)" },
        contentType: { type: "string", description: "Content type (e.g. 'guide', 'listicle', 'tutorial')" },
        cta: { type: "string", description: "Call to action" },
        notes: { type: "string", description: "Additional notes for the AI" },
      },
    },
  },
  {
    name: "generate_draft",
    description: "Generate a full blog post draft from the approved brief. The draft includes title, slug, HTML body, SEO meta, FAQ, scores (SEO/engagement/readability), recommendations, and internal link suggestions. Requires an approved brief.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
      },
    },
  },
  {
    name: "request_rewrite",
    description: "Request an AI rewrite proposal for a specific section of the draft. Returns a proposal with a preview of the rewritten content. Use apply_rewrite to apply it.",
    inputSchema: {
      type: "object",
      required: ["id", "action"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
        action: {
          type: "string",
          enum: ["improve_intro", "stronger_title", "seo_focus", "more_human", "add_examples", "add_faq", "improve_cta", "shorten", "expand", "improve_readability"],
          description: "Type of rewrite to perform",
        },
        selectedText: { type: "string", description: "Optional specific text to focus the rewrite on" },
      },
    },
  },
  {
    name: "apply_rewrite",
    description: "Apply a previously generated rewrite proposal to the draft. The proposal must be in 'proposed' status. Returns the updated conversation detail.",
    inputSchema: {
      type: "object",
      required: ["id", "proposalId"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
        proposalId: { type: "string", description: "Rewrite proposal ID (UUID)" },
      },
    },
  },
  {
    name: "save_ai_draft",
    description: "Save the AI-generated draft to the CMS as a blog post. Creates a new DRAFT post (or updates if already saved). Returns the post ID and edit URL. The post can then be published using publish_post.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Conversation ID (UUID)" },
        includeReferences: { type: "boolean", description: "Include approved research sources as a references section in the post", default: false },
      },
    },
  },
];

export async function handleAiWriterTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_ai_conversations": {
      const params = new URLSearchParams();
      if (args.filter) params.set("filter", String(args.filter));
      if (args.search) params.set("search", String(args.search));
      if (args.page) params.set("page", String(args.page));
      if (args.pageSize) params.set("pageSize", String(args.pageSize));

      const { status, data } = await apiRequest<{ items: unknown[]; total: number; page: number; pageSize: number; hasMore: boolean }>("GET", `/api/admin/ai/conversations?${params}`);
      if (status !== 200) return fail(data);
      return ok(data);
    }

    case "create_ai_conversation": {
      const { status, data } = await apiRequest("POST", "/api/admin/ai/conversations", { topic: args.topic });
      if (status === 201) {
        const conv = data as Record<string, unknown>;
        return ok({ success: true, conversationId: conv.id, title: conv.title, status: conv.status, messages: conv.messages });
      }
      if (status === 503) return fail("AI provider not configured. Set up AI config in Settings to use the AI writer.");
      return fail(data);
    }

    case "get_ai_conversation": {
      const { status, data } = await apiRequest("GET", `/api/admin/ai/conversations/${args.id}`);
      if (status !== 200) return fail(data);
      const conv = data as Record<string, unknown>;
      const draft = conv.draft as Record<string, unknown> | null;
      return ok({
        id: conv.id,
        title: conv.title,
        topic: conv.topic,
        status: conv.status,
        messages: conv.messages,
        brief: conv.brief ? {
          topic: (conv.brief as Record<string, unknown>).topic,
          audience: (conv.brief as Record<string, unknown>).audience,
          primaryKeyword: (conv.brief as Record<string, unknown>).primaryKeyword,
          wordCount: (conv.brief as Record<string, unknown>).wordCount,
          approvedAt: (conv.brief as Record<string, unknown>).approvedAt,
        } : null,
        draft: draft ? {
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt,
          metaTitle: draft.metaTitle,
          metaDescription: draft.metaDescription,
          contentHtml: draft.contentHtml ? `[${String(draft.contentHtml).length} chars of HTML]` : null,
          seoScore: draft.seoScore,
          engagementScore: draft.engagementScore,
          readabilityScore: draft.readabilityScore,
          recommendations: draft.recommendations,
          postId: draft.postId,
          status: draft.status,
        } : null,
        proposals: conv.proposals,
        researchEnabled: conv.researchEnabled,
      });
    }

    case "send_ai_message": {
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/message`, { message: args.message });
      if (status === 200) {
        const conv = data as Record<string, unknown>;
        const msgs = conv.messages as Array<Record<string, unknown>>;
        const lastAssistant = msgs?.filter((m) => m.role === "assistant").pop();
        return ok({ success: true, reply: lastAssistant?.content || "Message sent." });
      }
      if (status === 503) return fail("AI provider not configured.");
      return fail(data);
    }

    case "generate_brief": {
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/brief`);
      if (status === 200) {
        const conv = data as Record<string, unknown>;
        const brief = conv.brief as Record<string, unknown> | null;
        return ok({
          success: true,
          brief: brief ? {
            topic: brief.topic,
            audience: brief.audience,
            goal: brief.goal,
            tone: brief.tone,
            primaryKeyword: brief.primaryKeyword,
            secondaryKeywords: brief.secondaryKeywords,
            wordCount: brief.wordCount,
            contentType: brief.contentType,
            cta: brief.cta,
            approved: Boolean(brief.approvedAt),
          } : null,
        });
      }
      if (status === 503) return fail("AI provider not configured.");
      return fail(data);
    }

    case "approve_brief": {
      const body: Record<string, unknown> = { approved: true };
      for (const k of ["topic", "audience", "goal", "tone", "primaryKeyword", "secondaryKeywords", "wordCount", "contentType", "cta", "notes"]) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      const { status, data } = await apiRequest("PUT", `/api/admin/ai/conversations/${args.id}/brief`, body);
      if (status === 200) {
        const conv = data as Record<string, unknown>;
        const brief = conv.brief as Record<string, unknown> | null;
        return ok({ success: true, approved: Boolean(brief?.approvedAt), topic: brief?.topic });
      }
      return fail(data);
    }

    case "generate_draft": {
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/draft`);
      if (status === 200) {
        const conv = data as Record<string, unknown>;
        const draft = conv.draft as Record<string, unknown> | null;
        return ok({
          success: true,
          draft: draft ? {
            title: draft.title,
            slug: draft.slug,
            excerpt: draft.excerpt,
            metaTitle: draft.metaTitle,
            metaDescription: draft.metaDescription,
            contentLength: draft.contentHtml ? String(draft.contentHtml).length : 0,
            seoScore: draft.seoScore,
            engagementScore: draft.engagementScore,
            readabilityScore: draft.readabilityScore,
            tagSuggestions: draft.tagSuggestions,
            recommendations: draft.recommendations,
          } : null,
        });
      }
      if (status === 503) return fail("AI provider not configured.");
      if (status === 400) return fail("Generate and approve a brief first.");
      return fail(data);
    }

    case "request_rewrite": {
      const body: Record<string, unknown> = { action: args.action };
      if (args.selectedText) body.selectedText = args.selectedText;
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/rewrite`, body);
      if (status === 200) {
        const result = data as Record<string, unknown>;
        const proposal = result.proposal as Record<string, unknown> | undefined;
        return ok({
          success: true,
          proposal: proposal ? {
            id: proposal.id,
            action: proposal.action,
            label: proposal.label,
            summary: proposal.summary,
            target: proposal.target,
            status: proposal.status,
            preview: proposal.preview ? `[${String(proposal.preview).length} chars preview]` : null,
          } : null,
        });
      }
      if (status === 503) return fail("AI provider not configured.");
      if (status === 400) return fail("Generate a draft before requesting rewrites.");
      return fail(data);
    }

    case "apply_rewrite": {
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/rewrite/${args.proposalId}/apply`);
      if (status === 200) return ok({ success: true, applied: true });
      if (status === 409) return fail("Proposal already applied, rejected, or draft has changed. Generate a fresh rewrite.");
      return fail(data);
    }

    case "save_ai_draft": {
      const body: Record<string, unknown> = { includeReferences: Boolean(args.includeReferences) };
      const { status, data } = await apiRequest("POST", `/api/admin/ai/conversations/${args.id}/save-draft`, body);
      if (status === 200 || status === 201) {
        const result = data as Record<string, unknown>;
        return ok({ success: true, postId: result.postId, editUrl: result.editUrl, saved: true });
      }
      if (status === 400) return fail("Generate a draft before saving.");
      return fail(data);
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
