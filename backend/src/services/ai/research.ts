import type {
  AiBriefData,
  AiConversationMessageInput,
  AiInternalLinkSuggestion,
  AiResearchData,
  AiResearchSource,
} from "./blog-studio";
import { buildResearchSynthesisMessages } from "./prompts";
import { requestStructuredJson } from "./json";
import {
  createAiChatProvider,
  getAiProviderConfig,
  type AiCompletionResult,
  type AiProviderConfig,
  type ResearchProviderName,
} from "./provider";

const MAX_RESEARCH_QUERY_LENGTH = 240;
const MAX_RESEARCH_SOURCES = 6;
const RESEARCH_TIMEOUT_MS = 12_000;

interface RawResearchSource {
  title: string;
  url: string;
  publisher: string;
  publishedDate: string | null;
  summary: string;
}

interface ResearchSynthesisShape {
  topicSummary: string;
  searchIntent: string;
  keywordIdeas: string[];
  relatedQuestions: string[];
  competitorNotes: string[];
  contentGaps: string[];
  internalLinkSuggestions: AiInternalLinkSuggestion[];
  riskFlags: string[];
  sources: AiResearchSource[];
}

export interface ResearchService {
  providerName: ResearchProviderName;
  isEnabled(): boolean;
  getUnavailableReason(): string | null;
  runResearch(input: {
    topic: string;
    brief: AiBriefData | null;
    messages: AiConversationMessageInput[];
    internalLinkSuggestions: AiInternalLinkSuggestion[];
  }): Promise<AiResearchData>;
}

export interface ResearchTelemetryEvent {
  operation: "research_synthesis";
  result: AiCompletionResult;
  attempt: number;
}

interface SearchProvider {
  readonly providerName: ResearchProviderName;
  isConfigured(): boolean;
  getUnavailableReason(): string | null;
  search(query: string): Promise<RawResearchSource[]>;
}

function clip(value: string | null | undefined, maxLength: number) {
  return (value || "").trim().slice(0, maxLength);
}

function normalizeStringArray(value: unknown, maxItems = 10, maxLength = 240) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeUsefulness(value: unknown): AiResearchSource["usefulness"] {
  switch (value) {
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      return "medium";
  }
}

