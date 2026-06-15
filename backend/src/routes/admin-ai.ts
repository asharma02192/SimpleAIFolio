import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, type AuthRequest, requireRoleWithClient } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { getRequestLogMeta, logError, logInfo } from "../utils/logging";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import {
  computeReadingTime,
  type AiTelemetryEvent,
  createBlogStudioAiService,
  slugify,
  stripHtml,
  type AiBriefData,
  type AiConversationMessageInput,
  type AiDraftData,
  type AiInternalLinkSuggestion,
  type AiQualityScore,
  type AiResearchApprovalStatus,
  type AiResearchData,
  type AiResearchSource,
  type AiRewriteAction,
  type AiRewriteProposal,
  type AiWritingProfile,
  type BlogStudioAiService,
} from "../services/ai/blog-studio";
import { getAiProviderConfig, getDbOverrides, type AiProviderConfig } from "../services/ai/provider";
import { sanitizeGeneratedHtml, toSafeUrl } from "../services/ai/html";
import { notifyAiOpsForUsageEvent } from "../services/ops-alerts";
import {
  createResearchServiceWithOptions,
  type ResearchService,
  type ResearchTelemetryEvent,
} from "../services/ai/research";

type AdminAiPrisma = {
  aiConversation: any;
  aiMessage: any;
  aiContentBrief: any;
  aiDraftOutput: any;
  aiResearchRun: any;
  aiRewriteProposal: any;
  aiUsageEvent: any;
  post: any;
  category: any;
  tag: any;
  pageView: any;
  siteSetting?: any;
  user: any;
};

const MAX_TOPIC_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_NOTES_LENGTH = 5000;
const MAX_REWRITE_PREVIEW_LENGTH = 16_000;
const MAX_SOURCE_ADMIN_NOTES_LENGTH = 500;
const MAX_VERIFICATION_REVIEW_NOTES = 240;
const WRITING_PROFILE_KEY = "internal_ai_writer_profile";
const SOURCELESS_RESEARCH_WARNING =
  "Research is available, but no sources have been approved yet. The draft will use research notes only as directional guidance.";
const DEFAULT_CONVERSATION_PAGE_SIZE = 25;
const MAX_CONVERSATION_PAGE_SIZE = 100;

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
  "add_personal_experience",
  "make_more_opinionated",
  "add_code_examples",
  "add_real_workflow",
  "reduce_generic_ai_tone",
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

function getEmptyWritingProfile(): AiWritingProfile {
  return {
    authorCredibility: "",
    reusableStories: [],
    strongOpinions: [],
    voiceRules: [],
    proofRequirements: [],
  };
}

function parseWritingProfile(value: string | null | undefined): AiWritingProfile {
  if (!value) return getEmptyWritingProfile();
  try {
    const parsed = JSON.parse(value) as Partial<AiWritingProfile>;
    return {
      authorCredibility: typeof parsed.authorCredibility === "string" ? parsed.authorCredibility : "",
      reusableStories: Array.isArray(parsed.reusableStories) ? parsed.reusableStories.filter((s): s is string => typeof s === "string") : [],
      strongOpinions: Array.isArray(parsed.strongOpinions) ? parsed.strongOpinions.filter((s): s is string => typeof s === "string") : [],
      voiceRules: Array.isArray(parsed.voiceRules) ? parsed.voiceRules.filter((s): s is string => typeof s === "string") : [],
      proofRequirements: Array.isArray(parsed.proofRequirements) ? parsed.proofRequirements.filter((s): s is string => typeof s === "string") : [],
    };
  } catch {
    return getEmptyWritingProfile();
  }
}

function isProfileEmpty(profile: AiWritingProfile): boolean {
  return !profile.authorCredibility && profile.reusableStories.length === 0 && profile.strongOpinions.length === 0 && profile.voiceRules.length === 0 && profile.proofRequirements.length === 0;
}

async function loadWritingProfile(prismaClient: AdminAiPrisma): Promise<AiWritingProfile> {
  try {
    const row = await prismaClient.siteSetting?.findUnique({ where: { key: WRITING_PROFILE_KEY } });
    return parseWritingProfile(row?.value);
  } catch {
    return getEmptyWritingProfile();
  }
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

function normalizeVerificationReviewStatus(value: unknown) {
  switch (value) {
    case "accepted":
    case "soften":
    case "remove":
      return value;
    case "pending":
    default:
      return "pending";
  }
}

function decodeBriefNotes(rawNotes: string | null | undefined): { notes: string; expertAngle: string; personalProofNeeded: string; stance: string; exampleRequirements: string; contentFormat: string } {
  const fallback = { notes: rawNotes || "", expertAngle: "", personalProofNeeded: "", stance: "", exampleRequirements: "", contentFormat: "" };
  if (!rawNotes) return fallback;
  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === "object" && typeof parsed.notes === "string") {
      return {
        notes: parsed.notes,
        expertAngle: typeof parsed.expertAngle === "string" ? parsed.expertAngle : "",
        personalProofNeeded: typeof parsed.personalProofNeeded === "string" ? parsed.personalProofNeeded : "",
        stance: typeof parsed.stance === "string" ? parsed.stance : "",
        exampleRequirements: typeof parsed.exampleRequirements === "string" ? parsed.exampleRequirements : "",
        contentFormat: typeof parsed.contentFormat === "string" ? parsed.contentFormat : "",
      };
    }
  } catch {
    // not JSON — plain text notes
  }
  return fallback;
}

function encodeBriefNotes(data: { notes: string; expertAngle?: string; personalProofNeeded?: string; stance?: string; exampleRequirements?: string; contentFormat?: string }): string {
  const hasExpert = data.expertAngle || data.personalProofNeeded || data.stance || data.exampleRequirements || data.contentFormat;
  if (!hasExpert) return data.notes;
  return JSON.stringify({
    notes: data.notes,
    expertAngle: data.expertAngle || "",
    personalProofNeeded: data.personalProofNeeded || "",
    stance: data.stance || "",
    exampleRequirements: data.exampleRequirements || "",
    contentFormat: data.contentFormat || "",
  });
}

function toBriefPayload(row: any): AiBriefData | null {
  if (!row) return null;

  const decoded = decodeBriefNotes(row.notes);

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
    notes: decoded.notes,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
    expertAngle: decoded.expertAngle,
    personalProofNeeded: decoded.personalProofNeeded,
    stance: decoded.stance,
    exampleRequirements: decoded.exampleRequirements,
    contentFormat: decoded.contentFormat,
  };
}

