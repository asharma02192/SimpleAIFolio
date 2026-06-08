import { sanitizeGeneratedHtml } from "./html";
import { requestStructuredJson } from "./json";
import {
  buildAnalyzeMessages,
  buildBriefMessages,
  buildClarificationMessages,
  buildDraftMessages,
  buildRewriteMessages,
} from "./prompts";
import {
  createAiChatProvider,
  getAiProviderConfig,
  type AiChatProvider,
  type AiProviderConfig,
} from "./provider";

export interface AiConversationMessageInput {
  role: "user" | "assistant" | "system";
  content: string;
}

export type AiResearchApprovalStatus = "approved" | "rejected" | "needs_review";

export interface AiInternalLinkSuggestion {
  postId: string;
  title: string;
  slug: string;
  anchorText: string;
  reason: string;
}

export interface AiResearchSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedDate: string | null;
  summary: string;
  usefulness: "high" | "medium" | "low";
  notes: string[];
  approvalStatus: AiResearchApprovalStatus;
  adminNotes: string;
}

export interface AiResearchData {
  provider: string;
  status: string;
  topicSummary: string;
  searchIntent: string;
  keywordIdeas: string[];
  relatedQuestions: string[];
  competitorNotes: string[];
  contentGaps: string[];
  sources: AiResearchSource[];
  internalLinkSuggestions: AiInternalLinkSuggestion[];
  riskFlags: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AiBriefData {
  topic: string;
  audience: string;
  goal: string;
  tone: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  wordCount: number | null;
  contentType: string;
  cta: string;
  notes: string;
  approvedAt?: string | null;
}

export interface AiDraftOutlineItem {
  heading: string;
  points: string[];
}

export interface AiDraftFaqItem {
  question: string;
  answer: string;
}

export interface AiVerificationFlag {
  claim: string;
  status: "supported" | "general" | "needs_verification" | "risky";
  sourceId?: string | null;
  recommendation: string;
}

export interface AiDraftData {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  ogImagePrompt: string;
  categorySuggestion: string;
  tagSuggestions: string[];
  outline: AiDraftOutlineItem[];
  contentHtml: string;
  faq: AiDraftFaqItem[];
  seoScore: number;
  engagementScore: number;
  readabilityScore: number;
  recommendations: string[];
  verificationNotes: string[];
  verificationFlags: AiVerificationFlag[];
  engagementInsights: string[];
  internalLinkSuggestions: AiInternalLinkSuggestion[];
  researchUsed: boolean;
  postId?: string | null;
  status?: string;
}

export interface AiAnalysisResult {
  seoScore: number;
  engagementScore: number;
  readabilityScore: number;
  recommendations: string[];
  verificationNotes: string[];
  verificationFlags: AiVerificationFlag[];
  engagementInsights: string[];
  internalLinkSuggestions: AiInternalLinkSuggestion[];
}

export interface AiBriefInput {
  topic: string;
  messages: AiConversationMessageInput[];
}

export interface AiDraftInput {
  topic: string;
  brief: AiBriefData;
  messages: AiConversationMessageInput[];
  historicalContext?: string | null;
  research?: AiResearchData | null;
}

export type AiRewriteAction =
  | "improve_intro"
  | "stronger_title"
  | "seo_focus"
  | "more_human"
  | "add_examples"
  | "add_faq"
  | "improve_cta"
  | "shorten"
  | "expand"
  | "improve_readability";

export interface AiRewriteProposal {
  id?: string;
  action: AiRewriteAction;
  label: string;
  summary: string;
  target: "title" | "contentHtml" | "meta" | "faq" | "excerpt";
  preview: string;
  draftPatch: Partial<AiDraftData>;
  status?: "proposed" | "applied" | "rejected";
  createdAt?: string;
  updatedAt?: string;
}

export interface BlogStudioAiService {
  isAvailable(): boolean;
  getUnavailableReason(): string | null;
  startConversation(input: { topic: string; messages: AiConversationMessageInput[] }): Promise<string>;
  replyInConversation(input: {
    topic: string;
    messages: AiConversationMessageInput[];
    brief?: AiBriefData | null;
  }): Promise<string>;
  generateBrief(input: AiBriefInput): Promise<AiBriefData>;
  generateDraft(input: AiDraftInput): Promise<AiDraftData>;
  analyzeDraft(input: {
    topic: string;
    brief: AiBriefData;
    draft: AiDraftData;
    historicalContext?: string | null;
    research?: AiResearchData | null;
  }): Promise<AiAnalysisResult>;
  rewriteDraft(input: {
    topic: string;
    brief: AiBriefData | null;
    draft: AiDraftData;
    action: AiRewriteAction;
    selectedText?: string | null;
    historicalContext?: string | null;
    research?: AiResearchData | null;
  }): Promise<AiRewriteProposal>;
}

const MAX_TOPIC_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_HTML_LENGTH = 120_000;

function clamp(value: string, max: number) {
  return value.trim().slice(0, max);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function computeReadingTime(body: string) {
  const text = stripHtml(body);
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.ceil(words / 200));
}

function normalizeScore(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function normalizeStringArray(value: unknown, maxItems = 12, maxLength = 240) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeResearchApprovalStatus(value: unknown): AiResearchApprovalStatus {
  switch (value) {
    case "approved":
    case "rejected":
    case "needs_review":
      return value;
    default:
      return "needs_review";
  }
}

function normalizeBrief(value: unknown, fallbackTopic: string): AiBriefData {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;

  return {
    topic: clamp(typeof record.topic === "string" ? record.topic : fallbackTopic, 240) || fallbackTopic,
    audience: clamp(typeof record.audience === "string" ? record.audience : "", 300),
    goal: clamp(typeof record.goal === "string" ? record.goal : "", 300),
    tone: clamp(typeof record.tone === "string" ? record.tone : "", 120),
    primaryKeyword: clamp(typeof record.primaryKeyword === "string" ? record.primaryKeyword : "", 160),
    secondaryKeywords: normalizeStringArray(record.secondaryKeywords, 12),
    wordCount: Number.isFinite(Number(record.wordCount)) ? Math.max(300, Math.min(5000, Math.round(Number(record.wordCount)))) : null,
    contentType: clamp(typeof record.contentType === "string" ? record.contentType : "", 120),
    cta: clamp(typeof record.cta === "string" ? record.cta : "", 300),
    notes: clamp(typeof record.notes === "string" ? record.notes : "", 4000),
  };
}

function normalizeOutline(value: unknown): AiDraftOutlineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        heading: clamp(typeof record.heading === "string" ? record.heading : "", 200),
        points: normalizeStringArray(record.points, 8),
      };
    })
    .filter((item) => item.heading);
}

