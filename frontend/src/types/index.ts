export interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  body?: string;
  category?: Category;
  tags?: Tag[];
  featuredImage?: string | null;
  status?: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  readingTime?: number;
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImage?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  postCount?: number;
  _count?: { posts: number };
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
  _count?: { posts: number };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  thumbnail?: string | null;
  liveUrl?: string | null;
  githubUrl?: string | null;
  featured: boolean;
  order?: number;
}

export interface SkillGroup {
  category: string;
  skills: {
    name: string;
    level: "expert" | "proficient" | "familiar";
  }[];
}

export interface SiteConfig {
  title: string;
  tagline: string;
  description: string;
  authorName: string;
  logoUrl?: string;
  socialLinks: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    email?: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface AiConversationListItem {
  id: string;
  title: string;
  topic: string;
  status: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationListResponse {
  items: AiConversationListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface AiMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiBrief {
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

export interface AiOutlineItem {
  heading: string;
  points: string[];
}

export interface AiFaqItem {
  question: string;
  answer: string;
}

export interface AiDraftOutput {
  title: string;
  slug: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  ogImagePrompt: string;
  categorySuggestion: string;
  tagSuggestions: string[];
  outline: AiOutlineItem[];
  contentHtml: string;
  faq: AiFaqItem[];
  seoScore: number;
  engagementScore: number;
  readabilityScore: number;
  recommendations: string[];
  verificationNotes: string[];
  verificationFlags: AiVerificationFlag[];
  engagementInsights: string[];
  internalLinkSuggestions: AiInternalLinkSuggestion[];
  researchUsed: boolean;
  referencesEnabled?: boolean;
  postId?: string | null;
  status?: string;
}

export interface AiVerificationFlag {
  claim: string;
  status: "supported" | "general" | "needs_verification" | "risky";
  sourceId?: string | null;
  recommendation: string;
  reviewStatus?: "pending" | "accepted" | "soften" | "remove";
  reviewNotes?: string;
}

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
  approvalStatus: "approved" | "rejected" | "needs_review";
  adminNotes: string;
  includeInReferences?: boolean;
}

export interface AiResearchRun {
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
  draftPatch: Partial<AiDraftOutput>;
  status?: "proposed" | "applied" | "rejected";
  createdAt?: string;
  updatedAt?: string;
}

export interface AiUsageEvent {
  id: string;
  operation: string;
  provider: string;
  model: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  success: boolean;
  errorMessage: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiUsageSummary {
  totalCalls: number;
  totalTokens: number;
  estimatedCostUsd: number;
  failures: number;
  avgLatencyMs: number;
}

export interface AiOpsDashboard {
  windowDays: number;
  totalCalls: number;
  failures: number;
  successRate: number;
  totalTokens: number;
  estimatedCostUsd: number;
  previousPeriodCostUsd: number;
  avgLatencyMs: number;
  totalConversations: number;
  archivedConversations: number;
  alerts: Array<{
    level: "info" | "warning" | "critical";
    code: string;
    title: string;
    message: string;
  }>;
  dailyUsage: Array<{
    date: string;
    calls: number;
    failures: number;
    totalTokens: number;
    estimatedCostUsd: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    calls: number;
    failures: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
  }>;
  modelBreakdown: Array<{
    provider: string;
    model: string;
    calls: number;
    failures: number;
    totalTokens: number;
    estimatedCostUsd: number;
    avgLatencyMs: number;
  }>;
  topProviders: Array<{
    provider: string;
    calls: number;
    estimatedCostUsd: number;
  }>;
  topModels: Array<{
    provider: string;
    model: string;
    calls: number;
    estimatedCostUsd: number;
  }>;
  topOperations: Array<{
    operation: string;
    calls: number;
  }>;
  recentFailures: Array<{
    id: string;
    operation: string;
    provider: string;
    errorMessage: string;
    createdAt: string;
    conversationId: string | null;
    conversationLabel: string | null;
  }>;
}

export interface AiAlertSettings {
  webhookEnabled: boolean;
  telegramEnabled: boolean;
  minLevel: "info" | "warning" | "critical";
  cooldownMs: number;
  dailyDigestEnabled: boolean;
  webhookConfigured: boolean;
  telegramConfigured: boolean;
}

export interface AnalyticsDashboardData {
  totalViews: number;
  recentViews: number;
  topPages: { path: string; views: number }[];
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts?: number;
  totalProjects: number;
  aiOps: AiOpsDashboard;
}

export interface AiConversationDetail extends AiConversationListItem {
  messages: AiMessage[];
  brief: AiBrief | null;
  draft: AiDraftOutput | null;
  research: AiResearchRun | null;
  proposals: AiRewriteProposal[];
  usageEvents: AiUsageEvent[];
  usageSummary: AiUsageSummary;
  researchEnabled: boolean;
  researchMessage: string | null;
}