const QUALITY_SCORE_PREFIX = "__QUALITY_SCORE__";

function encodeQualityScoreIntoNotes(notes: string[], qualityScore: AiQualityScore | null): string[] {
  const filtered = notes.filter((n) => !n.startsWith(QUALITY_SCORE_PREFIX));
  if (!qualityScore) return filtered;
  return [`${QUALITY_SCORE_PREFIX}${JSON.stringify(qualityScore)}`, ...filtered];
}

function decodeQualityScoreFromNotes(notes: string[]): { notes: string[]; qualityScore: AiQualityScore | null } {
  const qualityRow = notes.find((n) => n.startsWith(QUALITY_SCORE_PREFIX));
  if (!qualityRow) return { notes, qualityScore: null };
  try {
    const parsed = JSON.parse(qualityRow.slice(QUALITY_SCORE_PREFIX.length)) as AiQualityScore;
    return {
      notes: notes.filter((n) => !n.startsWith(QUALITY_SCORE_PREFIX)),
      qualityScore: {
        accuracy: Number(parsed.accuracy) || 5,
        depth: Number(parsed.depth) || 5,
        originality: Number(parsed.originality) || 5,
        voice: Number(parsed.voice) || 5,
        proof: Number(parsed.proof) || 5,
        seo: Number(parsed.seo) || 5,
        overall: Number(parsed.overall) || 5,
        checklist: Array.isArray(parsed.checklist) ? parsed.checklist.filter((c): c is string => typeof c === "string") : [],
      },
    };
  } catch {
    return { notes, qualityScore: null };
  }
}