function normalizeFaq(value: unknown): AiDraftFaqItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        question: clamp(typeof record.question === "string" ? record.question : "", 240),
        answer: clamp(typeof record.answer === "string" ? record.answer : "", 1200),
      };
    })
    .filter((item) => item.question && item.answer)
    .slice(0, 8);
}

function normalizeInternalLinkSuggestions(value: unknown): AiInternalLinkSuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") {
        const slugMatch = item.match(/\/blog\/([^)]+)/);
        const title = item.replace(/\s*\(\/blog\/[^)]+\)\s*$/, "").trim();
        return {
          postId: "",
          title: clamp(title, 200),
          slug: clamp(slugMatch?.[1] || "", 220),
          anchorText: clamp(title, 120),
          reason: "Related published post worth linking to.",
        };
      }

      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        postId: clamp(typeof record.postId === "string" ? record.postId : "", 120),
        title: clamp(typeof record.title === "string" ? record.title : "", 200),
        slug: clamp(typeof record.slug === "string" ? record.slug : "", 220),
        anchorText: clamp(typeof record.anchorText === "string" ? record.anchorText : "", 120),
        reason: clamp(typeof record.reason === "string" ? record.reason : "", 240),
      };
    })
    .filter((item) => item.title && item.slug)
    .slice(0, 8);
}

function normalizeVerificationFlags(value: unknown): AiVerificationFlag[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const status: AiVerificationFlag["status"] =
        record.status === "supported" ||
        record.status === "general" ||
        record.status === "needs_verification" ||
        record.status === "risky"
          ? record.status
          : "needs_verification";

      return {
        claim: clamp(typeof record.claim === "string" ? record.claim : "", 400),
        status,
        sourceId: typeof record.sourceId === "string" ? clamp(record.sourceId, 120) : null,
        recommendation: clamp(typeof record.recommendation === "string" ? record.recommendation : "", 320),
      };
    })
    .filter((item) => item.claim && item.recommendation)
    .slice(0, 12);
}

function ensureHtmlContent(html: string, title: string) {
  const safe = sanitizeGeneratedHtml(html).trim().slice(0, MAX_HTML_LENGTH);
  if (safe) {
    return safe;
  }

  return `<h2>${title}</h2><p>This draft needs more detail before publishing. Expand the brief and regenerate the article.</p>`;
}

