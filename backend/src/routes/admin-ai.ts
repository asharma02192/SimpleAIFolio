import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, type AuthRequest } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { getRequestLogMeta, logError, logInfo } from "../utils/logging";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import {
  computeReadingTime,
  createBlogStudioAiService,
  slugify,
  stripHtml,
  type AiBriefData,
  type AiConversationMessageInput,
  type AiDraftData,
  type AiInternalLinkSuggestion,
  type AiResearchApprovalStatus,
  type AiResearchData,
  type AiResearchSource,
  type AiRewriteAction,
  type AiRewriteProposal,
  type BlogStudioAiService,
} from "../services/ai/blog-studio";
import { getAiProviderConfig } from "../services/ai/provider";
import { sanitizeGeneratedHtml, toSafeUrl } from "../services/ai/html";
import { createResearchService, type ResearchService } from "../services/ai/research";

type AdminAiPrisma = {
  aiConversation: any;
  aiMessage: any;
  aiContentBrief: any;
  aiDraftOutput: any;
  aiResearchRun: any;
  aiRewriteProposal: any;
  post: any;
  category: any;
  tag: any;
  pageView: any;
};

const MAX_TOPIC_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_NOTES_LENGTH = 5000;
const MAX_REWRITE_PREVIEW_LENGTH = 16_000;
const MAX_SOURCE_ADMIN_NOTES_LENGTH = 500;
const SOURCELESS_RESEARCH_WARNING =
  "Research is available, but no sources have been approved yet. The draft will use research notes only as directional guidance.";

const ALLOWED_REWRITE_ACTIONS = new Set<AiRewriteAction>([
  "improve_intro",
  "stronger_title",
  "seo_focus",
  "more_human",
  "add_examples",
  "add_faq",
  "improve_cta",
  "shorten",
  "expand",
  "improve_readability",
]);

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function coerceString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function coerceBoolean(value: unknown) {
  return value === true;
}

function coerceStringArray(value: unknown, maxItems = 12, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function uniqueStrings(values: string[]) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index);
}

function normalizeSourceApprovalStatus(value: unknown): AiResearchApprovalStatus {
  switch (value) {
    case "approved":
    case "rejected":
    case "needs_review":
      return value;
    default:
      return "needs_review";
  }
}

function toBriefPayload(row: any): AiBriefData | null {
  if (!row) return null;

  return {
    topic: row.topic,
    audience: row.audience || "",
    goal: row.goal || "",
    tone: row.tone || "",
    primaryKeyword: row.primaryKeyword || "",
    secondaryKeywords: safeJsonParse<string[]>(row.secondaryKeywordsJson, []),
    wordCount: row.wordCount ?? null,
    contentType: row.contentType || "",
    cta: row.cta || "",
    notes: row.notes || "",
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
  };
}

function toDraftPayload(row: any): AiDraftData | null {
  if (!row) return null;

  return {
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || "",
    metaTitle: row.metaTitle || "",
    metaDescription: row.metaDescription || "",
    ogImagePrompt: row.ogImagePrompt || "",
    categorySuggestion: row.categorySuggestion || "",
    tagSuggestions: safeJsonParse<string[]>(row.tagsJson, []),
    outline: safeJsonParse(row.outlineJson, []),
    contentHtml: row.contentHtml,
    faq: safeJsonParse(row.faqJson, []),
    seoScore: row.seoScore ?? 0,
    engagementScore: row.engagementScore ?? 0,
    readabilityScore: row.readabilityScore ?? 0,
    recommendations: safeJsonParse<string[]>(row.recommendationsJson, []),
    verificationNotes: safeJsonParse<string[]>(row.verificationNotesJson, []),
    verificationFlags: safeJsonParse(row.verificationFlagsJson, []),
    engagementInsights: safeJsonParse<string[]>(row.engagementInsightsJson, []),
    internalLinkSuggestions: safeJsonParse(row.internalLinkSuggestionsJson, []),
    researchUsed: Boolean(row.researchUsed),
    postId: row.postId || null,
    status: row.status,
  };
}