function toDraftPayload(row: any): AiDraftData | null {
  if (!row) return null;

  const rawVerificationNotes = safeJsonParse<string[]>(row.verificationNotesJson, []);
  const { notes: verificationNotes, qualityScore } = decodeQualityScoreFromNotes(rawVerificationNotes);

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
    verificationNotes,
    verificationFlags: safeJsonParse(row.verificationFlagsJson, []).map((flag: any) => ({
      ...flag,
      reviewStatus: normalizeVerificationReviewStatus(flag?.reviewStatus),
      reviewNotes: typeof flag?.reviewNotes === "string" ? flag.reviewNotes : "",
    })),
    engagementInsights: safeJsonParse<string[]>(row.engagementInsightsJson, []),
    internalLinkSuggestions: safeJsonParse(row.internalLinkSuggestionsJson, []),
    researchUsed: Boolean(row.researchUsed),
    referencesEnabled: Boolean(row.referencesEnabled),
    postId: row.postId || null,
    status: row.status,
    qualityScore,
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
      includeInReferences: source.includeInReferences !== false,
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
  const usageEvents = Array.isArray(conversation.usageEvents)
    ? conversation.usageEvents.map((event: any) => ({
        id: event.id,
        operation: event.operation,
        provider: event.provider,
        model: event.model || null,
        latencyMs: event.latencyMs ?? null,
        promptTokens: event.promptTokens ?? null,
        completionTokens: event.completionTokens ?? null,
        totalTokens: event.totalTokens ?? null,
        estimatedCostUsd: event.estimatedCostUsd ?? null,
        success: Boolean(event.success),
        errorMessage: event.errorMessage || null,
        metadata: safeJsonParse<Record<string, unknown> | null>(event.metadataJson, null),
        createdAt: event.createdAt,
      }))
    : [];

  let totalLatency = 0;
  const usageSummary = {
    totalCalls: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    failures: 0,
    avgLatencyMs: 0,
  };

  for (const event of usageEvents as Array<{
    latencyMs: number | null;
    totalTokens: number | null;
    estimatedCostUsd: number | null;
    success: boolean;
  }>) {
    totalLatency += event.latencyMs || 0;
    usageSummary.totalCalls += 1;
    usageSummary.totalTokens += event.totalTokens || 0;
    usageSummary.estimatedCostUsd = Number(
      (usageSummary.estimatedCostUsd + (event.estimatedCostUsd || 0)).toFixed(6)
    );
    usageSummary.failures += event.success ? 0 : 1;
  }

  usageSummary.avgLatencyMs =
    usageSummary.totalCalls > 0 ? Math.round(totalLatency / usageSummary.totalCalls) : 0;

  return {
    id: conversation.id,
    title: conversation.title,
    topic: conversation.topic,
    status: conversation.status,
    archivedAt: conversation.archivedAt || null,
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
    usageEvents,
    usageSummary,
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
      usageEvents: {
        orderBy: { createdAt: "desc" },
        take: 10,
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

async function recordUsageEvent(
  prismaClient: AdminAiPrisma,
  conversationId: string | null,
  event: AiTelemetryEvent | ResearchTelemetryEvent,
  extra?: Record<string, unknown>,
  success = true,
  errorMessage?: string | null
) {
  const created = await prismaClient.aiUsageEvent.create({
    data: {
      conversationId,
      operation: event.operation,
      provider: event.result.provider,
      model: event.result.model,
      latencyMs: event.result.latencyMs,
      promptTokens: event.result.usage?.promptTokens ?? null,
      completionTokens: event.result.usage?.completionTokens ?? null,
      totalTokens: event.result.usage?.totalTokens ?? null,
      estimatedCostUsd: event.result.usage?.estimatedCostUsd ?? null,
      success,
      errorMessage: errorMessage || null,
      metadataJson: JSON.stringify({
        attempt: event.attempt,
        finishReason: event.result.rawFinishReason || null,
        ...(extra || {}),
      }),
    },
  }).catch(() => undefined);

  if (created) {
    void notifyAiOpsForUsageEvent({
      prismaClient,
      event: created,
    });
  }
}

async function recordFailedOperation(
  prismaClient: AdminAiPrisma,
  conversationId: string | null,
  provider: string,
  operation: string,
  errorMessage: string
) {
  const created = await prismaClient.aiUsageEvent.create({
    data: {
      conversationId,
      operation,
      provider,
      success: false,
      errorMessage,
      metadataJson: JSON.stringify({ failed: true }),
    },
  }).catch(() => undefined);

  if (created) {
    void notifyAiOpsForUsageEvent({
      prismaClient,
      event: created,
    });
  }
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
  const resolvedIdSet = new Set<string>();

  for (const suggestion of suggestions) {
    const normalized = suggestion.trim();
    if (!normalized) continue;

    const normalizedSlug = slugify(normalized);
    if (!normalizedSlug) continue;

    const existing = existingTags.find((tag: { name: string; slug: string }) =>
      tag.slug.toLowerCase() === normalizedSlug || tag.name.toLowerCase() === normalized.toLowerCase()
    );

    if (existing) {
      if (!resolvedIdSet.has(existing.id)) {
        resolvedIds.push(existing.id);
        resolvedIdSet.add(existing.id);
      }
      continue;
    }

    try {
      const created = await prismaClient.tag.create({
        data: {
          name: normalized,
          slug: normalizedSlug,
        },
        select: { id: true },
      });

      resolvedIds.push(created.id);
      resolvedIdSet.add(created.id);
      existingTags.push({ id: created.id, name: normalized, slug: normalizedSlug });
    } catch (createError) {
      if (isPrismaErrorCode(createError, "P2002")) {
        const recovered = await prismaClient.tag.findFirst({
          where: {
            OR: [
              { slug: normalizedSlug },
              { name: normalized },
            ],
          },
          select: { id: true },
        });
        if (recovered && !resolvedIdSet.has(recovered.id)) {
          resolvedIds.push(recovered.id);
          resolvedIdSet.add(recovered.id);
        }
      } else {
        throw createError;
      }
    }
  }

  return resolvedIds;
}

function buildBriefFromRequest(
  body: Record<string, unknown>,
  fallbackTopic: string,
  existing?: AiBriefData | null,
): AiBriefData {
  const has = (key: string) => body[key] !== undefined;
  return {
    topic: has("topic") ? (coerceString(body.topic, MAX_TOPIC_LENGTH) || fallbackTopic) : (existing?.topic || fallbackTopic),
    audience: has("audience") ? coerceString(body.audience, 300) : (existing?.audience || ""),
    goal: has("goal") ? coerceString(body.goal, 300) : (existing?.goal || ""),
    tone: has("tone") ? coerceString(body.tone, 120) : (existing?.tone || ""),
    primaryKeyword: has("primaryKeyword") ? coerceString(body.primaryKeyword, 160) : (existing?.primaryKeyword || ""),
    secondaryKeywords: has("secondaryKeywords")
      ? coerceStringArray(body.secondaryKeywords, 12, 120)
      : (existing?.secondaryKeywords || []),
    wordCount: has("wordCount")
      ? (Number.isFinite(Number(body.wordCount)) ? Math.max(300, Math.min(5000, Math.round(Number(body.wordCount)))) : null)
      : (existing?.wordCount ?? null),
    contentType: has("contentType") ? coerceString(body.contentType, 120) : (existing?.contentType || ""),
    cta: has("cta") ? coerceString(body.cta, 300) : (existing?.cta || ""),
    notes: has("notes") ? coerceString(body.notes, MAX_NOTES_LENGTH) : (existing?.notes || ""),
    approvedAt: body.approved === true ? new Date().toISOString() : (existing?.approvedAt || null),
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

function buildFaqHtml(faq: Array<{ question: string; answer: string }>) {
  if (!faq.length) return "";
  const items = faq
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.question)}</strong><p>${escapeHtml(item.answer)}</p></li>`
    )
    .join("");
  return `<section><h2>Frequently Asked Questions</h2><ul>${items}</ul></section>`;
}

async function validateInternalLinkSuggestions(
  prismaClient: AdminAiPrisma,
  aiSuggestions: AiInternalLinkSuggestion[],
  topic: string,
  brief?: AiBriefData | null,
): Promise<{ links: AiInternalLinkSuggestion[]; topicGaps: string[] }> {
  const realSuggestions = await getInternalLinkSuggestions(prismaClient, topic, brief);
  const realPostIds = new Set(realSuggestions.map((s: AiInternalLinkSuggestion & { score: number }) => s.postId));

  const validated = aiSuggestions.filter((s: AiInternalLinkSuggestion) => realPostIds.has(s.postId));

  const usedSlugs = new Set(realSuggestions.map((s: AiInternalLinkSuggestion & { score: number }) => s.slug));
  const gaps = aiSuggestions
    .filter((s: AiInternalLinkSuggestion) => !realPostIds.has(s.postId) && !usedSlugs.has(s.slug))
    .map((s: AiInternalLinkSuggestion) => s.title)
    .filter((title) => title.length > 5)
    .slice(0, 3);

  const merged = [...validated];
  for (const real of realSuggestions) {
    if (!merged.some((s) => s.postId === real.postId)) {
      merged.push(real);
    }
  }

  return {
    links: merged.slice(0, 5),
    topicGaps: gaps,
  };
}

function applyAllInternalLinks(contentHtml: string, suggestions: AiInternalLinkSuggestion[]) {
  let html = contentHtml;
  for (const suggestion of suggestions) {
    html = applyInternalLinkSuggestionToHtml(html, suggestion);
  }
  return html;
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
    ...(typeof patch.ogImagePrompt === "string" ? { ogImagePrompt: patch.ogImagePrompt } : {}),
    ...(typeof patch.categorySuggestion === "string" ? { categorySuggestion: patch.categorySuggestion } : {}),
    ...(Array.isArray(patch.tagSuggestions) ? { tagsJson: JSON.stringify(patch.tagSuggestions) } : {}),
    ...(Array.isArray(patch.outline) ? { outlineJson: JSON.stringify(patch.outline) } : {}),
    ...(typeof patch.seoScore === "number" ? { seoScore: patch.seoScore } : {}),
    ...(typeof patch.engagementScore === "number" ? { engagementScore: patch.engagementScore } : {}),
    ...(typeof patch.readabilityScore === "number" ? { readabilityScore: patch.readabilityScore } : {}),
    ...(Array.isArray(patch.recommendations) ? { recommendationsJson: JSON.stringify(patch.recommendations) } : {}),
    ...(Array.isArray(patch.verificationNotes) ? { verificationNotesJson: JSON.stringify(patch.verificationNotes) } : {}),
    ...(Array.isArray(patch.verificationFlags) ? { verificationFlagsJson: JSON.stringify(patch.verificationFlags) } : {}),
    ...(Array.isArray(patch.engagementInsights) ? { engagementInsightsJson: JSON.stringify(patch.engagementInsights) } : {}),
    ...(Array.isArray(patch.internalLinkSuggestions)
      ? { internalLinkSuggestionsJson: JSON.stringify(patch.internalLinkSuggestions) }
      : {}),
    ...(typeof patch.researchUsed === "boolean" ? { researchUsed: patch.researchUsed } : {}),
    ...(typeof patch.referencesEnabled === "boolean" ? { referencesEnabled: patch.referencesEnabled } : {}),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
          includeInReferences: existing.includeInReferences !== false,
        }
      : {
          ...source,
          approvalStatus: normalizeSourceApprovalStatus(source.approvalStatus),
          adminNotes: coerceString(source.adminNotes, MAX_SOURCE_ADMIN_NOTES_LENGTH),
          includeInReferences: source.includeInReferences !== false,
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

function getSourceWarnings(source: AiResearchSource) {
  const warnings: string[] = [];

  if (source.usefulness === "low") {
    warnings.push("Low usefulness for final editorial references.");
  }

  if (!source.publishedDate) {
    warnings.push("Publication date is unclear. Verify freshness before citing.");
  } else {
    const ageMs = Date.now() - new Date(source.publishedDate).getTime();
    if (Number.isFinite(ageMs) && ageMs > 730 * 24 * 60 * 60 * 1000) {
      warnings.push("Source may be stale. Review whether the information is still current.");
    }
  }

  if (toSafeUrl(source.url) === "#") {
    warnings.push("Unsafe or invalid source URL. It will be excluded from references.");
  }

  return warnings;
}

function buildReferencesHtml(sources: AiResearchSource[]) {
  const approvedLinks = sources
    .filter((source) => source.approvalStatus === "approved" && source.includeInReferences !== false)
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
        `<li><a href="${source.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`
    )
    .join("");

  return `<h2>References</h2><ul>${items}</ul>`;
}

function applyInternalLinkSuggestionToHtml(contentHtml: string, suggestion: AiInternalLinkSuggestion) {
  const safeSlug = suggestion.slug.trim().replace(/^\/+/, "");
  const anchorText = suggestion.anchorText.trim() || suggestion.title.trim();
  if (!safeSlug || !anchorText) {
    return contentHtml;
  }

  const href = `/blog/${safeSlug}`;
  const escapedAnchor = escapeHtml(anchorText);
  const linkHtml = `<a href="${href}">${escapedAnchor}</a>`;

  if (contentHtml.includes(linkHtml) || contentHtml.includes(`href="${href}"`)) {
    return contentHtml;
  }

  const pattern = new RegExp(anchorText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (pattern.test(contentHtml)) {
    return contentHtml.replace(pattern, linkHtml);
  }

  return `${contentHtml}<p><strong>Related reading:</strong> <a href="${href}">${escapeHtml(
    suggestion.title
  )}</a></p>`;
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
  aiService,
  researchService,
}: {
  prismaClient?: AdminAiPrisma;
  aiService?: BlogStudioAiService;
  researchService?: ResearchService;
} = {}) {
  const router = Router();
  const envConfig = getAiProviderConfig();
  const aiRateLimit = createRateLimiter({
    keyPrefix: "admin-ai",
    maxRequests: envConfig.rateLimitMax,
    windowMs: envConfig.rateLimitWindowMs,
    message: "Too many AI requests. Please slow down and try again shortly.",
  });

  async function resolveConfig(): Promise<AiProviderConfig> {
    const dbOverrides = await getDbOverrides();
    return { ...envConfig, ...dbOverrides };
  }

  const getAiService = async (capture?: (event: AiTelemetryEvent) => void | Promise<void>) => {
    const config = await resolveConfig();
    return aiService || createBlogStudioAiService({ config, onTelemetry: capture });
  };
  const getResearchService = async (capture?: (event: ResearchTelemetryEvent) => void | Promise<void>) => {
    const config = await resolveConfig();
    return researchService || createResearchServiceWithOptions({ config, onTelemetry: capture });
  };
  const getResearchMeta = (service: ResearchService) => ({
    researchEnabled: service.isEnabled(),
    researchMessage: service.getUnavailableReason(),
  });

  const draftGenerationJobs = new Map<string, Promise<void>>();
  const DRAFT_STALE_MS = 30 * 60 * 1000;
  const DRAFT_ERROR_PREFIX = "__DRAFT_ERROR__";

  function decodeDraftError(notes: string[]): string | null {
    const row = notes.find((n) => n.startsWith(DRAFT_ERROR_PREFIX));
    return row ? row.slice(DRAFT_ERROR_PREFIX.length) : null;
  }

  function getDraftFailureError(draft: AiDraftData | null): string | null {
    if (!draft) return null;

    const decoded = decodeDraftError(draft.verificationNotes || []);
    if (decoded) return decoded;

    const GENERIC_RETRY = "Draft generation failed. Use generate_draft with force=true to retry.";

    if (draft.status === "failed") return GENERIC_RETRY;
    if (draft.slug?.startsWith("draft-failed-") || draft.title === "Draft generation failed") return GENERIC_RETRY;

    return null;
  }

  async function executeDraftGeneration(conversationId: string, userId: string): Promise<void> {
    const startedAt = Date.now();
    const usageEvents: AiTelemetryEvent[] = [];

    try {
      const service = await getAiService((event) => { usageEvents.push(event); });
      const conversation = await loadConversationForUser(prismaClient, conversationId, userId);

      if (!conversation) {
        logError("Async draft generation: conversation not found", { conversationId });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      const storedResearch = toResearchPayload(conversation.research);
      const research = prepareResearchForGeneration(storedResearch);
      const historicalContext = await getHistoricalEngagementContext(prismaClient);
      const writingProfile = await loadWritingProfile(prismaClient);

      const draft = await service.generateDraft({
        topic: conversation.topic,
        brief: brief!,
        messages: toMessageInputs(conversation.messages),
        historicalContext: historicalContext.summary,
        research,
        writingProfile: isProfileEmpty(writingProfile) ? null : writingProfile,
      });

      const rawInternalLinkSuggestions =
        draft.internalLinkSuggestions && draft.internalLinkSuggestions.length > 0
          ? draft.internalLinkSuggestions
          : research?.internalLinkSuggestions || [];
      const { links: internalLinkSuggestions, topicGaps } = await validateInternalLinkSuggestions(
        prismaClient,
        rawInternalLinkSuggestions,
        conversation.topic,
        brief!,
      );
      const verificationNotes = uniqueStrings([
        ...(draft.verificationNotes || []),
        ...(research?.sources.length === 0 && storedResearch?.sources.length ? [SOURCELESS_RESEARCH_WARNING] : []),
      ]);
      const notesWithQualityScore = encodeQualityScoreIntoNotes(verificationNotes, draft.qualityScore || null);
      const draftRecommendations = [
        ...(draft.recommendations || []),
        ...topicGaps.map((gap) => `Consider writing a related post: "${gap}" to strengthen internal linking.`),
      ];

      const draftUpdateData = {
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
        recommendationsJson: JSON.stringify(draftRecommendations),
        verificationNotesJson: JSON.stringify(notesWithQualityScore),
        verificationFlagsJson: JSON.stringify(draft.verificationFlags || []),
        engagementInsightsJson: JSON.stringify(
          draft.engagementInsights && draft.engagementInsights.length > 0
            ? draft.engagementInsights
            : historicalContext.insights
        ),
        internalLinkSuggestionsJson: JSON.stringify(internalLinkSuggestions),
        researchUsed: Boolean(draft.researchUsed || (research && research.sources.length > 0 && research.status === "completed")),
        referencesEnabled: false,
        status: "generated" as const,
      };

      await prismaClient.aiDraftOutput.upsert({
        where: { conversationId },
        update: draftUpdateData,
        create: { conversationId, ...draftUpdateData },
      });

      await prismaClient.aiRewriteProposal
        .updateMany({
          where: { conversationId, status: "proposed" },
          data: { status: "rejected" },
        })
        .catch(() => undefined);

      await appendConversationMessage(
        prismaClient,
        conversationId,
        "assistant",
        "The draft is ready. Review the brief, verification flags, internal linking suggestions, and HTML preview before saving it as a CMS draft.",
        { type: "draft-generated" }
      );
      await touchConversation(prismaClient, conversationId, "draft_ready", draft.title);
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversationId, event, {
            draftSlug: draft.slug,
            researchUsed: draft.researchUsed,
          })
        )
      );

      logInfo("Async draft generation completed", {
        conversationId,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      await prismaClient.aiConversation.update({
        where: { id: conversationId },
        data: { status: "failed" },
      }).catch(() => undefined);

      await prismaClient.aiDraftOutput.upsert({
        where: { conversationId },
        update: {
          status: "failed",
          verificationNotesJson: JSON.stringify([`${DRAFT_ERROR_PREFIX}${errorMsg.slice(0, 1000)}`]),
        },
        create: {
          conversationId,
          title: "Draft generation failed",
          slug: `draft-failed-${Date.now()}`,
          contentHtml: "<p>Draft generation failed. Use force=true to retry.</p>",
          status: "failed",
          verificationNotesJson: JSON.stringify([`${DRAFT_ERROR_PREFIX}${errorMsg.slice(0, 1000)}`]),
        },
      }).catch(() => undefined);

      await recordFailedOperation(prismaClient, conversationId, envConfig.provider, "draft_generate", errorMsg);

      logError("Async draft generation failed", {
        conversationId,
        elapsedMs: Date.now() - startedAt,
        error: errorMsg,
      });
    }
  }

  router.use(authMiddleware);
  router.use(requireRoleWithClient(prismaClient, "admin", "editor"));

  router.get("/conversations", async (req: AuthRequest, res) => {
    try {
      const filter = String(req.query.filter || "active");
      const search = coerceString(req.query.search, 120).toLowerCase();
      const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
      const pageSize = Math.min(
        MAX_CONVERSATION_PAGE_SIZE,
        Math.max(1, Number.parseInt(String(req.query.pageSize || DEFAULT_CONVERSATION_PAGE_SIZE), 10) || DEFAULT_CONVERSATION_PAGE_SIZE)
      );
      const where = {
        userId: req.userId!,
        ...(filter === "archived" ? { archivedAt: { not: null } } : filter === "all" ? {} : { archivedAt: null }),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { topic: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const start = (page - 1) * pageSize;
      const [total, conversations] = await Promise.all([
        prismaClient.aiConversation.count({ where }),
        prismaClient.aiConversation.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: start,
          take: pageSize,
          select: {
            id: true,
            title: true,
            topic: true,
            status: true,
            archivedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      ]);

      res.json({
        items: conversations,
        total,
        page,
        pageSize,
        hasMore: start + conversations.length < total,
      });
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

    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(await getResearchService());

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
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

      const assistantReply = await routeAiService.startConversation({
        topic,
        messages: [{ role: "user", content: topic }],
      });

      await appendConversationMessage(prismaClient, conversation.id, "assistant", assistantReply, {
        type: "clarification",
      });

      await touchConversation(prismaClient, conversation.id, "active");
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, { topicLength: topic.length })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.status(201).json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        null,
        envConfig.provider,
        "conversation_start",
        error instanceof Error ? error.message : "Failed to start AI conversation"
      );
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

      res.json(toConversationPayload(conversation, getResearchMeta(await getResearchService())));
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

  router.post("/conversations/:id/archive", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const archivedAt = coerceBoolean(req.body?.archived) === false ? null : new Date().toISOString();
      await prismaClient.aiConversation.update({
        where: { id: conversation.id },
        data: { archivedAt },
      });

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, getResearchMeta(await getResearchService())));
    } catch (error) {
      logError("AI conversation archive update failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to update AI conversation archive state" });
    }
  });

  router.delete("/conversations/:id", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      await prismaClient.aiConversation.delete({
        where: { id: conversation.id },
      });

      res.status(204).send();
    } catch (error) {
      logError("AI conversation delete failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to delete AI conversation" });
    }
  });

  router.post("/conversations/:id/message", aiRateLimit, async (req: AuthRequest, res) => {
    const message = trimmedString(req.body?.message).slice(0, MAX_MESSAGE_LENGTH);
    if (!message) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(await getResearchService());

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      await appendConversationMessage(prismaClient, conversation.id, "user", message);

      const assistantReply = await routeAiService.replyInConversation({
        topic: conversation.topic,
        messages: [...toMessageInputs(conversation.messages), { role: "user", content: message }],
        brief: toBriefPayload(conversation.brief),
      });

      await appendConversationMessage(prismaClient, conversation.id, "assistant", assistantReply, {
        type: "clarification",
      });
      await touchConversation(prismaClient, conversation.id, conversation.status || "active");
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, { messageLength: message.length })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        envConfig.provider,
        "conversation_reply",
        error instanceof Error ? error.message : "Failed to send AI message"
      );
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
    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(await getResearchService());

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const writingProfile = await loadWritingProfile(prismaClient);

      const brief = await routeAiService.generateBrief({
        topic: conversation.topic,
        messages: toMessageInputs(conversation.messages),
        writingProfile: isProfileEmpty(writingProfile) ? null : writingProfile,
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
          notes: encodeBriefNotes(brief),
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
          notes: encodeBriefNotes(brief),
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
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, {
            primaryKeyword: brief.primaryKeyword,
            contentType: brief.contentType,
          })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        envConfig.provider,
        "brief_generate",
        error instanceof Error ? error.message : "Failed to generate AI brief"
      );
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
      const researchMeta = getResearchMeta(await getResearchService());
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const briefPayload = buildBriefFromRequest(req.body as Record<string, unknown>, conversation.topic, toBriefPayload(conversation.brief));

      const encodedNotes = encodeBriefNotes(briefPayload);

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
          notes: encodedNotes,
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
          notes: encodedNotes,
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
    const usageEvents: ResearchTelemetryEvent[] = [];
    const routeResearchService = await getResearchService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(routeResearchService);
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      const existingResearch = toResearchPayload(conversation.research);
      const internalLinkSuggestions = await getInternalLinkSuggestions(prismaClient, brief?.primaryKeyword || conversation.topic, brief);
      const research = await routeResearchService.runResearch({
        topic: conversation.topic,
        brief,
        messages: toMessageInputs(conversation.messages),
        internalLinkSuggestions,
      });

      const rawMergedLinkSuggestions = [
        ...(research.internalLinkSuggestions && research.internalLinkSuggestions.length > 0
          ? research.internalLinkSuggestions
          : []),
        ...internalLinkSuggestions,
      ];
      const { links: validatedResearchLinks } = await validateInternalLinkSuggestions(
        prismaClient,
        rawMergedLinkSuggestions,
        conversation.topic,
        brief,
      );

      const mergedResearch: AiResearchData = {
        ...research,
        sources: mergeResearchSources(existingResearch?.sources || [], research.sources),
        internalLinkSuggestions: validatedResearchLinks.length > 0 ? validatedResearchLinks : internalLinkSuggestions,
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
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, {
            sourceCount: mergedResearch.sources.length,
            status: mergedResearch.status,
          })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        routeResearchService.providerName,
        "research_synthesis",
        error instanceof Error ? error.message : "Failed to run topic research"
      );
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
            provider: routeResearchService.providerName,
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
            provider: routeResearchService.providerName,
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
      const researchMeta = getResearchMeta(await getResearchService());
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
          includeInReferences: update.includeInReferences !== false,
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
    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(await getResearchService());

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
      return;
    }

    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const forceRegenerate = coerceBoolean(req.body?.force);
      const useAsync = coerceBoolean(req.body?.async);

      const existingDraft = toDraftPayload(conversation.draft);
      if (!forceRegenerate && existingDraft && existingDraft.status === "generated") {
        const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
        res.json(toConversationPayload(detail, researchMeta));
        return;
      }

      const brief = toBriefPayload(conversation.brief);
      if (!brief) {
        res.status(400).json({ error: "No brief found. Call generate_brief first." });
        return;
      }
      if (!brief.approvedAt) {
        res.status(400).json({ error: "The brief has not been approved yet. Call approve_brief first." });
        return;
      }

      // Require Exa research to be configured for draft generation
      const envConfig = getAiProviderConfig();
      const dbOverrides = await getDbOverrides();
      const researchProvider = dbOverrides.researchProvider || envConfig.researchProvider;
      const researchApiKey = dbOverrides.researchApiKey || envConfig.researchApiKey;

      if (researchProvider !== "exa" || !researchApiKey) {
        res.status(400).json({ error: "Exa research API is required for content generation. Configure it in Admin > Settings > AI Configuration." });
        return;
      }

      // Require research to be run before drafting
      const storedResearch = toResearchPayload(conversation.research);
      if (!storedResearch || storedResearch.sources.length === 0) {
        res.status(400).json({ error: "Research has not been run. Call run_research before generate_draft." });
        return;
      }

      // === ASYNC MODE: return 202 immediately, generate in background ===
      if (useAsync) {
        if (draftGenerationJobs.has(conversation.id)) {
          res.status(202).json({
            status: "draft_generating",
            conversationId: conversation.id,
            pollUrl: `/api/admin/ai/conversations/${conversation.id}/draft/status`,
          });
          return;
        }

        await touchConversation(prismaClient, conversation.id, "draft_generating");

        const job = executeDraftGeneration(conversation.id, req.userId!).finally(() => {
          draftGenerationJobs.delete(conversation.id);
        });
        draftGenerationJobs.set(conversation.id, job);

        logInfo("Async draft generation started", { conversationId: conversation.id });
        res.status(202).json({
          status: "draft_generating",
          conversationId: conversation.id,
          pollUrl: `/api/admin/ai/conversations/${conversation.id}/draft/status`,
        });
        return;
      }

      const research = prepareResearchForGeneration(storedResearch);
      const historicalContext = await getHistoricalEngagementContext(prismaClient);
      const writingProfile = await loadWritingProfile(prismaClient);

      const draft = await routeAiService.generateDraft({
        topic: conversation.topic,
        brief,
        messages: toMessageInputs(conversation.messages),
        historicalContext: historicalContext.summary,
        research,
        writingProfile: isProfileEmpty(writingProfile) ? null : writingProfile,
      });

      const rawInternalLinkSuggestions =
        draft.internalLinkSuggestions && draft.internalLinkSuggestions.length > 0
          ? draft.internalLinkSuggestions
          : research?.internalLinkSuggestions || [];
      const { links: internalLinkSuggestions, topicGaps } = await validateInternalLinkSuggestions(
        prismaClient,
        rawInternalLinkSuggestions,
        conversation.topic,
        brief,
      );
      const verificationNotes = uniqueStrings([
        ...(draft.verificationNotes || []),
        ...(research?.sources.length === 0 && storedResearch?.sources.length ? [SOURCELESS_RESEARCH_WARNING] : []),
      ]);
      const notesWithQualityScore = encodeQualityScoreIntoNotes(verificationNotes, draft.qualityScore || null);
      const draftRecommendations = [
        ...(draft.recommendations || []),
        ...topicGaps.map((gap) => `Consider writing a related post: "${gap}" to strengthen internal linking.`),
      ];

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
          recommendationsJson: JSON.stringify(draftRecommendations),
          verificationNotesJson: JSON.stringify(notesWithQualityScore),
          verificationFlagsJson: JSON.stringify(draft.verificationFlags || []),
          engagementInsightsJson: JSON.stringify(
            draft.engagementInsights && draft.engagementInsights.length > 0
              ? draft.engagementInsights
              : historicalContext.insights
          ),
          internalLinkSuggestionsJson: JSON.stringify(internalLinkSuggestions),
          researchUsed: Boolean(draft.researchUsed || (research && research.sources.length > 0 && research.status === "completed")),
          referencesEnabled: false,
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
          recommendationsJson: JSON.stringify(draftRecommendations),
          verificationNotesJson: JSON.stringify(notesWithQualityScore),
          verificationFlagsJson: JSON.stringify(draft.verificationFlags || []),
          engagementInsightsJson: JSON.stringify(
            draft.engagementInsights && draft.engagementInsights.length > 0
              ? draft.engagementInsights
              : historicalContext.insights
          ),
          internalLinkSuggestionsJson: JSON.stringify(internalLinkSuggestions),
          researchUsed: Boolean(draft.researchUsed || (research && research.sources.length > 0 && research.status === "completed")),
          referencesEnabled: false,
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
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, {
            draftSlug: draft.slug,
            researchUsed: draft.researchUsed,
          })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        envConfig.provider,
        "draft_generate",
        error instanceof Error ? error.message : "Failed to generate AI draft"
      );
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

  router.get("/conversations/:id/draft/status", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const conversationStatus = conversation.status || "active";
      const draft = toDraftPayload(conversation.draft);

      const draftFailureError = getDraftFailureError(draft);
      if (draftFailureError) {
        res.json({
          conversationId: conversation.id,
          status: "failed",
          draft: null,
          error: draftFailureError,
          ready: false,
        });
        return;
      }

      if (conversationStatus === "draft_generating") {
        const isActivelyGenerating = draftGenerationJobs.has(conversation.id);
        if (!isActivelyGenerating) {
          const updatedAt = new Date(conversation.updatedAt).getTime();
          if (Date.now() - updatedAt > DRAFT_STALE_MS) {
            res.json({
              conversationId: conversation.id,
              status: "failed",
              draft: null,
              error: "Draft generation timed out (stale for 30+ minutes). Use generate_draft with force=true to retry.",
              ready: false,
            });
            return;
          }
        }
        res.json({
          conversationId: conversation.id,
          status: "draft_generating",
          draft: null,
          error: null,
          ready: false,
        });
        return;
      }

      if (draft && (draft.status === "generated" || draft.status === "saved")) {
        res.json({
          conversationId: conversation.id,
          status: draft.status,
          draft,
          error: null,
          ready: true,
        });
        return;
      }

      if (conversationStatus === "failed" || (draft && draft.status === "failed")) {
        const rawNotes = safeJsonParse<string[]>(conversation.draft?.verificationNotesJson, []);
        const error = decodeDraftError(rawNotes);
        res.json({
          conversationId: conversation.id,
          status: "failed",
          draft: null,
          error: error || "Draft generation failed. Use generate_draft with force=true to retry.",
          ready: false,
        });
        return;
      }

      res.json({
        conversationId: conversation.id,
        status: conversationStatus,
        draft: draft,
        error: null,
        ready: false,
      });
    } catch (error) {
      logError("Draft status check failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to check draft status" });
    }
  });

  router.post("/conversations/:id/analyze", aiRateLimit, async (req: AuthRequest, res) => {
    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });
    const researchMeta = getResearchMeta(await getResearchService());

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
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

      const analysis = await routeAiService.analyzeDraft({
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
            await (async () => {
              const rawSuggestions =
                analysis.internalLinkSuggestions && analysis.internalLinkSuggestions.length > 0
                  ? analysis.internalLinkSuggestions
                  : draft.internalLinkSuggestions || [];
              const { links } = await validateInternalLinkSuggestions(
                prismaClient,
                rawSuggestions,
                conversation.topic,
                brief,
              );
              return links;
            })()
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
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, {
            seoScore: analysis.seoScore,
            engagementScore: analysis.engagementScore,
          })
        )
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, researchMeta));
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        envConfig.provider,
        "draft_analyze",
        error instanceof Error ? error.message : "Failed to analyze AI draft"
      );
      logError("AI draft analysis failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(502).json({ error: error instanceof Error ? error.message : "Failed to analyze AI draft" });
    }
  });

  router.put("/conversations/:id/draft-review", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const draft = toDraftPayload(conversation.draft);
      if (!draft) {
        res.status(400).json({ error: "Generate a draft before updating review notes." });
        return;
      }

      const nextFlags = Array.isArray(req.body?.verificationFlags)
        ? req.body.verificationFlags.map((flag: any) => ({
            claim: coerceString(flag?.claim, 400),
            status: ["supported", "general", "needs_verification", "risky"].includes(flag?.status)
              ? flag.status
              : "needs_verification",
            sourceId: typeof flag?.sourceId === "string" ? coerceString(flag.sourceId, 120) : null,
            recommendation: coerceString(flag?.recommendation, 320),
            reviewStatus: normalizeVerificationReviewStatus(flag?.reviewStatus),
            reviewNotes: coerceString(flag?.reviewNotes, MAX_VERIFICATION_REVIEW_NOTES),
          })).filter((flag: any) => flag.claim && flag.recommendation)
        : draft.verificationFlags;

      await prismaClient.aiDraftOutput.update({
        where: { conversationId: conversation.id },
        data: {
          verificationFlagsJson: JSON.stringify(nextFlags),
        },
      });

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, getResearchMeta(await getResearchService())));
    } catch (error) {
      logError("AI draft review update failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to update draft review notes" });
    }
  });

  router.post("/conversations/:id/internal-link", async (req: AuthRequest, res) => {
    try {
      const conversation = await loadConversationForUser(prismaClient, param(req, "id"), req.userId!);
      if (!conversation) {
        res.status(404).json({ error: "AI conversation not found" });
        return;
      }

      const draft = toDraftPayload(conversation.draft);
      if (!draft) {
        res.status(400).json({ error: "Generate a draft before applying internal links." });
        return;
      }

      const suggestionIndex = Number(req.body?.suggestionIndex);
      if (!Number.isInteger(suggestionIndex) || suggestionIndex < 0) {
        res.status(400).json({ error: "A valid internal link suggestion is required." });
        return;
      }

      const suggestion = (draft.internalLinkSuggestions || [])[suggestionIndex];
      if (!suggestion) {
        res.status(404).json({ error: "Internal link suggestion not found." });
        return;
      }

      const nextHtml = applyInternalLinkSuggestionToHtml(draft.contentHtml, suggestion);
      const updatedSuggestions = (draft.internalLinkSuggestions || []).map((s, i) =>
        i === suggestionIndex ? { ...s, applied: true } : s
      );
      await prismaClient.aiDraftOutput.update({
        where: { conversationId: conversation.id },
        data: {
          contentHtml: sanitizeGeneratedHtml(nextHtml),
          internalLinkSuggestionsJson: JSON.stringify(updatedSuggestions),
        },
      });

      await appendConversationMessage(
        prismaClient,
        conversation.id,
        "assistant",
        `Applied the internal link suggestion for "${suggestion.title}".`,
        { type: "internal-link-applied", slug: suggestion.slug }
      );

      const detail = await loadConversationForUser(prismaClient, conversation.id, req.userId!);
      res.json(toConversationPayload(detail, getResearchMeta(await getResearchService())));
    } catch (error) {
      logError("AI internal link apply failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        conversationId: param(req, "id"),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to apply internal link suggestion" });
    }
  });

  router.post("/conversations/:id/rewrite", aiRateLimit, async (req: AuthRequest, res) => {
    const action = parseRewriteAction(req.body?.action);
    if (!action) {
      res.status(400).json({ error: "A valid rewrite action is required." });
      return;
    }

    const usageEvents: AiTelemetryEvent[] = [];
    const routeAiService = await getAiService((event) => {
      usageEvents.push(event);
    });

    if (!routeAiService.isAvailable()) {
      aiUnavailableResponse(res, routeAiService);
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
      const writingProfile = await loadWritingProfile(prismaClient);
      const proposal = await routeAiService.rewriteDraft({
        topic: conversation.topic,
        brief,
        draft,
        action,
        selectedText: coerceString(req.body?.selectedText, 5000) || null,
        historicalContext: historicalContext.summary,
        research,
        writingProfile: isProfileEmpty(writingProfile) ? null : writingProfile,
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
      await Promise.all(
        usageEvents.map((event) =>
          recordUsageEvent(prismaClient, conversation.id, event, {
            action,
            target: proposal.target,
          })
        )
      );

      res.json({
        proposal: toRewriteProposalPayload(created),
      });
    } catch (error) {
      await recordFailedOperation(
        prismaClient,
        param(req, "id"),
        envConfig.provider,
        "draft_rewrite",
        error instanceof Error ? error.message : "Failed to generate rewrite proposal"
      );
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
      const researchMeta = getResearchMeta(await getResearchService());
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
      const researchMeta = getResearchMeta(await getResearchService());
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

      const draftFailureError = getDraftFailureError(draft);
      if (draftFailureError) {
        res.status(400).json({ error: draftFailureError });
        return;
      }

      const includeReferences = coerceBoolean(req.body?.includeReferences);
      const research = toResearchPayload(conversation.research);

      let html = draft.contentHtml;

      const faqHtml = buildFaqHtml(draft.faq || []);
      if (faqHtml && !html.includes("Frequently Asked Questions") && !html.includes("faq")) {
        html = `${html}${faqHtml}`;
      }

      html = applyAllInternalLinks(html, draft.internalLinkSuggestions || []);

      const referencesHtml = includeReferences ? buildReferencesHtml(research?.sources || []) : "";
      if (referencesHtml) {
        html = `${html}${referencesHtml}`;
      }

      const contentHtml = sanitizeGeneratedHtml(html);
      const excerpt = draft.excerpt || stripHtml(contentHtml).slice(0, 220);

      if (draft.postId) {
        const categoryId = await resolveCategoryId(prismaClient, draft.categorySuggestion);
        const tagIds = await resolveTagIds(prismaClient, draft.tagSuggestions || []);

        await prismaClient.post.update({
          where: { id: draft.postId },
          data: {
            title: draft.title,
            excerpt: excerpt || null,
            body: contentHtml,
            readingTime: computeReadingTime(contentHtml),
            metaTitle: draft.metaTitle || null,
            metaDescription: draft.metaDescription || null,
            categoryId,
            tags: {
              set: [],
              ...(tagIds.length > 0 ? { connect: tagIds.map((id) => ({ id })) } : {}),
            },
          },
        });

        await prismaClient.aiDraftOutput.update({
          where: { conversationId: conversation.id },
          data: {
            contentHtml,
            referencesEnabled: includeReferences,
            status: "saved",
          },
        });

        await appendConversationMessage(
          prismaClient,
          conversation.id,
          "assistant",
          "CMS draft updated with the latest changes. Open the editor to review and publish.",
          { type: "saved-draft", postId: draft.postId }
        );

        logInfo("AI draft re-saved to existing CMS post", {
          ...getRequestLogMeta(req),
          userId: req.userId,
          conversationId: conversation.id,
          postId: draft.postId,
        });

        res.status(200).json({
          postId: draft.postId,
          editUrl: `/admin/posts/${draft.postId}/edit`,
        });
        return;
      }

      const uniqueSlug = await createUniquePostSlug(prismaClient, draft.slug, draft.title);
      const categoryId = await resolveCategoryId(prismaClient, draft.categorySuggestion);
      const tagIds = await resolveTagIds(prismaClient, draft.tagSuggestions || []);

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
          referencesEnabled: includeReferences,
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