function normalizeDraft(value: unknown, fallbackTopic: string): AiDraftData {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const title = clamp(typeof record.title === "string" ? record.title : fallbackTopic, 160) || fallbackTopic;
  const rawSlug = clamp(typeof record.slug === "string" ? record.slug : title, 180);
  const sanitizedHtml = ensureHtmlContent(typeof record.contentHtml === "string" ? record.contentHtml : "", title);

  return {
    title,
    slug: slugify(rawSlug || title),
    excerpt: clamp(typeof record.excerpt === "string" ? record.excerpt : "", 320),
    metaTitle: clamp(typeof record.metaTitle === "string" ? record.metaTitle : title, 160),
    metaDescription: clamp(typeof record.metaDescription === "string" ? record.metaDescription : "", 320),
    ogImagePrompt: clamp(typeof record.ogImagePrompt === "string" ? record.ogImagePrompt : "", 400),
    categorySuggestion: clamp(typeof record.categorySuggestion === "string" ? record.categorySuggestion : "", 120),
    tagSuggestions: normalizeStringArray(record.tagSuggestions, 8),
    outline: normalizeOutline(record.outline),
    contentHtml: sanitizedHtml,
    faq: normalizeFaq(record.faq),
    seoScore: normalizeScore(record.seoScore, 72),
    engagementScore: normalizeScore(record.engagementScore, 68),
    readabilityScore: normalizeScore(record.readabilityScore, 74),
    recommendations: normalizeStringArray(record.recommendations, 10),
    verificationNotes: normalizeStringArray(record.verificationNotes, 10),
    verificationFlags: normalizeVerificationFlags(record.verificationFlags),
    engagementInsights: normalizeStringArray(record.engagementInsights, 8),
    internalLinkSuggestions: normalizeInternalLinkSuggestions(record.internalLinkSuggestions),
    researchUsed: Boolean(record.researchUsed),
  };
}

function normalizeAnalysis(value: unknown): AiAnalysisResult {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    seoScore: normalizeScore(record.seoScore, 70),
    engagementScore: normalizeScore(record.engagementScore, 68),
    readabilityScore: normalizeScore(record.readabilityScore, 74),
    recommendations: normalizeStringArray(record.recommendations, 10),
    verificationNotes: normalizeStringArray(record.verificationNotes, 10),
    verificationFlags: normalizeVerificationFlags(record.verificationFlags),
    engagementInsights: normalizeStringArray(record.engagementInsights, 8),
    internalLinkSuggestions: normalizeInternalLinkSuggestions(record.internalLinkSuggestions),
  };
}

function normalizeRewriteTarget(value: unknown): AiRewriteProposal["target"] {
  switch (value) {
    case "title":
    case "contentHtml":
    case "meta":
    case "faq":
    case "excerpt":
      return value;
    default:
      return "contentHtml";
  }
}

function normalizeDraftPatch(value: unknown): Partial<AiDraftData> {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const patch: Partial<AiDraftData> = {};

  if (typeof record.title === "string") patch.title = clamp(record.title, 160);
  if (typeof record.slug === "string") patch.slug = slugify(record.slug);
  if (typeof record.excerpt === "string") patch.excerpt = clamp(record.excerpt, 320);
  if (typeof record.metaTitle === "string") patch.metaTitle = clamp(record.metaTitle, 160);
  if (typeof record.metaDescription === "string") patch.metaDescription = clamp(record.metaDescription, 320);
  if (typeof record.contentHtml === "string") patch.contentHtml = ensureHtmlContent(record.contentHtml, patch.title || "Draft");
  if (Array.isArray(record.faq)) patch.faq = normalizeFaq(record.faq);
  if (Array.isArray(record.recommendations)) patch.recommendations = normalizeStringArray(record.recommendations, 10);
  if (Array.isArray(record.verificationNotes)) patch.verificationNotes = normalizeStringArray(record.verificationNotes, 10);
  if (Array.isArray(record.verificationFlags)) patch.verificationFlags = normalizeVerificationFlags(record.verificationFlags);
  if (Array.isArray(record.engagementInsights)) patch.engagementInsights = normalizeStringArray(record.engagementInsights, 8);
  if (Array.isArray(record.internalLinkSuggestions)) patch.internalLinkSuggestions = normalizeInternalLinkSuggestions(record.internalLinkSuggestions);
  if ("researchUsed" in record) patch.researchUsed = Boolean(record.researchUsed);

  return patch;
}