function toResearchPayload(row: any): AiResearchData | null {
  if (!row) return null;

  return {
    provider: row.provider,
    status: row.status,
    topicSummary: row.topicSummary || "",
    searchIntent: row.searchIntent || "",
    keywordIdeas: safeJsonParse<string[]>(row.keywordIdeasJson, []),
    relatedQuestions: safeJsonParse<string[]>(row.relatedQuestionsJson, []),
    competitorNotes: safeJsonParse<string[]>(row.competitorNotesJson, []),
    contentGaps: safeJsonParse<string[]>(row.contentGapsJson, []),
    sources: safeJsonParse<AiResearchSource[]>(row.sourceNotesJson, []).map((source, index) => ({
      id: source.id || `source-${index + 1}`,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publishedDate: source.publishedDate || null,
      summary: source.summary,
      usefulness: source.usefulness || "medium",
      notes: Array.isArray(source.notes) ? source.notes : [],
      approvalStatus: normalizeSourceApprovalStatus(source.approvalStatus),
      adminNotes: source.adminNotes || "",
    })),
    internalLinkSuggestions: safeJsonParse<AiInternalLinkSuggestion[]>(row.internalLinkOpportunitiesJson, []),
    riskFlags: safeJsonParse<string[]>(row.riskFlagsJson, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRewriteProposalPayload(row: any): AiRewriteProposal {
  const draftPatch = safeJsonParse<Partial<AiDraftData>>(row.draftPatchJson, {});
  return {
    id: row.id,
    action: row.action,
    label: row.label,
    summary: row.summary || "Review the proposed change before applying it.",
    target: row.targetSection,
    preview: typeof row.proposedText === "string" ? row.proposedText.slice(0, MAX_REWRITE_PREVIEW_LENGTH) : "",
    draftPatch,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toConversationPayload(conversation: any, options?: { researchEnabled?: boolean; researchMessage?: string | null }) {
  return {
    id: conversation.id,
    title: conversation.title,
    topic: conversation.topic,
    status: conversation.status,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messages: Array.isArray(conversation.messages)
      ? conversation.messages.map((message: any) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          metadata: safeJsonParse<Record<string, unknown> | null>(message.metadataJson, null),
          createdAt: message.createdAt,
        }))
      : [],
    brief: toBriefPayload(conversation.brief),
    draft: toDraftPayload(conversation.draft),
    research: toResearchPayload(conversation.research),
    proposals: Array.isArray(conversation.rewriteProposals)
      ? conversation.rewriteProposals.map((proposal: any) => toRewriteProposalPayload(proposal))
      : [],
    researchEnabled: options?.researchEnabled ?? false,
    researchMessage: options?.researchMessage ?? null,
  };
}

async function loadConversationForUser(prismaClient: AdminAiPrisma, conversationId: string, userId: string) {
  return prismaClient.aiConversation.findFirst({
    where: {
      id: conversationId,
      userId,
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      brief: true,
      draft: true,
      research: true,
      rewriteProposals: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

function toMessageInputs(messages: any[]): AiConversationMessageInput[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

async function appendConversationMessage(
  prismaClient: AdminAiPrisma,
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata?: Record<string, unknown>
) {
  return prismaClient.aiMessage.create({
    data: {
      conversationId,
      role,
      content,
      metadataJson: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

async function touchConversation(prismaClient: AdminAiPrisma, conversationId: string, status?: string, title?: string) {
  return prismaClient.aiConversation.update({
    where: { id: conversationId },
    data: {
      ...(status ? { status } : {}),
      ...(title ? { title } : {}),
      updatedAt: new Date().toISOString(),
    },
  });
}

async function createUniquePostSlug(prismaClient: AdminAiPrisma, preferredSlug: string, fallbackTitle: string) {
  const base = slugify(preferredSlug || fallbackTitle) || `draft-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  while (await prismaClient.post.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function resolveCategoryId(prismaClient: AdminAiPrisma, suggestion: string | null | undefined) {
  const normalized = suggestion?.trim().toLowerCase();
  if (!normalized) return null;

  const categories = await prismaClient.category.findMany({
    select: { id: true, name: true, slug: true },
  });

  const slug = slugify(normalized);
  const match = categories.find((category: { name: string; slug: string }) =>
    category.slug.toLowerCase() === slug || category.name.toLowerCase() === normalized
  );

  return match?.id || null;
}

async function resolveTagIds(prismaClient: AdminAiPrisma, suggestions: string[]) {
  const existingTags = await prismaClient.tag.findMany({
    select: { id: true, name: true, slug: true },
  });

  const resolvedIds: string[] = [];

  for (const suggestion of suggestions) {
    const normalized = suggestion.trim();
    if (!normalized) continue;

    const normalizedSlug = slugify(normalized);
    const existing = existingTags.find((tag: { name: string; slug: string }) =>
      tag.slug.toLowerCase() === normalizedSlug || tag.name.toLowerCase() === normalized.toLowerCase()
    );

    if (existing) {
      resolvedIds.push(existing.id);
      continue;
    }

    const created = await prismaClient.tag.create({
      data: {
        name: normalized,
        slug: normalizedSlug,
      },
      select: { id: true },
    });

    resolvedIds.push(created.id);
    existingTags.push({ id: created.id, name: normalized, slug: normalizedSlug });
  }

  return resolvedIds;
}

function buildBriefFromRequest(body: Record<string, unknown>, fallbackTopic: string): AiBriefData {
  return {
    topic: coerceString(body.topic, MAX_TOPIC_LENGTH) || fallbackTopic,
    audience: coerceString(body.audience, 300),
    goal: coerceString(body.goal, 300),
    tone: coerceString(body.tone, 120),
    primaryKeyword: coerceString(body.primaryKeyword, 160),
    secondaryKeywords: coerceStringArray(body.secondaryKeywords, 12, 120),
    wordCount: Number.isFinite(Number(body.wordCount)) ? Math.max(300, Math.min(5000, Math.round(Number(body.wordCount)))) : null,
    contentType: coerceString(body.contentType, 120),
    cta: coerceString(body.cta, 300),
    notes: coerceString(body.notes, MAX_NOTES_LENGTH),
    approvedAt: body.approved === true ? new Date().toISOString() : null,
  };
}

function parseRewriteAction(value: unknown): AiRewriteAction | null {
  return typeof value === "string" && ALLOWED_REWRITE_ACTIONS.has(value as AiRewriteAction)
    ? (value as AiRewriteAction)
    : null;
}

function getProposalTargetText(draft: AiDraftData, target: AiRewriteProposal["target"]) {
  switch (target) {
    case "title":
      return draft.title;
    case "meta":
      return [draft.metaTitle, draft.metaDescription].filter(Boolean).join("\n");
    case "excerpt":
      return draft.excerpt;
    case "faq":
      return JSON.stringify(draft.faq || []);
    case "contentHtml":
    default:
      return draft.contentHtml;
  }
}

function buildDraftPatchUpdate(patch: Partial<AiDraftData>) {
  return {
    ...(typeof patch.title === "string" ? { title: patch.title } : {}),
    ...(typeof patch.slug === "string" ? { slug: patch.slug } : {}),
    ...(typeof patch.excerpt === "string" ? { excerpt: patch.excerpt } : {}),
    ...(typeof patch.metaTitle === "string" ? { metaTitle: patch.metaTitle } : {}),
    ...(typeof patch.metaDescription === "string" ? { metaDescription: patch.metaDescription } : {}),
    ...(typeof patch.contentHtml === "string" ? { contentHtml: sanitizeGeneratedHtml(patch.contentHtml) } : {}),
    ...(Array.isArray(patch.faq) ? { faqJson: JSON.stringify(patch.faq) } : {}),
    ...(Array.isArray(patch.recommendations) ? { recommendationsJson: JSON.stringify(patch.recommendations) } : {}),
    ...(Array.isArray(patch.verificationNotes) ? { verificationNotesJson: JSON.stringify(patch.verificationNotes) } : {}),
    ...(Array.isArray(patch.verificationFlags) ? { verificationFlagsJson: JSON.stringify(patch.verificationFlags) } : {}),
    ...(Array.isArray(patch.engagementInsights) ? { engagementInsightsJson: JSON.stringify(patch.engagementInsights) } : {}),
    ...(Array.isArray(patch.internalLinkSuggestions)
      ? { internalLinkSuggestionsJson: JSON.stringify(patch.internalLinkSuggestions) }
      : {}),
    ...(typeof patch.researchUsed === "boolean" ? { researchUsed: patch.researchUsed } : {}),
  };
}

function mergeResearchSources(existingSources: AiResearchSource[], newSources: AiResearchSource[]) {
  return newSources.map((source) => {
    const existing =
      existingSources.find((item) => item.id === source.id) ||
      existingSources.find((item) => item.url && item.url === source.url) ||
      existingSources.find((item) => item.title.toLowerCase() === source.title.toLowerCase());

    return existing
      ? {
          ...source,
          approvalStatus: normalizeSourceApprovalStatus(existing.approvalStatus),
          adminNotes: coerceString(existing.adminNotes, MAX_SOURCE_ADMIN_NOTES_LENGTH),
        }
      : {
          ...source,
          approvalStatus: normalizeSourceApprovalStatus(source.approvalStatus),
          adminNotes: coerceString(source.adminNotes, MAX_SOURCE_ADMIN_NOTES_LENGTH),
        };
  });
}

function buildResearchRecordUpdate(research: AiResearchData) {
  return {
    provider: research.provider,
    status: research.status,
    topicSummary: research.topicSummary || null,
    searchIntent: research.searchIntent || null,
    keywordIdeasJson: JSON.stringify(research.keywordIdeas || []),
    relatedQuestionsJson: JSON.stringify(research.relatedQuestions || []),
    competitorNotesJson: JSON.stringify(research.competitorNotes || []),
    contentGapsJson: JSON.stringify(research.contentGaps || []),
    sourceNotesJson: JSON.stringify(research.sources || []),
    internalLinkOpportunitiesJson: JSON.stringify(research.internalLinkSuggestions || []),
    riskFlagsJson: JSON.stringify(research.riskFlags || []),
  };
}

function prepareResearchForGeneration(research: AiResearchData | null) {
  if (!research) return null;

  const approvedSources = research.sources.filter((source) => source.approvalStatus === "approved");
  const riskFlags = [...research.riskFlags];

  if (approvedSources.length === 0 && research.sources.length > 0 && !riskFlags.includes(SOURCELESS_RESEARCH_WARNING)) {
    riskFlags.push(SOURCELESS_RESEARCH_WARNING);
  }

  return {
    ...research,
    sources: approvedSources,
    riskFlags,
  };
}

function buildReferencesHtml(sources: AiResearchSource[]) {
  const approvedLinks = sources
    .filter((source) => source.approvalStatus === "approved")
    .map((source) => ({
      title: source.title,
      url: toSafeUrl(source.url),
    }))
    .filter((source) => source.title && source.url && source.url !== "#");

  if (approvedLinks.length === 0) {
    return "";
  }

  const items = approvedLinks
    .map(
      (source) =>
        `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a></li>`
    )
    .join("");

  return `<h2>References</h2><ul>${items}</ul>`;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

async function getInternalLinkSuggestions(prismaClient: AdminAiPrisma, topic: string, brief?: AiBriefData | null) {
  const posts = await prismaClient.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 12,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      category: { select: { name: true } },
      tags: { select: { name: true } },
    },
  });

  const queryTokens = new Set(
    uniqueStrings([
      ...tokenize(topic),
      ...tokenize(brief?.primaryKeyword || ""),
      ...tokenize((brief?.secondaryKeywords || []).join(" ")),
    ])
  );

  return posts
    .map((post: any) => {
      const haystack = [
        post.title,
        post.slug,
        post.excerpt || "",
        post.category?.name || "",
        ...(Array.isArray(post.tags) ? post.tags.map((tag: { name: string }) => tag.name) : []),
      ].join(" ");
      const tokens = new Set(tokenize(haystack));
      const overlap = [...queryTokens].filter((token) => tokens.has(token)).length;

      return {
        postId: post.id,
        title: post.title,
        slug: post.slug,
        anchorText: post.title.split(":")[0].slice(0, 120),
        reason:
          overlap > 0
            ? `Shares ${overlap} keyword overlap point${overlap === 1 ? "" : "s"} with the topic and can strengthen internal linking.`
            : "Published post with adjacent subject matter that can support readers who want a related angle.",
        score: overlap,
      };
    })
    .sort(
      (
        left: AiInternalLinkSuggestion & { score: number },
        right: AiInternalLinkSuggestion & { score: number }
      ) => right.score - left.score || left.title.localeCompare(right.title)
    )
    .slice(0, 5)
    .map(
      ({ score: _score, ...suggestion }: AiInternalLinkSuggestion & { score: number }) => suggestion
    );
}

async function getHistoricalEngagementContext(prismaClient: AdminAiPrisma) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const topPaths = await prismaClient.pageView
    .groupBy({
      by: ["path"],
      where: {
        createdAt: { gte: thirtyDaysAgo },
        path: { startsWith: "/blog/" },
      },
      _count: { path: true },
      orderBy: { _count: { path: "desc" } },
      take: 5,
    })
    .catch(() => []);

  if (!Array.isArray(topPaths) || topPaths.length === 0) {
    return {
      summary: "Not enough historical engagement data yet. Using best-practice scoring.",
      insights: ["Not enough historical engagement data yet. Using best-practice scoring."],
    };
  }

  const insights = topPaths.map((entry: { path: string; _count: { path: number } }) => {
    const slug = entry.path.replace(/^\/blog\//, "");
    const pattern = slug.includes("guide") ? "guide framing" : slug.includes("how-to") ? "how-to framing" : "descriptive framing";
    return `Post pattern "${pattern}" earned ${entry._count.path} page views in the last 30 days (${entry.path}).`;
  });

  return {
    summary: insights.join("\n"),
    insights,
  };
}

function aiUnavailableResponse(res: any, aiService: BlogStudioAiService) {
  res.status(503).json({
    error: aiService.getUnavailableReason() || "AI Blog Studio is not configured.",
  });
}

export function createAdminAiRouter({
  prismaClient = prisma as unknown as AdminAiPrisma,
  aiService = createBlogStudioAiService(),
  researchService = createResearchService(),
}: {
  prismaClient?: AdminAiPrisma;
  aiService?: BlogStudioAiService;
  researchService?: ResearchService;
} = {}) {
  const router = Router();
  const aiConfig = getAiProviderConfig();
  const aiRateLimit = createRateLimiter({
    keyPrefix: "admin-ai",
    maxRequests: aiConfig.rateLimitMax,
    windowMs: aiConfig.rateLimitWindowMs,
    message: "Too many AI requests. Please slow down and try again shortly.",
  });
  const researchMeta = {
    researchEnabled: researchService.isEnabled(),
    researchMessage: researchService.getUnavailableReason(),
  };

  router.use(authMiddleware);

  router.get("/conversations", async (req: AuthRequest, res) => {
    try {
      const conversations = await prismaClient.aiConversation.findMany({
        where: { userId: req.userId! },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          topic: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json(conversations);
    } catch (error) {
      logError("AI conversation list failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to load AI conversations" });
    }
  });

  router.post("/conversations", aiRateLimit, async (req: AuthRequest, res) => {
    const topic = trimmedString(req.body?.topic).slice(0, MAX_TOPIC_LENGTH);
    if (!topic) {
      res.status(400).json({ error: "Topic is required" });
      return;
    }

    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await prismaClient.aiConversation.create({
        data: {
          userId: req.userId!,
          topic,
          title: topic,
          status: "active",
        },
      });

      await appendConversationMessage(prismaClient, conversation.id, "user", topic, { type: "topic" });

      const assistantReply = await aiService.startConversation({
        topic,
        messages: [{ role: "user", content: topic }],
      });

      await appendConversationMessage(prismaClient, conversation.id, "assistant", assistantReply, {
        type: "clarification",
      });

      await touchConversation(prismaClient, conversation.id, "active");

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.status(201).json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI conversation creation failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to start AI conversation" });
    }
  });

  router.get("/conversations/:id", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      res.json(toConversationPayload(conversation, researchMeta));
    } catch (error) {
      logError("AI conversation lookup failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to load AI conversation" });
    }
  });

  router.post("/conversations/:id/message", aiRateLimit, async (req: AuthRequest, res) => {
    const message = trimmedString(req.body?.message).slice(0, MAX_MESSAGE_LENGTH);
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      await appendConversationMessage(prismaClient, conversation.id, "user", message);

      const assistantReply = await aiService.replyInConversation({
        topic: conversation.topic,
        messages: [...toMessageInputs(conversation.messages), { role: "user", content: message }],
        brief: toBriefPayload(conversation.brief),
      });

      await appendConversationMessage(prismaClient, conversation.id, "assistant", assistantReply, {
        type: "clarification",
      });
      await touchConversation(prismaClient, conversation.id, conversation.status || "active");

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI conversation message failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      await prismaClient.aiConversation.update({
        where: { id: param(req, "id") },
        data: { status: "failed" },
      }).catch(() => undefined);
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to send AI message" });
    }
  });

  router.post("/conversations/:id/brief", aiRateLimit, async (req: AuthRequest, res) => {
    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const brief = await aiService.generateBrief({
        topic: conversation.topic,
        messages: toMessageInputs(conversation.messages),
      });

      await prismaClient.aiContentBrief.upsert({
        where: { conversationId: conversation.id },
        update: {
          topic: brief.topic,
          audience: brief.audience || null,
          goal: brief.goal || null,
          tone: brief.tone || null,
          primaryKeyword: brief.primaryKeyword || null,
          secondaryKeywordsJson: JSON.stringify(brief.secondaryKeywords || []),
          wordCount: brief.wordCount,
          contentType: brief.contentType || null,
          cta: brief.cta || null,
          notes: brief.notes || null,
          approvedAt: null,
        },
        create: {
          conversationId: conversation.id,
          topic: brief.topic,
          audience: brief.audience || null,
          goal: brief.goal || null,
          tone: brief.tone || null,
          primaryKeyword: brief.primaryKeyword || null,
          secondaryKeywordsJson: JSON.stringify(brief.secondaryKeywords || []),
          wordCount: brief.wordCount,
          contentType: brief.contentType || null,
          cta: brief.cta || null,
          notes: brief.notes || null,
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        "I generated a structured content brief. Review it, make any edits you want, and approve it before drafting.",
        { type: "brief-generated" }
      );
      await touchConversation(prismaClient, conversation.id, "brief_ready");

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI brief generation failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      await prismaClient.aiConversation.update({
        where: { id: param(req, "id") },
        data: { status: "failed" },
      }).catch(() => undefined);
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to generate AI brief" });
    }
  });

  router.put("/conversations/:id/brief", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const briefPayload = buildBriefFromRequest(req.body as Record<string, unknown>, conversation.topic);

      await prismaClient.aiContentBrief.upsert({
        where: { conversationId: conversation.id },
        update: {
          topic: briefPayload.topic,
          audience: briefPayload.audience || null,
          goal: briefPayload.goal || null,
          tone: briefPayload.tone || null,
          primaryKeyword: briefPayload.primaryKeyword || null,
          secondaryKeywordsJson: JSON.stringify(briefPayload.secondaryKeywords || []),
          wordCount: briefPayload.wordCount,
          contentType: briefPayload.contentType || null,
          cta: briefPayload.cta || null,
          notes: briefPayload.notes || null,
          approvedAt: briefPayload.approvedAt ? new Date(briefPayload.approvedAt) : null,
        },
        create: {
          conversationId: conversation.id,
          topic: briefPayload.topic,
          audience: briefPayload.audience || null,
          goal: briefPayload.goal || null,
          tone: briefPayload.tone || null,
          primaryKeyword: briefPayload.primaryKeyword || null,
          secondaryKeywordsJson: JSON.stringify(briefPayload.secondaryKeywords || []),
          wordCount: briefPayload.wordCount,
          contentType: briefPayload.contentType || null,
          cta: briefPayload.cta || null,
          notes: briefPayload.notes || null,
          approvedAt: briefPayload.approvedAt ? new Date(briefPayload.approvedAt) : null,
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        briefPayload.approvedAt
          ? "The brief is approved and ready for draft generation."
          : "The brief has been updated. Review it further or approve it when ready.",
        { type: "brief-updated" }
      );
      await touchConversation(prismaClient, conversation.id, "brief_ready");

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI brief update failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to update AI brief" });
    }
  });

  router.post("/conversations/:id/research", aiRateLimit, async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      const existingResearch = toResearchPayload(conversation.research);
      const internalLinkSuggestions = await getInternalLinkSuggestions(prismaClient, brief?.primaryKeyword || conversation.topic, brief);
      const research = await researchService.runResearch({
        topic: conversation.topic,
        brief,
        messages: toMessageInputs(conversation.messages),
        internalLinkSuggestions,
      });

      const mergedResearch: AiResearchData = {
        ...research,
        sources: mergeResearchSources(existingResearch?.sources || [], research.sources),
        internalLinkSuggestions:
          research.internalLinkSuggestions && research.internalLinkSuggestions.length > 0
            ? research.internalLinkSuggestions
            : internalLinkSuggestions,
      };

      await prismaClient.aiResearchRun.upsert({
        where: { conversationId: conversation.id },
        update: buildResearchRecordUpdate(mergedResearch),
        create: {
          conversationId: conversation.id,
          ...buildResearchRecordUpdate(mergedResearch),
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        mergedResearch.status === "disabled"
          ? "Live research is disabled right now. You can still generate the brief and draft using best-practice guidance."
          : "Research is ready. Review the sources, approve the ones you trust, and then generate the draft.",
        { type: "research", provider: mergedResearch.provider, status: mergedResearch.status }
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI research failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      await prismaClient.aiResearchRun
        .upsert({
          where: { conversationId: param(req, "id") },
          update: {
            provider: researchService.providerName,
            status: "failed",
            topicSummary: null,
            searchIntent: null,
            keywordIdeasJson: JSON.stringify([]),
            relatedQuestionsJson: JSON.stringify([]),
            competitorNotesJson: JSON.stringify([]),
            contentGapsJson: JSON.stringify([]),
            sourceNotesJson: JSON.stringify([]),
            internalLinkOpportunitiesJson: JSON.stringify([]),
            riskFlagsJson: JSON.stringify([error instanceof Error ? error.message : "Research request failed."]),
          },
          create: {
            conversationId: param(req, "id"),
            provider: researchService.providerName,
            status: "failed",
            keywordIdeasJson: JSON.stringify([]),
            relatedQuestionsJson: JSON.stringify([]),
            competitorNotesJson: JSON.stringify([]),
            contentGapsJson: JSON.stringify([]),
            sourceNotesJson: JSON.stringify([]),
            internalLinkOpportunitiesJson: JSON.stringify([]),
            riskFlagsJson: JSON.stringify([error instanceof Error ? error.message : "Research request failed."]),
          },
        })
        .catch(() => undefined);
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to run topic research" });
    }
  });

  router.put("/conversations/:id/research", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const research = toResearchPayload(conversation.research);
      if (!research) {
        res.status(400).json({ error: "Run research before reviewing sources." });
        return;
      }

      const sourceUpdates = Array.isArray(req.body?.sources) ? req.body.sources : [];
      if (sourceUpdates.length === 0) {
        res.status(400).json({ error: "At least one source update is required." });
        return;
      }

      const nextSources = research.sources.map((source) => {
        const update = sourceUpdates.find((entry: any) => entry && typeof entry === "object" && entry.id === source.id);
        if (!update) {
          return source;
        }

        return {
          ...source,
          approvalStatus: normalizeSourceApprovalStatus(update.approvalStatus),
          adminNotes: coerceString(update.adminNotes, MAX_SOURCE_ADMIN_NOTES_LENGTH),
        };
      });

      await prismaClient.aiResearchRun.update({
        where: { conversationId: conversation.id },
        data: {
          sourceNotesJson: JSON.stringify(nextSources),
        },
      });

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI research review update failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to update source approvals" });
    }
  });

  router.post("/conversations/:id/draft", aiRateLimit, async (req: AuthRequest, res) => {
    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      if (!brief) {
        res.status(400).json({ error: "Generate and approve a brief before drafting." });
        return;
      }

      const storedResearch = toResearchPayload(conversation.research);
      const research = prepareResearchForGeneration(storedResearch);
      const historicalContext = await getHistoricalEngagementContext(prismaClient);

      const draft = await aiService.generateDraft({
        topic: conversation.topic,
        brief,
        messages: toMessageInputs(conversation.messages),
        historicalContext: historicalContext.summary,
        research,
      });

      const internalLinkSuggestions =
        draft.internalLinkSuggestions && draft.internalLinkSuggestions.length > 0
          ? draft.internalLinkSuggestions
          : research?.internalLinkSuggestions || [];
      const verificationNotes = uniqueStrings([
        ...(draft.verificationNotes || []),
        ...(research?.sources.length === 0 && storedResearch?.sources.length ? [SOURCELESS_RESEARCH_WARNING] : []),
      ]);

      await prismaClient.aiDraftOutput.upsert({
        where: { conversationId: conversation.id },
        update: {
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt || null,
          metaTitle: draft.metaTitle || null,
          metaDescription: draft.metaDescription || null,
          contentHtml: sanitizeGeneratedHtml(draft.contentHtml),
          categorySuggestion: draft.categorySuggestion || null,
          tagsJson: JSON.stringify(draft.tagSuggestions || []),
          outlineJson: JSON.stringify(draft.outline || []),
          faqJson: JSON.stringify(draft.faq || []),
          ogImagePrompt: draft.ogImagePrompt || null,
          seoScore: draft.seoScore,
          engagementScore: draft.engagementScore,
          readabilityScore: draft.readabilityScore,
          recommendationsJson: JSON.stringify(draft.recommendations || []),
          verificationNotesJson: JSON.stringify(verificationNotes),
          verificationFlagsJson: JSON.stringify(draft.verificationFlags || []),
          engagementInsightsJson: JSON.stringify(
            draft.engagementInsights && draft.engagementInsights.length > 0
              ? draft.engagementInsights
              : historicalContext.insights
          ),
          internalLinkSuggestionsJson: JSON.stringify(internalLinkSuggestions),
          researchUsed: Boolean(draft.researchUsed || (research && research.sources.length > 0 && research.status === "completed")),
          status: "generated",
        },
        create: {
          conversationId: conversation.id,
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt || null,
          metaTitle: draft.metaTitle || null,
          metaDescription: draft.metaDescription || null,
          contentHtml: sanitizeGeneratedHtml(draft.contentHtml),
          categorySuggestion: draft.categorySuggestion || null,
          tagsJson: JSON.stringify(draft.tagSuggestions || []),
          outlineJson: JSON.stringify(draft.outline || []),
          faqJson: JSON.stringify(draft.faq || []),
          ogImagePrompt: draft.ogImagePrompt || null,
          seoScore: draft.seoScore,
          engagementScore: draft.engagementScore,
          readabilityScore: draft.readabilityScore,
          recommendationsJson: JSON.stringify(draft.recommendations || []),
          verificationNotesJson: JSON.stringify(verificationNotes),
          verificationFlagsJson: JSON.stringify(draft.verificationFlags || []),
          engagementInsightsJson: JSON.stringify(
            draft.engagementInsights && draft.engagementInsights.length > 0
              ? draft.engagementInsights
              : historicalContext.insights
          ),
          internalLinkSuggestionsJson: JSON.stringify(internalLinkSuggestions),
          researchUsed: Boolean(draft.researchUsed || (research && research.sources.length > 0 && research.status === "completed")),
          status: "generated",
        },
      });

      await prismaClient.aiRewriteProposal
        .updateMany({
          where: {
            conversationId: conversation.id,
            status: "proposed",
          },
          data: { status: "rejected" },
        })
        .catch(() => undefined);

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        "The draft is ready. Review the brief, verification flags, internal linking suggestions, and HTML preview before saving it as a CMS draft.",
        { type: "draft-generated" }
      );
      await touchConversation(prismaClient, conversation.id, "draft_ready", draft.title);

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI draft generation failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      await prismaClient.aiConversation.update({
        where: { id: param(req, "id") },
        data: { status: "failed" },
      }).catch(() => undefined);
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to generate AI draft" });
    }
  });

  router.post("/conversations/:id/analyze", aiRateLimit, async (req: AuthRequest, res) => {
    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      const draft = toDraftPayload(conversation.draft);
      if (!brief || !draft) {
        res.status(400).json({ error: "Generate a draft before analyzing it." });
        return;
      }

      const research = prepareResearchForGeneration(toResearchPayload(conversation.research));
      const historicalContext = await getHistoricalEngagementContext(prismaClient);

      const analysis = await aiService.analyzeDraft({
        topic: conversation.topic,
        brief,
        draft,
        historicalContext: historicalContext.summary,
        research,
      });

      await prismaClient.aiDraftOutput.update({
        where: { conversationId: conversation.id },
        data: {
          seoScore: analysis.seoScore,
          engagementScore: analysis.engagementScore,
          readabilityScore: analysis.readabilityScore,
          recommendationsJson: JSON.stringify(analysis.recommendations || []),
          verificationNotesJson: JSON.stringify(analysis.verificationNotes || draft.verificationNotes || []),
          verificationFlagsJson: JSON.stringify(analysis.verificationFlags || draft.verificationFlags || []),
          engagementInsightsJson: JSON.stringify(
            analysis.engagementInsights && analysis.engagementInsights.length > 0
              ? analysis.engagementInsights
              : historicalContext.insights
          ),
          internalLinkSuggestionsJson: JSON.stringify(
            analysis.internalLinkSuggestions && analysis.internalLinkSuggestions.length > 0
              ? analysis.internalLinkSuggestions
              : draft.internalLinkSuggestions || []
          ),
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        "I refreshed the draft analysis with updated SEO, engagement, readability, and verification guidance.",
        { type: "draft-analyzed" }
      );
      await touchConversation(prismaClient, conversation.id, "draft_ready");

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      logError("AI draft analysis failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to analyze AI draft" });
    }
  });

  router.post("/conversations/:id/rewrite", aiRateLimit, async (req: AuthRequest, res) => {
    const action = parseRewriteAction(req.body?.action);
    if (!action) {
      res.status(400).json({ error: "A valid rewrite action is required." });
      return;
    }

    if (!aiService.isAvailable()) {
      aiUnavailableResponse(res, aiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const draft = toDraftPayload(conversation.draft);
      if (!draft || !conversation.draft?.id) {
        res.status(400).json({ error: "Generate a draft before requesting rewrites." });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      const research = prepareResearchForGeneration(toResearchPayload(conversation.research));
      const historicalContext = await getHistoricalEngagementContext(prismaClient);
      const proposal = await aiService.rewriteDraft({
        topic: conversation.topic,
        brief,
        draft,
        action,
        selectedText: coerceString(req.body?.selectedText, 5000) || null,
        historicalContext: historicalContext.summary,
        research,
      });

      const targetText = getProposalTargetText(draft, proposal.target);
      const created = await prismaClient.aiRewriteProposal.create({
        data: {
          conversationId: conversation.id,
          draftOutputId: conversation.draft.id,
          action,
          label: proposal.label,
          summary: proposal.summary,
          targetSection: proposal.target,
          originalText: targetText,
          proposedText: proposal.preview.slice(0, MAX_REWRITE_PREVIEW_LENGTH),
          draftPatchJson: JSON.stringify(proposal.draftPatch || {}),
          status: "proposed",
        },
      });

      res.json({
        proposal: toRewriteProposalPayload(created),
      });
    } catch (error) {
      logError("AI rewrite failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        action,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to generate rewrite proposal" });
    }
  });

  router.post("/conversations/:id/rewrite/:proposalId/apply", aiRateLimit, async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const draft = toDraftPayload(conversation.draft);
      if (!draft || !conversation.draft?.id) {
        res.status(400).json({ error: "Generate a draft before applying rewrites." });
        return;
      }

      const proposalRow = await prismaClient.aiRewriteProposal.findFirst({
        where: {
          id: param(req, "proposalId"),
          conversationId: conversation.id,
          draftOutputId: conversation.draft.id,
        },
      });

      if (!proposalRow) {
        res.status(404).json({ error: "Rewrite proposal not found." });
        return;
      }

      if (proposalRow.status !== "proposed") {
        res.status(409).json({ error: "This rewrite proposal can no longer be applied." });
        return;
      }

      const proposal = toRewriteProposalPayload(proposalRow);
      const currentTargetText = getProposalTargetText(draft, proposal.target);
      if (currentTargetText !== proposalRow.originalText) {
        res.status(409).json({ error: "The draft changed after this proposal was created. Generate a fresh rewrite first." });
        return;
      }

      await prismaClient.aiDraftOutput.update({
        where: { conversationId: conversation.id },
        data: buildDraftPatchUpdate(proposal.draftPatch),
      });
      await prismaClient.aiRewriteProposal.update({
        where: { id: proposalRow.id },
        data: { status: "applied" },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        `Applied the rewrite action "${proposal.action.replace(/_/g, " ")}" to the draft.`,
        { type: "rewrite-applied", action: proposal.action, proposalId: proposalRow.id }
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json({
        detail: toConversationPayload(detail, researchMeta),
        proposal: { ...proposal, status: "applied" },
      });
    } catch (error) {
      logError("AI rewrite apply failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        proposalId: param(req, "proposalId"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to apply rewrite proposal" });
    }
  });

  router.post("/conversations/:id/rewrite/:proposalId/reject", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const proposalRow = await prismaClient.aiRewriteProposal.findFirst({
        where: {
          id: param(req, "proposalId"),
          conversationId: conversation.id,
        },
      });

      if (!proposalRow) {
        res.status(404).json({ error: "Rewrite proposal not found." });
        return;
      }

      await prismaClient.aiRewriteProposal.update({
        where: { id: proposalRow.id },
        data: { status: "rejected" },
      });

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json({
        detail: toConversationPayload(detail, researchMeta),
        proposal: { ...toRewriteProposalPayload(proposalRow), status: "rejected" },
      });
    } catch (error) {
      logError("AI rewrite rejection failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        proposalId: param(req, "proposalId"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to reject rewrite proposal" });
    }
  });

  router.post("/conversations/:id/save-draft", aiRateLimit, async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const draft = toDraftPayload(conversation.draft);
      if (!draft) {
        res.status(400).json({ error: "Generate a draft before saving it." });
        return;
      }

      if (draft.postId) {
        res.status(200).json({
          postId: draft.postId,
          editUrl: `/admin/posts/${draft.postId}/edit`,
        });
        return;
      }

      const includeReferences = coerceBoolean(req.body?.includeReferences);
      const uniqueSlug = await createUniquePostSlug(prismaClient, draft.slug, draft.title);
      const categoryId = await resolveCategoryId(prismaClient, draft.categorySuggestion);
      const tagIds = await resolveTagIds(prismaClient, draft.tagSuggestions || []);
      const research = toResearchPayload(conversation.research);
      const referencesHtml = includeReferences ? buildReferencesHtml(research?.sources || []) : "";
      const contentHtml = sanitizeGeneratedHtml(`${draft.contentHtml}${referencesHtml}`);
      const excerpt = draft.excerpt || stripHtml(contentHtml).slice(0, 220);

      const post = await prismaClient.post.create({
        data: {
          title: draft.title,
          slug: uniqueSlug,
          excerpt: excerpt || null,
          body: contentHtml,
          categoryId,
          featuredImage: null,
          status: "DRAFT",
          publishedAt: null,
          readingTime: computeReadingTime(contentHtml),
          metaTitle: draft.metaTitle || null,
          metaDescription: draft.metaDescription || null,
          ogImage: null,
          authorId: req.userId!,
          tags: tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : undefined,
        },
        select: { id: true, slug: true },
      });

      await prismaClient.aiDraftOutput.update({
        where: { conversationId: conversation.id },
        data: {
          postId: post.id,
          slug: uniqueSlug,
          status: "saved",
          contentHtml,
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        "Saved as a CMS draft. Open the existing editor to review, fact-check, and publish manually when ready.",
        { type: "saved-draft", postId: post.id }
      );
      await touchConversation(prismaClient, conversation.id, "saved", draft.title);

      logInfo("AI draft saved as CMS draft", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: conversation.id,
        postId: post.id,
      });

      res.status(201).json({
        postId: post.id,
        editUrl: `/admin/posts/${post.id}/edit`,
      });
    } catch (error) {
      logError("AI save draft failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      if (isPrismaErrorCode(error, "P2002")) {
        res.status(409).json({ error: "A draft with this slug already exists." });
        return;
      }
      res.status(500).json({ error: "Failed to save AI draft into the CMS" });
    }
  });

  return router;
}

export default createAdminAiRouter();