function createSourceId(source: Pick<RawResearchSource, "url" | "title">, index: number) {
  const raw = (source.url || source.title || `source-${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return raw || `source-${index + 1}`;
}

function getPublisherFromUrl(url: string) {
  if (!url) return "";

  try {
    return new URL(url).hostname.replace(/^www\./i, "").slice(0, 120);
  } catch {
    return "";
  }
}

function normalizeSource(source: unknown, index: number, fallback?: Partial<RawResearchSource>): AiResearchSource {
  const record = (source && typeof source === "object" ? source : {}) as Record<string, unknown>;
  const normalized = {
    title: clip(typeof record.title === "string" ? record.title : fallback?.title, 220) || "Untitled source",
    url: clip(typeof record.url === "string" ? record.url : fallback?.url, 500),
    publisher: clip(typeof record.publisher === "string" ? record.publisher : fallback?.publisher, 120),
    publishedDate:
      typeof record.publishedDate === "string" && record.publishedDate.trim()
        ? record.publishedDate.trim().slice(0, 60)
        : fallback?.publishedDate || null,
    summary: clip(typeof record.summary === "string" ? record.summary : fallback?.summary, 500),
  };

  return {
    id: clip(typeof record.id === "string" ? record.id : createSourceId(normalized, index), 120) || `source-${index + 1}`,
    ...normalized,
    usefulness: normalizeUsefulness(record.usefulness),
    notes: normalizeStringArray(record.notes, 5, 180),
    approvalStatus:
      record.approvalStatus === "approved" || record.approvalStatus === "rejected" || record.approvalStatus === "needs_review"
        ? record.approvalStatus
        : "needs_review",
    adminNotes: clip(typeof record.adminNotes === "string" ? record.adminNotes : "", 500),
    includeInReferences: record.includeInReferences !== false,
  };
}

function normalizeInternalLinkSuggestions(value: unknown): AiInternalLinkSuggestion[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const record = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        postId: clip(typeof record.postId === "string" ? record.postId : "", 120),
        title: clip(typeof record.title === "string" ? record.title : "", 200),
        slug: clip(typeof record.slug === "string" ? record.slug : "", 220),
        anchorText: clip(typeof record.anchorText === "string" ? record.anchorText : "", 120),
        reason: clip(typeof record.reason === "string" ? record.reason : "", 240),
      };
    })
    .filter((item) => item.title && item.slug)
    .slice(0, 10);
}

function normalizeResearch(
  value: unknown,
  providerName: string,
  fallbackSources: RawResearchSource[],
  internalLinkSuggestions: AiInternalLinkSuggestion[]
): AiResearchData {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const rawSources = Array.isArray(record.sources) ? record.sources : [];
  const normalizedSources =
    rawSources.length > 0
      ? rawSources.slice(0, MAX_RESEARCH_SOURCES).map((source, index) => normalizeSource(source, index, fallbackSources[index]))
      : fallbackSources.map((source, index) =>
          normalizeSource(
            {
              ...source,
              usefulness: index < 2 ? "high" : "medium",
              notes: [
                source.summary
                  ? "Validate any dated or statistical claims before publishing."
                  : "Review the source directly before citing it.",
              ],
            },
            index,
            source
          )
        );

  return {
    provider: providerName,
    status: "completed",
    topicSummary: clip(typeof record.topicSummary === "string" ? record.topicSummary : "", 1000),
    searchIntent: clip(typeof record.searchIntent === "string" ? record.searchIntent : "", 500),
    keywordIdeas: normalizeStringArray(record.keywordIdeas, 12, 120),
    relatedQuestions: normalizeStringArray(record.relatedQuestions, 12, 200),
    competitorNotes: normalizeStringArray(record.competitorNotes, 10, 240),
    contentGaps: normalizeStringArray(record.contentGaps, 10, 240),
    sources: normalizedSources,
    internalLinkSuggestions: normalizeInternalLinkSuggestions(record.internalLinkSuggestions).length > 0
      ? normalizeInternalLinkSuggestions(record.internalLinkSuggestions)
      : internalLinkSuggestions,
    riskFlags: normalizeStringArray(record.riskFlags, 10, 240),
  };
}

function heuristicResearch(
  providerName: string,
  sources: RawResearchSource[],
  internalLinkSuggestions: AiInternalLinkSuggestion[]
): AiResearchData {
  const keywordIdeas = sources
    .flatMap((source) => source.title.split(/[^a-zA-Z0-9]+/))
    .map((term) => term.toLowerCase())
    .filter((term) => term.length > 3)
    .filter((term, index, array) => array.indexOf(term) === index)
    .slice(0, 8);

  return {
    provider: providerName,
    status: "completed",
    topicSummary: sources[0]?.summary || "Research completed. Review the source notes before publishing.",
    searchIntent: "Readers are likely looking for practical, current guidance and actionable examples.",
    keywordIdeas,
    relatedQuestions: [
      "What problem is the reader trying to solve first?",
      "Which tools or workflows are the most practical to compare?",
    ],
    competitorNotes: [
      "Top-ranking content often front-loads practical comparisons and clear takeaways.",
    ],
    contentGaps: [
      "Add concrete examples, caveats, and an opinionated recommendation instead of a generic overview.",
    ],
    sources: sources.map((source, index) =>
      normalizeSource(
        {
          ...source,
          usefulness: index < 2 ? "high" : "medium",
          notes: [
            source.publishedDate
              ? "Check that the source is still current before citing it."
              : "Publication date is unclear. Verify freshness before using specific claims.",
          ],
        },
        index,
        source
      )
    ),
    internalLinkSuggestions,
    riskFlags: [
      "Verify any statistics or vendor-specific claims directly from the source before publishing.",
    ],
  };
}

class DisabledResearchProvider implements SearchProvider {
  readonly providerName = "disabled" as const;

  isConfigured() {
    return false;
  }

  getUnavailableReason() {
    return "Live research is disabled. Draft generation can still continue using best-practice guidance only.";
  }

  async search(): Promise<RawResearchSource[]> {
    return [];
  }
}

class MockResearchProvider implements SearchProvider {
  readonly providerName = "mock" as const;

  isConfigured() {
    return true;
  }

  getUnavailableReason() {
    return null;
  }

  async search(query: string): Promise<RawResearchSource[]> {
    const topic = clip(query, 120) || "AI workflow";
    return [
      {
        title: `${topic}: operator guide`,
        url: "https://example.com/research/operator-guide",
        publisher: "Example Research",
        publishedDate: "2026-01-15",
        summary: "Covers current operator expectations, common pitfalls, and decision criteria.",
      },
      {
        title: `${topic}: comparison roundup`,
        url: "https://example.com/research/comparison-roundup",
        publisher: "Example Editorial",
        publishedDate: null,
        summary: "Highlights how comparison-style content tends to structure pros, cons, and practical use cases.",
      },
    ];
  }
}

class ExaResearchProvider implements SearchProvider {
  readonly providerName = "exa" as const;

  constructor(private readonly config: AiProviderConfig) {}

  isConfigured() {
    return Boolean(this.config.researchApiKey);
  }

  getUnavailableReason() {
    if (this.isConfigured()) return null;
    return "Research provider is not configured. Set RESEARCH_PROVIDER=exa and add RESEARCH_API_KEY.";
  }

  async search(query: string): Promise<RawResearchSource[]> {
    if (!this.isConfigured()) {
      throw new Error(this.getUnavailableReason() || "Research provider is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEARCH_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.researchApiKey!,
        },
        body: JSON.stringify({
          query: clip(query, MAX_RESEARCH_QUERY_LENGTH),
          numResults: MAX_RESEARCH_SOURCES,
          useAutoprompt: true,
          type: "auto",
          contents: {
            text: {
              maxCharacters: 1200,
            },
            summary: {
              query: "Summarize the key point of this result for an editor.",
            },
          },
        }),
        signal: controller.signal,
      });

      const rawText = await response.text();
      const data = rawText ? JSON.parse(rawText) : {};
      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : `Research request failed with status ${response.status}`;
        throw new Error(message);
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      return results.slice(0, MAX_RESEARCH_SOURCES).map((result: Record<string, unknown>) => ({
        title: clip(typeof result.title === "string" ? result.title : "", 220) || "Untitled source",
        url: clip(typeof result.url === "string" ? result.url : "", 500),
        publisher: clip(
          typeof result.author === "string"
            ? result.author
            : typeof result.publisher === "string"
              ? result.publisher
              : typeof result.domain === "string"
                ? result.domain
                : getPublisherFromUrl(typeof result.url === "string" ? result.url : ""),
          120
        ),
        publishedDate: typeof result.publishedDate === "string" && result.publishedDate.trim() ? result.publishedDate : null,
        summary: clip(
          typeof result.summary === "string"
            ? result.summary
            : typeof result.text === "string"
              ? result.text
              : "",
          500
        ),
      }));
    } finally {
      clearTimeout(timeout);
    }
  }
}

function createSearchProvider(config: AiProviderConfig): SearchProvider {
  switch (config.researchProvider) {
    case "mock":
      return new MockResearchProvider();
    case "exa":
      return new ExaResearchProvider(config);
    case "disabled":
    default:
      return new DisabledResearchProvider();
  }
}

function buildResearchQuery(topic: string, brief: AiBriefData | null) {
  return [topic, brief?.primaryKeyword, brief?.audience, brief?.contentType]
    .filter(Boolean)
    .join(" | ")
    .slice(0, MAX_RESEARCH_QUERY_LENGTH);
}

function isResearchShape(value: unknown): value is ResearchSynthesisShape {
  return Boolean(value && typeof value === "object");
}

export function createResearchService(config = getAiProviderConfig()): ResearchService {
  return createResearchServiceWithOptions({ config });
}

export function createResearchServiceWithOptions({
  config = getAiProviderConfig(),
  onTelemetry,
}: {
  config?: AiProviderConfig;
  onTelemetry?: (event: ResearchTelemetryEvent) => void | Promise<void>;
} = {}): ResearchService {
  const searchProvider = createSearchProvider(config);
  const aiProvider = createAiChatProvider(config);

  return {
    providerName: searchProvider.providerName,
    isEnabled() {
      return searchProvider.isConfigured();
    },
    getUnavailableReason() {
      return searchProvider.getUnavailableReason();
    },
    async runResearch({ topic, brief, messages, internalLinkSuggestions }) {
      if (!searchProvider.isConfigured()) {
        return {
          provider: searchProvider.providerName,
          status: "disabled",
          topicSummary: "Live research is disabled. The draft can still be generated from the approved brief and best-practice guidance.",
          searchIntent: "",
          keywordIdeas: [],
          relatedQuestions: [],
          competitorNotes: [],
          contentGaps: [],
          sources: [],
          internalLinkSuggestions,
          riskFlags: [],
        };
      }

      const query = buildResearchQuery(topic, brief);
      const rawSources = await searchProvider.search(query);

      if (!aiProvider.isConfigured()) {
        return heuristicResearch(searchProvider.providerName, rawSources, internalLinkSuggestions);
      }

      const synthesized = await requestStructuredJson({
        provider: aiProvider,
        messages: buildResearchSynthesisMessages({
          topic,
          brief,
          transcript: messages,
          rawSources,
          internalLinkSuggestions,
        }),
        validate: isResearchShape,
        onAttempt: async (result, attempt) => {
          await onTelemetry?.({ operation: "research_synthesis", result, attempt });
        },
      });

      return normalizeResearch(synthesized, searchProvider.providerName, rawSources, internalLinkSuggestions);
    },
  };
}