function normalizeRewriteProposal(value: unknown, action: AiRewriteAction): AiRewriteProposal {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const draftPatch = normalizeDraftPatch(record.draftPatch);
  const target = normalizeRewriteTarget(record.target);
  const previewSource =
    typeof record.preview === "string" && record.preview.trim()
      ? record.preview
      : typeof draftPatch.contentHtml === "string"
        ? draftPatch.contentHtml
        : typeof draftPatch.title === "string"
          ? draftPatch.title
          : typeof draftPatch.metaDescription === "string"
            ? draftPatch.metaDescription
            : "";

  return {
    action,
    label: clamp(typeof record.label === "string" ? record.label : action.replace(/_/g, " "), 120),
    summary: clamp(typeof record.summary === "string" ? record.summary : "Review the proposed improvement before applying it.", 300),
    target,
    preview: target === "contentHtml" ? ensureHtmlContent(previewSource, draftPatch.title || "Draft") : clamp(previewSource, 6000),
    draftPatch,
    status:
      record.status === "applied" || record.status === "rejected" || record.status === "proposed"
        ? record.status
        : "proposed",
    createdAt: typeof record.createdAt === "string" ? record.createdAt : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined,
  };
}

function isBriefShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isDraftShape(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.title === "string" && typeof record.slug === "string" && typeof record.contentHtml === "string";
}

function isAnalysisShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function isRewriteShape(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function summarizeMessages(messages: AiConversationMessageInput[]) {
  const joined = messages
    .filter((message) => message.role === "user")
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return joined.toLowerCase();
}

function createMockService(config: AiProviderConfig): BlogStudioAiService {
  const mockNote =
    config.researchProvider === "disabled"
      ? "Research API integration is not enabled yet. Verify facts and add sources before publishing."
      : "Research findings should still be manually verified before publishing.";

  return {
    isAvailable: () => true,
    getUnavailableReason: () => null,
    async startConversation({ topic }) {
      return [
        `Great starting topic: "${clamp(topic, MAX_TOPIC_LENGTH)}".`,
        "Before I build the brief, I need a few details:",
        "1. Who is the target audience?",
        "2. What is the main goal of this post?",
        "3. What is the primary keyword?",
        "4. What tone should the article use?",
        "5. Roughly how deep and how long should it be?",
      ].join("\n");
    },
    async replyInConversation({ topic, messages }) {
      const transcript = summarizeMessages(messages);
      const hasEnoughContext =
        ["audience", "goal", "keyword", "tone", "word", "cta", "guide", "tutorial", "comparison"].filter((token) =>
          transcript.includes(token)
        ).length >= 4;

      if (hasEnoughContext) {
        return [
          `I have enough context to turn "${clamp(topic, MAX_TOPIC_LENGTH)}" into a structured brief.`,
          "If you are happy with the direction, click Generate Brief.",
          "Before that, you can still add references, examples, or a stronger CTA if you want the draft to be more specific.",
        ].join("\n");
      }

      return [
        "Thanks, that helps.",
        "I still need a few more details before the brief is ready:",
        "1. Which secondary keywords should I naturally weave in?",
        "2. Should this read more like a guide, listicle, comparison, thought-leadership piece, or tutorial?",
        "3. Do you want examples, case studies, or product references included?",
        "4. What CTA should the article end with?",
      ].join("\n");
    },
    async generateBrief({ topic, messages }) {
      const transcript = summarizeMessages(messages);
      return normalizeBrief(
        {
          topic,
          audience: transcript.includes("small business")
            ? "Small business owners and lean marketing teams"
            : "Growth-focused readers who want practical advice",
          goal: "Educate readers, build topical authority, and create a strong path into a service or newsletter CTA",
          tone: transcript.includes("simple") ? "Simple, expert, practical" : "Expert, direct, practical",
          primaryKeyword: topic,
          secondaryKeywords: ["content strategy", "seo writing", "ai workflows"],
          wordCount: transcript.includes("long") ? 2200 : 1600,
          contentType: transcript.includes("tutorial") ? "tutorial" : "guide",
          cta: "Invite readers to explore the service, subscribe, or book a consult",
          notes: mockNote,
        },
        topic
      );
    },
    async generateDraft({ topic, brief, research }) {
      const title = `${brief.primaryKeyword || topic}: A Practical Guide for Better Results`;
      const slug = slugify(brief.primaryKeyword || topic);
      const contentHtml = `
<h2>Why this topic matters right now</h2>
<p>${brief.audience || "Your audience"} needs practical guidance, not vague theory. This draft focuses on clear takeaways, natural search intent alignment, and a strong editorial structure.</p>
<h2>What good looks like</h2>
<p>A strong article should answer the core question quickly, build trust with concrete examples, and lead naturally into the next action.</p>
<ul>
  <li>Match the search intent behind the primary keyword.</li>
  <li>Use short sections with clear subheadings.</li>
  <li>Include practical examples and a direct CTA.</li>
</ul>
<h2>How to apply it</h2>
<p>Start with the high-intent problem your reader is trying to solve. Then move into a repeatable framework, practical examples, and a concise final CTA.</p>
<blockquote>Use AI to accelerate the draft, then edit like an experienced human editor before publishing.</blockquote>
<h2>Final takeaway</h2>
<p>This version is intentionally safe and editable. The admin can refine examples, add internal links, and fact-check any claims before publishing.</p>
`;

      return normalizeDraft(
        {
          title,
          slug,
          excerpt: `A practical ${brief.contentType || "guide"} on ${brief.primaryKeyword || topic}, built for ${brief.audience || "modern readers"}.`,
          metaTitle: `${title} | ${brief.audience || "Practical SEO Writing"}`,
          metaDescription: `Learn ${brief.primaryKeyword || topic} with a clear outline, practical examples, and an SEO-friendly structure.`,
          ogImagePrompt: `Editorial blog cover about ${brief.primaryKeyword || topic}, clean typography, modern layout`,
          categorySuggestion: "AI",
          tagSuggestions: [brief.primaryKeyword || topic, "SEO", "Content Marketing"],
          outline: [
            {
              heading: "Why this topic matters right now",
              points: ["Frame the problem", "Tie it to audience pain points"],
            },
            {
              heading: "What good looks like",
              points: ["Explain the structure", "Highlight practical markers of quality"],
            },
            {
              heading: "How to apply it",
              points: ["Step-by-step guidance", "Examples and CTA"],
            },
          ],
          contentHtml,
          faq: [
            {
              question: `What is the main benefit of ${brief.primaryKeyword || topic}?`,
              answer: "It helps the reader solve a specific problem with a clear and actionable framework.",
            },
            {
              question: "Should AI-generated drafts be published as-is?",
              answer: "No. They should be edited, fact-checked, and aligned with your brand voice before publishing.",
            },
          ],
          seoScore: 84,
          engagementScore: 78,
          readabilityScore: 82,
          recommendations: [
            "Add one or two proprietary examples from your own work.",
            "Tighten the opening hook around a sharper pain point.",
            mockNote,
          ],
          verificationNotes: ["Verify any product-specific claims before publishing."],
          verificationFlags: [
            {
              claim: "AI helps small teams move faster.",
              status: "general",
              recommendation: "Keep this claim broad unless you add a supporting example.",
            },
            {
              claim: "This article references current workflows.",
              status: research?.sources.some((source) => source.approvalStatus === "approved") ? "supported" : "needs_verification",
              sourceId: research?.sources.find((source) => source.approvalStatus === "approved")?.id || null,
              recommendation: research?.sources.some((source) => source.approvalStatus === "approved")
                ? "Keep the claim tied to the approved source notes."
                : "Approve at least one source before turning this into a source-backed claim.",
            },
          ],
          engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
          internalLinkSuggestions: [
            {
              postId: "existing-post",
              title: "How to Build Better Content Systems",
              slug: "how-to-build-better-content-systems",
              anchorText: "content systems",
              reason: "Closely related to editorial workflow and SEO execution.",
            },
          ],
          researchUsed: Boolean(research && research.sources.some((source) => source.approvalStatus === "approved")),
        },
        topic
      );
    },
    async analyzeDraft({ draft, research }) {
      return normalizeAnalysis({
        seoScore: draft.seoScore,
        engagementScore: draft.engagementScore,
        readabilityScore: draft.readabilityScore,
        recommendations: [
          ...draft.recommendations,
          "Add one internal link to a related post once similar content exists.",
        ],
        verificationNotes: draft.verificationNotes,
        verificationFlags: draft.verificationFlags,
        engagementInsights: research
          ? ["Research-backed angle detected. Prioritize the strongest gap in the intro."]
          : ["Not enough historical engagement data yet. Using best-practice scoring."],
        internalLinkSuggestions: draft.internalLinkSuggestions,
      });
    },
    async rewriteDraft({ action, draft }) {
      if (action === "stronger_title") {
        return normalizeRewriteProposal(
          {
            label: "Stronger title",
            summary: "This option sharpens the value proposition and urgency.",
            target: "title",
            preview: `${draft.title.replace(/:.*$/, "")}: The Smarter Playbook for Fast Results`,
            draftPatch: {
              title: `${draft.title.replace(/:.*$/, "")}: The Smarter Playbook for Fast Results`,
              metaTitle: `${draft.title.replace(/:.*$/, "")}: The Smarter Playbook for Fast Results`,
            },
          },
          action
        );
      }

      return normalizeRewriteProposal(
        {
          label: action.replace(/_/g, " "),
          summary: "This proposed revision keeps the structure but improves clarity and usefulness.",
          target: "contentHtml",
          preview: `${draft.contentHtml}<p><strong>Added example:</strong> A founder can use this workflow to turn one vague topic into a publish-ready draft and then refine it inside the CMS.</p>`,
          draftPatch: {
            contentHtml: `${draft.contentHtml}<p><strong>Added example:</strong> A founder can use this workflow to turn one vague topic into a publish-ready draft and then refine it inside the CMS.</p>`,
            recommendations: [...draft.recommendations, "Review the new example and adapt it to your own case study."],
            verificationFlags: draft.verificationFlags,
            internalLinkSuggestions: draft.internalLinkSuggestions,
          },
        },
        action
      );
    },
  };
}

export function createBlogStudioAiService({
  config = getAiProviderConfig(),
  provider = createAiChatProvider(config),
}: {
  config?: AiProviderConfig;
  provider?: AiChatProvider;
} = {}): BlogStudioAiService {
  if (config.provider === "mock") {
    return createMockService(config);
  }

  const unavailableReason = provider.getUnavailableReason();

  return {
    isAvailable() {
      return provider.isConfigured();
    },
    getUnavailableReason() {
      return unavailableReason;
    },
    async startConversation({ topic, messages }) {
      return provider.complete(
        buildClarificationMessages({
          topic: clamp(topic, MAX_TOPIC_LENGTH),
          messages: messages.map((message) => ({
            ...message,
            content: clamp(message.content, MAX_MESSAGE_LENGTH),
          })),
        })
      );
    },
    async replyInConversation({ topic, messages }) {
      return provider.complete(
        buildClarificationMessages({
          topic: clamp(topic, MAX_TOPIC_LENGTH),
          messages: messages.map((message) => ({
            ...message,
            content: clamp(message.content, MAX_MESSAGE_LENGTH),
          })),
        })
      );
    },
    async generateBrief(input) {
      const parsed = await requestStructuredJson({
        provider,
        messages: buildBriefMessages({
          topic: clamp(input.topic, MAX_TOPIC_LENGTH),
          messages: input.messages.map((message) => ({
            ...message,
            content: clamp(message.content, MAX_MESSAGE_LENGTH),
          })),
        }),
        validate: isBriefShape,
      });

      return normalizeBrief(parsed, input.topic);
    },
    async generateDraft(input) {
      const parsed = await requestStructuredJson({
        provider,
        messages: buildDraftMessages({
          topic: clamp(input.topic, MAX_TOPIC_LENGTH),
          brief: input.brief,
          messages: input.messages.map((message) => ({
            ...message,
            content: clamp(message.content, MAX_MESSAGE_LENGTH),
          })),
          historicalContext: input.historicalContext,
          research: input.research,
        }),
        validate: isDraftShape,
      });

      return normalizeDraft(parsed, input.topic);
    },
    async analyzeDraft(input) {
      const parsed = await requestStructuredJson({
        provider,
        messages: buildAnalyzeMessages({
          topic: clamp(input.topic, MAX_TOPIC_LENGTH),
          brief: input.brief as unknown as Record<string, unknown>,
          draft: input.draft as unknown as Record<string, unknown>,
          historicalContext: input.historicalContext,
          research: input.research as unknown as Record<string, unknown> | null | undefined,
        }),
        validate: isAnalysisShape,
      });

      return normalizeAnalysis(parsed);
    },
    async rewriteDraft(input) {
      const parsed = await requestStructuredJson({
        provider,
        messages: buildRewriteMessages({
          topic: clamp(input.topic, MAX_TOPIC_LENGTH),
          brief: input.brief,
          draft: input.draft,
          action: input.action,
          selectedText: input.selectedText,
          historicalContext: input.historicalContext,
          research: input.research,
        }),
        validate: isRewriteShape,
      });

      return normalizeRewriteProposal(parsed, input.action);
    },
  };
}
