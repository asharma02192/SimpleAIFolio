"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider, logoutAdmin, useAuth } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import { UIProvider, useUI } from "@/components/admin/Toast";
import type {
  AiBrief,
  AiConversationDetail,
  AiConversationListItem,
  AiConversationListResponse,
  AiResearchSource,
  AiRewriteAction,
  AiRewriteProposal,
  AiVerificationFlag,
} from "@/types";

const emptyBrief: AiBrief = {
  topic: "",
  audience: "",
  goal: "",
  tone: "",
  primaryKeyword: "",
  secondaryKeywords: [],
  wordCount: 1600,
  contentType: "guide",
  cta: "",
  notes: "",
  approvedAt: null,
};

const inputStyle = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text)",
};

const panelShellStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(15, 23, 42, 0.04)",
};

const panelInsetStyle = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
};


const rewriteActions: Array<{ action: AiRewriteAction; label: string }> = [
  { action: "improve_intro", label: "Improve intro" },
  { action: "stronger_title", label: "Make title stronger" },
  { action: "seo_focus", label: "Make it more SEO-focused" },
  { action: "more_human", label: "Make it more human" },
  { action: "add_examples", label: "Add examples" },
  { action: "add_faq", label: "Add FAQ section" },
  { action: "improve_cta", label: "Improve CTA" },
  { action: "shorten", label: "Shorten content" },
  { action: "expand", label: "Expand content" },
  { action: "improve_readability", label: "Improve readability" },
];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toBriefForm(brief: AiBrief | null, topic: string): AiBrief {
  return {
    ...emptyBrief,
    ...(brief || {}),
    topic: brief?.topic || topic,
    primaryKeyword: brief?.primaryKeyword || topic,
    secondaryKeywords: Array.isArray(brief?.secondaryKeywords) ? brief.secondaryKeywords : [],
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

function safeReferenceUrl(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return value.trim();
  }
  return "#";
}

function ensureStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ensureNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeConversationListItem(conversation: Partial<AiConversationListItem>): AiConversationListItem {
  return {
    id: typeof conversation.id === "string" ? conversation.id : "",
    title: typeof conversation.title === "string" ? conversation.title : "Untitled conversation",
    topic: typeof conversation.topic === "string" ? conversation.topic : "",
    status: typeof conversation.status === "string" ? conversation.status : "active",
    archivedAt: typeof conversation.archivedAt === "string" ? conversation.archivedAt : null,
    createdAt: typeof conversation.createdAt === "string" ? conversation.createdAt : new Date(0).toISOString(),
    updatedAt: typeof conversation.updatedAt === "string" ? conversation.updatedAt : new Date(0).toISOString(),
  };
}

function normalizeResearchSource(source: Partial<AiResearchSource>): AiResearchSource {
  const approvalStatus =
    source.approvalStatus === "approved" || source.approvalStatus === "rejected" || source.approvalStatus === "needs_review"
      ? source.approvalStatus
      : "needs_review";

  return {
    id: typeof source.id === "string" ? source.id : crypto.randomUUID(),
    title: typeof source.title === "string" ? source.title : "Untitled source",
    url: typeof source.url === "string" ? source.url : "",
    publisher: typeof source.publisher === "string" ? source.publisher : "",
    publishedDate: typeof source.publishedDate === "string" ? source.publishedDate : null,
    summary: typeof source.summary === "string" ? source.summary : "",
    usefulness: source.usefulness === "high" || source.usefulness === "medium" || source.usefulness === "low" ? source.usefulness : "medium",
    notes: ensureStringArray(source.notes),
    approvalStatus,
    adminNotes: typeof source.adminNotes === "string" ? source.adminNotes : "",
    includeInReferences: source.includeInReferences !== false,
  };
}

function normalizeConversationDetail(conversation: AiConversationDetail): AiConversationDetail {
  const base = normalizeConversationListItem(conversation);
  const brief = conversation.brief
    ? {
        ...emptyBrief,
        ...conversation.brief,
        secondaryKeywords: ensureStringArray(conversation.brief.secondaryKeywords),
      }
    : null;

  const draft = conversation.draft
    ? {
        ...conversation.draft,
        tagSuggestions: ensureStringArray(conversation.draft.tagSuggestions),
        outline: Array.isArray(conversation.draft.outline) ? conversation.draft.outline : [],
        faq: Array.isArray(conversation.draft.faq) ? conversation.draft.faq : [],
        recommendations: ensureStringArray(conversation.draft.recommendations),
        verificationNotes: ensureStringArray(conversation.draft.verificationNotes),
        verificationFlags: Array.isArray(conversation.draft.verificationFlags) ? conversation.draft.verificationFlags : [],
        engagementInsights: ensureStringArray(conversation.draft.engagementInsights),
        internalLinkSuggestions: Array.isArray(conversation.draft.internalLinkSuggestions)
          ? conversation.draft.internalLinkSuggestions
          : [],
        researchUsed: Boolean(conversation.draft.researchUsed),
        referencesEnabled: Boolean(conversation.draft.referencesEnabled),
      }
    : null;

  const research = conversation.research
    ? {
        ...conversation.research,
        keywordIdeas: ensureStringArray(conversation.research.keywordIdeas),
        relatedQuestions: ensureStringArray(conversation.research.relatedQuestions),
        competitorNotes: ensureStringArray(conversation.research.competitorNotes),
        contentGaps: ensureStringArray(conversation.research.contentGaps),
        sources: Array.isArray(conversation.research.sources)
          ? conversation.research.sources.map((source) => normalizeResearchSource(source))
          : [],
        internalLinkSuggestions: Array.isArray(conversation.research.internalLinkSuggestions)
          ? conversation.research.internalLinkSuggestions
          : [],
        riskFlags: ensureStringArray(conversation.research.riskFlags),
      }
    : null;

  return {
    ...base,
    messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    brief,
    draft,
    research,
    proposals: Array.isArray(conversation.proposals) ? conversation.proposals : [],
    usageEvents: Array.isArray(conversation.usageEvents) ? conversation.usageEvents : [],
    usageSummary: {
      totalCalls: ensureNumber(conversation.usageSummary?.totalCalls),
      totalTokens: ensureNumber(conversation.usageSummary?.totalTokens),
      estimatedCostUsd: ensureNumber(conversation.usageSummary?.estimatedCostUsd),
      failures: ensureNumber(conversation.usageSummary?.failures),
      avgLatencyMs: ensureNumber(conversation.usageSummary?.avgLatencyMs),
    },
    researchEnabled: Boolean(conversation.researchEnabled),
    researchMessage: typeof conversation.researchMessage === "string" ? conversation.researchMessage : null,
  };
}

function getSourceWarnings(source: AiResearchSource) {
  const warnings: string[] = [];
  if (source.usefulness === "low") {
    warnings.push("Low usefulness for final references.");
  }
  if (!source.publishedDate) {
    warnings.push("Publication date is unclear.");
  } else {
    const ageDays = (Date.now() - new Date(source.publishedDate).getTime()) / (1000 * 60 * 60 * 24);
    if (Number.isFinite(ageDays) && ageDays > 730) {
      warnings.push("Source may be stale.");
    }
  }
  if (safeReferenceUrl(source.url) === "#") {
    warnings.push("Unsafe URL will be blocked from references.");
  }
  return warnings;
}

function buildSelectedTextForRewrite(
  mode: "auto" | "title" | "excerpt" | "intro" | "faq" | "custom",
  detail: AiConversationDetail | null,
  customText: string
) {
  if (!detail?.draft) return customText.trim() || null;

  switch (mode) {
    case "title":
      return detail.draft.title;
    case "excerpt":
      return detail.draft.excerpt;
    case "intro":
      return detail.draft.contentHtml.split("</p>")[0]?.replace(/<[^>]*>/g, "").trim() || null;
    case "faq":
      return detail.draft.faq.map((item) => `${item.question}\n${item.answer}`).join("\n\n") || null;
    case "custom":
      return customText.trim() || null;
    case "auto":
    default:
      return null;
  }
}

type WizardStep = 1 | 2 | 3;

const STEP_META: Array<{ label: string; description: string }> = [
  { label: "Create", description: "Define your topic" },
  { label: "Brief", description: "Review the brief" },
  { label: "Draft", description: "Edit and publish" },
];

/* ── Collapsible section toggle ── */
function ChevronRight({ open }: { open: boolean }) {
  return (
    <span
      className="inline-block text-[0.75rem] transition-transform"
      style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", color: "var(--color-text-tertiary)" }}
    >
      ▸
    </span>
  );
}

function WriterContent() {
  const { token } = useAuth();
  const router = useRouter();
  const { toast } = useUI();

  /* ── Core state ── */
  const [conversations, setConversations] = useState<AiConversationListItem[]>([]);
  const [listPage, setListPage] = useState(1);
  const [listHasMore, setListHasMore] = useState(false);
  const [listTotal, setListTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AiConversationDetail | null>(null);
  const [briefForm, setBriefForm] = useState<AiBrief>(emptyBrief);
  const [topicInput, setTopicInput] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [, setLoadingDetail] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rewriteProposal, setRewriteProposal] = useState<AiRewriteProposal | null>(null);
  const [sourceForm, setSourceForm] = useState<AiResearchSource[]>([]);
  const [includeReferences, setIncludeReferences] = useState(false);
  const [listFilter, setListFilter] = useState<"active" | "archived" | "all">("active");
  const [listSearch, setListSearch] = useState("");
  const [rewriteFocusMode, setRewriteFocusMode] = useState<"auto" | "title" | "excerpt" | "intro" | "faq" | "custom">("auto");
  const [rewriteSelectedText, setRewriteSelectedText] = useState("");
  const [busy, setBusy] = useState<null | "create" | "message" | "brief" | "approve" | "research" | "draft" | "analyze" | "rewrite" | "applyRewrite" | "save" | "archive" | "delete" | "reviewFlags" | "internalLink">(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /* ── Wizard state ── */
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [showAdvancedBrief, setShowAdvancedBrief] = useState(false);
  const [showResearchPanel, setShowResearchPanel] = useState(false);
  const [showAiUsage, setShowAiUsage] = useState(false);
  const [showReviewFlags, setShowReviewFlags] = useState(false);
  const [showRewriteActions, setShowRewriteActions] = useState(false);
  const [showInternalLinks, setShowInternalLinks] = useState(false);

  const syncList = useCallback((conversation: AiConversationDetail) => {
    setConversations((current) => {
      const item = normalizeConversationListItem(conversation);
      const next = [item, ...current.filter((entry) => entry.id !== item.id)];
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, []);

  const loadList = useCallback(async (opts?: { page?: number; append?: boolean }) => {
    const page = opts?.page ?? 1;
    const append = opts?.append ?? false;
    if (page === 1) setLoadingList(true);
    try {
      const filterParam = listFilter;
      const searchParam = listSearch;
      const response = await adminApiRequest<AiConversationListResponse>(
        `/api/admin/ai/conversations?filter=${filterParam}&page=${page}&pageSize=25&search=${encodeURIComponent(searchParam)}`
      );
      const items = (response.items || []).map(normalizeConversationListItem);
      setConversations(append ? (current) => [...current, ...items] : items);
      setListTotal(response.total || 0);
      setListHasMore(response.hasMore || false);
      setListPage(page);
      // Always start fresh — don't auto-select previous conversations
      // User explicitly opens the drawer to revisit old conversations
    } catch (error) {
      const message = getAdminErrorMessage(error, "Failed to load conversations.");
      setPageError(message);
    } finally {
      setLoadingList(false);
    }
  }, [listFilter, listSearch, selectedId]);

  const loadDetail = useCallback(async (conversationId: string) => {
    setLoadingDetail(true);
    setActionError(null);
    try {
      const response = await adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${conversationId}`);
      const next = normalizeConversationDetail(response);
      setDetail(next);
      setBriefForm(toBriefForm(next.brief, next.topic));
      setSourceForm(next.research?.sources || []);
      setIncludeReferences(Boolean(next.draft?.referencesEnabled));
      setRewriteProposal(null);
      setRewriteSelectedText("");
      setRewriteFocusMode("auto");
      syncList(next);
      // Auto-select step based on conversation state
      if (next.draft?.contentHtml) {
        setCurrentStep(3);
      } else if (next.brief) {
        setCurrentStep(2);
      } else {
        setCurrentStep(1);
      }
    } catch (error) {
      const message = getAdminErrorMessage(error, "Failed to load the AI conversation.");
      setActionError(message);
      toast(message, "error");
    } finally {
      setLoadingDetail(false);
    }
  }, [syncList, toast]);

  useEffect(() => {
    if (!token) return;
    const timeoutId = window.setTimeout(() => {
      void loadList();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      const timeoutId = window.setTimeout(() => {
        setDetail(null);
        setBriefForm(emptyBrief);
        setSourceForm([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    if (selectedId === detail?.id) return;
    const timeoutId2 = window.setTimeout(() => {
      void loadDetail(selectedId);
    }, 0);
    return () => window.clearTimeout(timeoutId2);
  }, [loadDetail, selectedId, detail?.id]);

  const runAction = useCallback(async <T,>(name: NonNullable<typeof busy>, action: () => Promise<T>) => {
    if (busy) return null;
    setBusy(name);
    setActionError(null);
    try {
      return await action();
    } catch (error) {
      const message = getAdminErrorMessage(error, "AI Blog Studio request failed.");
      setActionError(message);
      toast(message, "error");
      return null;
    } finally {
      setBusy(null);
    }
  }, [busy, toast]);

  const createConversation = async () => {
    const topic = topicInput.trim();
    if (!topic) return;

    // Reuse existing conversation with the same topic instead of creating duplicates
    const existing = conversations.find(
      (c) => c.topic.toLowerCase() === topic.toLowerCase()
    );
    if (existing) {
      setTopicInput("");
      setSelectedId(existing.id);
      setMobileSidebarOpen(false);
      toast("Opened existing conversation", "success");
      return;
    }

    const next = await runAction("create", () =>
      adminApiRequest<AiConversationDetail>("/api/admin/ai/conversations", {
        method: "POST",
        body: JSON.stringify({ topic }),
      })
    );
    if (!next) return;
    setTopicInput("");
    setSelectedId(next.id);
    setDetail(next);
    setBriefForm(toBriefForm(next.brief, next.topic));
    setSourceForm(next.research?.sources || []);
    setIncludeReferences(false);
    setRewriteProposal(null);
    syncList(next);
    setListTotal((current) => current + 1);
    toast("AI conversation started", "success");
  };

  const refreshFromEndpoint = async (path: string, method: "POST" | "PUT", body?: unknown) => {
    if (!detail) return;
    const next = await runAction(
      path.includes("save-draft") ? "save" :
      path.includes("/research") ? "research" :
      path.includes("analyze") ? "analyze" :
      path.includes("/draft") ? "draft" :
      path.includes("/brief") && method === "PUT" ? "approve" :
      path.includes("/brief") ? "brief" : "message",
      () => adminApiRequest<AiConversationDetail | { postId: string; editUrl: string }>(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    );
    if (!next) return;
    if ("editUrl" in next) {
      toast("Saved as CMS draft", "success");
      router.push(next.editUrl);
      router.refresh();
      return;
    }
    const normalized = normalizeConversationDetail(next);
    setRewriteProposal(null);
    if (path.includes("/message")) {
      setMessageInput("");
      toast("Message sent", "success");
    } else if (path.endsWith("/brief") && method === "POST") {
      toast("Content brief generated", "success");
      setCurrentStep(2);
    } else if (path.endsWith("/brief") && method === "PUT") {
      toast("Brief saved and approved", "success");
      setCurrentStep(3);
    } else if (path.endsWith("/research")) {
      toast(normalized.research?.status === "disabled" ? "Research unavailable. Using brief-only mode." : "Research notes updated", normalized.research?.status === "disabled" ? "info" : "success");
    } else if (path.endsWith("/draft")) {
      toast("Draft generated", "success");
      setCurrentStep(3);
    } else if (path.endsWith("/analyze")) {
      toast("Draft analysis refreshed", "success");
    }
    setDetail(normalized);
    setBriefForm(toBriefForm(normalized.brief, normalized.topic));
    setSourceForm(normalized.research?.sources || []);
    syncList(normalized);
  };

  const requestRewrite = async (action: AiRewriteAction) => {
    if (!detail?.draft) return;
    const selectedText = buildSelectedTextForRewrite(rewriteFocusMode, detail, rewriteSelectedText);
    const next = await runAction("rewrite", () =>
      adminApiRequest<{ proposal: AiRewriteProposal }>(`/api/admin/ai/conversations/${detail.id}/rewrite`, {
        method: "POST",
        body: JSON.stringify({ action, selectedText }),
      })
    );
    if (!next) return;
    setRewriteProposal(next.proposal);
    toast("Rewrite proposal ready", "success");
  };

  const applyRewrite = async () => {
    if (!detail || !rewriteProposal?.id) return;
    const next = await runAction("applyRewrite", () =>
      adminApiRequest<{ detail: AiConversationDetail; proposal: AiRewriteProposal }>(`/api/admin/ai/conversations/${detail.id}/rewrite/${rewriteProposal.id}/apply`, {
        method: "POST",
      })
    );
    if (!next) return;
    setDetail(next.detail);
    setBriefForm(toBriefForm(next.detail.brief, next.detail.topic));
    setSourceForm(next.detail.research?.sources || []);
    setRewriteProposal(null);
    syncList(next.detail);
    toast("Rewrite applied to draft", "success");
  };

  const rejectRewrite = async (proposalId: string) => {
    if (!detail) return;
    const next = await runAction("rewrite", () =>
      adminApiRequest<{ detail: AiConversationDetail; proposal: AiRewriteProposal }>(`/api/admin/ai/conversations/${detail.id}/rewrite/${proposalId}/reject`, {
        method: "POST",
      })
    );
    if (!next) return;
    setDetail(next.detail);
    setSourceForm(next.detail.research?.sources || []);
    if (rewriteProposal?.id === proposalId) {
      setRewriteProposal(null);
    }
    syncList(next.detail);
    toast("Rewrite proposal rejected", "success");
  };

  const saveSourceReview = async () => {
    if (!detail) return;
    const next = await runAction("research", () =>
      adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${detail.id}/research`, {
        method: "PUT",
        body: JSON.stringify({
          sources: sourceForm.map((source) => ({
            id: source.id,
            approvalStatus: source.approvalStatus,
            adminNotes: source.adminNotes,
            includeInReferences: source.includeInReferences,
          })),
        }),
      })
    );
    if (!next) return;
    setDetail(next);
    setSourceForm(next.research?.sources || []);
    syncList(next);
    toast("Source review saved", "success");
  };

  const updateVerificationFlags = async () => {
    if (!detail?.draft) return;
    const next = await runAction("reviewFlags", () =>
      adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${detail.id}/draft-review`, {
        method: "PUT",
        body: JSON.stringify({
          verificationFlags: detail.draft?.verificationFlags || [],
        }),
      })
    );
    if (!next) return;
    setDetail(next);
    syncList(next);
    toast("Verification review updated", "success");
  };

  const applyInternalLinkSuggestion = async (suggestionIndex: number) => {
    if (!detail?.draft) return;
    const next = await runAction("internalLink", () =>
      adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${detail.id}/internal-link`, {
        method: "POST",
        body: JSON.stringify({ suggestionIndex }),
      })
    );
    if (!next) return;
    setDetail(next);
    syncList(next);
    toast("Internal link applied", "success");
  };

  const setVerificationReviewField = (
    flagIndex: number,
    field: "reviewStatus" | "reviewNotes",
    value: string
  ) => {
    setDetail((current) => {
      if (!current?.draft) return current;
      const nextFlags = [...current.draft.verificationFlags];
      nextFlags[flagIndex] = {
        ...nextFlags[flagIndex],
        [field]: value,
      } as AiVerificationFlag;
      return {
        ...current,
        draft: {
          ...current.draft,
          verificationFlags: nextFlags,
        },
      };
    });
  };

  const archiveConversation = async (conversationId: string, archived: boolean) => {
    const next = await runAction("archive", () =>
      adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${conversationId}/archive`, {
        method: "POST",
        body: JSON.stringify({ archived }),
      })
    );
    if (!next) return;
    if (selectedId === conversationId) {
      setDetail(next);
    }
    syncList(next);
    if (archived && listFilter === "active") {
      void loadList({ page: 1 });
      if (selectedId === conversationId) {
        setSelectedId(null);
      }
    }
    if (!archived && listFilter === "archived") {
      void loadList({ page: 1 });
      if (selectedId === conversationId) {
        setSelectedId(null);
      }
    }
    toast(archived ? "Conversation archived" : "Conversation restored", "success");
  };

  const deleteConversation = async (conversationId: string) => {
    const ok = window.confirm("Delete this AI conversation and all generated artifacts?");
    if (!ok) return;
    const result = await runAction("delete", async () => {
      await adminApiRequest<void>(`/api/admin/ai/conversations/${conversationId}`, {
        method: "DELETE",
      });
      return true;
    });
    if (!result) return;
    setConversations((current) => current.filter((item) => item.id !== conversationId));
    setListTotal((current) => Math.max(0, current - 1));
    if (selectedId === conversationId) {
      setSelectedId(null);
      setDetail(null);
    }
    toast("Conversation deleted", "success");
  };

  /* ── Derived state ── */
  const research = useMemo(() => {
    if (!detail?.research) return null;
    return {
      ...detail.research,
      keywordIdeas: ensureStringArray(detail.research.keywordIdeas),
      relatedQuestions: ensureStringArray(detail.research.relatedQuestions),
      competitorNotes: ensureStringArray(detail.research.competitorNotes),
      contentGaps: ensureStringArray(detail.research.contentGaps),
      sources: Array.isArray(detail.research.sources) ? detail.research.sources : [],
      internalLinkSuggestions: Array.isArray(detail.research.internalLinkSuggestions)
        ? detail.research.internalLinkSuggestions
        : [],
      riskFlags: ensureStringArray(detail.research.riskFlags),
    };
  }, [detail]);
  const draft = useMemo(() => {
    if (!detail?.draft) return null;
    return {
      ...detail.draft,
      tagSuggestions: ensureStringArray(detail.draft.tagSuggestions),
      outline: Array.isArray(detail.draft.outline) ? detail.draft.outline : [],
      faq: Array.isArray(detail.draft.faq) ? detail.draft.faq : [],
      recommendations: ensureStringArray(detail.draft.recommendations),
      verificationNotes: ensureStringArray(detail.draft.verificationNotes),
      verificationFlags: Array.isArray(detail.draft.verificationFlags) ? detail.draft.verificationFlags : [],
      engagementInsights: ensureStringArray(detail.draft.engagementInsights),
      internalLinkSuggestions: Array.isArray(detail.draft.internalLinkSuggestions)
        ? detail.draft.internalLinkSuggestions
        : [],
    };
  }, [detail]);
  const proposals = useMemo(
    () => (Array.isArray(detail?.proposals) ? detail.proposals : []),
    [detail]
  );
  const briefApproved = Boolean(detail?.brief?.approvedAt);
  const approvedSources = useMemo(
    () =>
      sourceForm.filter(
        (source) =>
          source.approvalStatus === "approved"
          && source.includeInReferences !== false
          && safeReferenceUrl(source.url) !== "#"
      ),
    [sourceForm]
  );
  const referencePreviewHtml = useMemo(() => {
    if (!includeReferences || approvedSources.length === 0) return "";
    const items = approvedSources
      .map((source) => `<li><a href="${safeReferenceUrl(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`)
      .join("");
    return `<h2>References</h2><ul>${items}</ul>`;
  }, [approvedSources, includeReferences]);
  const riskyFlags = draft?.verificationFlags.filter((flag) => flag.status === "risky") || [];
  const visibleConversationCount = conversations.length;
  const approvedSourceCount = sourceForm.filter((source) => source.approvalStatus === "approved").length;

  const stepCompletion = useMemo(() => ({
    step1: Boolean(detail?.brief),
    step2: briefApproved,
    step3: Boolean(draft?.contentHtml),
  }), [detail?.brief, briefApproved, draft?.contentHtml]);

  const canGoToStep = (step: WizardStep) => {
    if (step === 1) return true;
    if (step === 2) return stepCompletion.step1;
    if (step === 3) return stepCompletion.step2;
    return false;
  };

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="admin-main flex min-h-screen" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main id="main" className="flex-1 overflow-x-hidden p-[var(--space-4)] sm:px-[var(--space-5)] sm:py-[var(--space-6)] lg:px-[var(--space-8)]">
        {/* ── Page header ── */}
        <section className="mb-[var(--space-8)]">
          <div className="flex flex-col items-start justify-between gap-[var(--space-4)] sm:flex-row sm:items-center">
            <div>
              <p
                className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.24em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                AI Blog Studio
              </p>
              <h1
                className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2.5rem)] font-semibold leading-tight"
                style={{ color: "var(--color-text)" }}
              >
                Create a Blog Post
              </h1>
              <p
                className="mt-[var(--space-3)] max-w-[74ch] text-[var(--text-sm)] leading-relaxed sm:text-[var(--text-base)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Start with a topic, review the AI-generated brief, then generate and save your draft.
              </p>
            </div>
            <div className="flex items-center gap-[var(--space-2)] pt-[var(--space-4)]">
              {selectedId && detail && (
                <span className="rounded-full px-3 py-1 text-[var(--text-xs)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
                  {detail.title.length > 30 ? detail.title.slice(0, 30) + "…" : detail.title}
                </span>
              )}
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((prev) => !prev)}
                className="inline-flex min-h-[40px] items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors"
                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                ☰ {listTotal > 0 ? `${listTotal}` : ""}
              </button>
            </div>
          </div>
        </section>

        {/* ── Step progress indicator ── */}
        <nav aria-label="Wizard progress" className="mb-[var(--space-8)]">
          <ol className="flex items-start gap-0">
            {([1, 2, 3] as const).map((step, i) => {
              const isComplete = step === 1 ? stepCompletion.step1 : step === 2 ? stepCompletion.step2 : stepCompletion.step3;
              const isCurrent = currentStep === step;
              const isLast = i === 2;
              return (
                <li key={step} className={`flex items-start ${isLast ? "flex-1" : "flex-1"}`}>
                  <button
                    type="button"
                    onClick={() => { if (canGoToStep(step)) setCurrentStep(step); }}
                    disabled={!canGoToStep(step)}
                    className="flex w-full items-start gap-[var(--space-3)] text-left disabled:cursor-not-allowed"
                  >
                    {/* Circle */}
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-sm)] font-semibold transition-colors"
                      style={{
                        background: isComplete
                          ? "var(--color-accent)"
                          : isCurrent
                            ? "var(--color-bg)"
                            : "var(--color-bg)",
                        border: isComplete
                          ? "2px solid var(--color-accent)"
                          : isCurrent
                            ? "2px solid var(--color-accent)"
                            : "2px solid var(--color-border)",
                        color: isComplete
                          ? "var(--color-accent-on)"
                          : isCurrent
                            ? "var(--color-accent)"
                            : "var(--color-text-tertiary)",
                      }}
                    >
                      {isComplete ? "✓" : step}
                    </span>
                    {/* Label + description */}
                    <span className="pt-0.5">
                      <span
                        className="block text-[var(--text-sm)] font-semibold"
                        style={{ color: isCurrent || isComplete ? "var(--color-text)" : "var(--color-text-tertiary)" }}
                      >
                        {STEP_META[step - 1].label}
                      </span>
                      <span
                        className="block text-[var(--text-xs)]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        {STEP_META[step - 1].description}
                      </span>
                    </span>
                    {/* Connector line */}
                    {!isLast && (
                      <span
                        className="mt-4 hidden h-0.5 flex-1 sm:block"
                        style={{
                          background: isComplete ? "var(--color-accent)" : "var(--color-border)",
                        }}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {pageError ? (
          <div className="rounded-[var(--radius-lg)] px-[var(--space-4)] py-[var(--space-4)] text-[var(--text-sm)]" style={{ ...panelShellStyle, color: "var(--color-text-secondary)" }}>
            {pageError}
          </div>
        ) : (
          <div className="relative">
            {/* ── Conversation drawer (slide-over) ── */}
            {mobileSidebarOpen && (
              <div className="fixed inset-0 z-40 flex">
                {/* Backdrop */}
                <div
                  className="absolute inset-0"
                  style={{ background: "rgba(0,0,0,0.3)" }}
                  onClick={() => setMobileSidebarOpen(false)}
                  onKeyDown={(e) => { if (e.key === "Escape") setMobileSidebarOpen(false); }}
                  role="button"
                  tabIndex={0}
                  aria-label="Close drawer"
                />
                {/* Drawer panel */}
                <aside
                  className="relative z-50 ml-auto flex w-[20rem] max-w-[85vw] flex-col overflow-y-auto"
                  style={{ background: "var(--color-bg-elevated)", borderLeft: "1px solid var(--color-border)" }}
                >
                  <div className="flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>Conversations</h2>
                    <button
                      type="button"
                      onClick={() => setMobileSidebarOpen(false)}
                      className="rounded px-2 py-1 text-[var(--text-sm)]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-[var(--space-4)]">
                    <textarea
                      value={topicInput}
                      onChange={(event) => setTopicInput(event.target.value)}
                      rows={2}
                      placeholder="New topic..."
                      className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => { createConversation(); setMobileSidebarOpen(false); }}
                      disabled={busy !== null || !topicInput.trim()}
                      className="mt-[var(--space-2)] inline-flex min-h-[36px] w-full items-center justify-center rounded-[var(--radius-md)] px-4 py-2 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                    >
                      {busy === "create" ? "Starting..." : "New AI Blog"}
                    </button>
                  </div>
                  <div className="px-[var(--space-4)] pb-[var(--space-2)]">
                    <div className="flex items-center gap-[var(--space-2)]">
                      <select
                        value={listFilter}
                        onChange={(event) => setListFilter(event.target.value as "active" | "archived" | "all")}
                        className="flex-1 px-[var(--space-2)] py-[var(--space-2)] text-[var(--text-xs)] outline-none"
                        style={inputStyle}
                      >
                        <option value="active">Active</option>
                        <option value="archived">Archived</option>
                        <option value="all">All</option>
                      </select>
                      <input
                        type="text"
                        value={listSearch}
                        onChange={(event) => setListSearch(event.target.value)}
                        placeholder="Search..."
                        className="flex-1 px-[var(--space-2)] py-[var(--space-2)] text-[var(--text-xs)] outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <span className="mt-[var(--space-2)] block font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>
                      {visibleConversationCount} of {listTotal}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-[var(--space-3)] pb-[var(--space-4)]">
                    {loadingList ? (
                      <p className="px-1 py-2 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
                    ) : conversations.length === 0 ? (
                      <p className="px-1 py-2 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>No conversations yet.</p>
                    ) : (
                      <div className="flex flex-col gap-[var(--space-1)]">
                        {conversations.map((conversation) => (
                          <div
                            key={conversation.id}
                            className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] transition-colors"
                            style={{
                              background: selectedId === conversation.id
                                ? "color-mix(in oklch, var(--color-accent-lightest) 82%, var(--color-bg) 18%)"
                                : "transparent",
                              border: selectedId === conversation.id
                                ? "1px solid color-mix(in oklch, var(--color-accent) 55%, var(--color-border) 45%)"
                                : "1px solid transparent",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => { setSelectedId(conversation.id); setMobileSidebarOpen(false); }}
                              className="w-full text-left"
                            >
                              <span className="line-clamp-1 block text-[var(--text-sm)] font-500" style={{ color: "var(--color-text)" }}>{conversation.title}</span>
                              <span className="mt-[2px] block font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>
                                {formatTimestamp(conversation.updatedAt)} · {conversation.status.replace(/_/g, " ")}
                              </span>
                            </button>
                            {selectedId === conversation.id && (
                              <div className="mt-[var(--space-1)] flex gap-[var(--space-2)]">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); void archiveConversation(conversation.id, !conversation.archivedAt); }}
                                  disabled={busy !== null}
                                  className="text-[0.625rem] disabled:opacity-50"
                                  style={{ color: "var(--color-text-secondary)" }}
                                >
                                  {conversation.archivedAt ? "Restore" : "Archive"}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); void deleteConversation(conversation.id); }}
                                  disabled={busy !== null}
                                  className="text-[0.625rem] disabled:opacity-50"
                                  style={{ color: "oklch(55% 0.1 25)" }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                        {listHasMore && (
                          <button
                            type="button"
                            onClick={() => void loadList({ page: listPage + 1, append: true })}
                            disabled={loadingList}
                            className="mt-[var(--space-2)] text-[var(--text-xs)] disabled:opacity-50"
                            style={{ color: "var(--color-accent)" }}
                          >
                            Load more
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}

            {/* ══════════════════════════════════════
                WORKSPACE: Step content
                ══════════════════════════════════════ */}
            <div className="min-w-0">

              {/* ── Error banner ── */}
              {actionError && (
                <div className="mb-[var(--space-4)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", border: "1px solid oklch(90% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
                  {actionError}
                </div>
              )}

              {/* ═══════════ STEP 1: CREATE ═══════════ */}
              {currentStep === 1 && (
                <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)] lg:p-[var(--space-8)]" style={panelShellStyle}>
                  {detail ? (
                    <div className="flex flex-col gap-[var(--space-6)]">
                      <div>
                        <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.25rem,2vw,1.75rem)] font-semibold leading-tight" style={{ color: "var(--color-text)" }}>
                          {detail.title}
                        </h2>
                        <p className="mt-[var(--space-2)] max-w-[60ch] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{detail.topic}</p>
                      </div>

                      {/* Chat messages */}
                      {(detail.messages.length > 0 || busy === "message" || busy === "brief") && (
                        <div className="max-h-[52vh] overflow-y-auto rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ background: "var(--color-bg)" }}>
                          <div className="flex flex-col gap-[var(--space-4)]">
                            {detail.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] ${message.role === "user" ? "ml-[2rem]" : "mr-[2rem]"}`}
                                style={{
                                  background: message.role === "user" ? "var(--color-bg-elevated)" : "color-mix(in oklch, var(--color-bg) 92%, var(--color-accent-lightest) 8%)",
                                  border: `1px solid ${message.role === "user" ? "var(--color-border)" : "color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)"}`,
                                }}
                              >
                                <p className="mb-1 font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>
                                  {message.role === "user" ? "You" : "Assistant"}
                                </p>
                                <p className="whitespace-pre-wrap break-words text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>
                                  {message.content}
                                </p>
                              </div>
                            ))}
                            {/* Thinking indicator */}
                            {(busy === "message" || busy === "brief") && (
                              <div
                                className="mr-[2rem] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)]"
                                style={{
                                  background: "color-mix(in oklch, var(--color-bg) 92%, var(--color-accent-lightest) 8%)",
                                  border: "1px solid color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)",
                                }}
                              >
                                <p className="mb-1 font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>
                                  Assistant
                                </p>
                                <div className="flex items-center gap-1">
                                  <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--color-accent)", animationDelay: "0ms" }} />
                                  <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--color-accent)", animationDelay: "150ms" }} />
                                  <span className="inline-block h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--color-accent)", animationDelay: "300ms" }} />
                                  <span className="ml-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                                    {busy === "brief" ? "Generating brief..." : "Thinking..."}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Message input + actions */}
                      <div className="flex flex-col gap-[var(--space-4)]">
                        <textarea
                          value={messageInput}
                          onChange={(event) => setMessageInput(event.target.value)}
                          rows={3}
                          placeholder="Answer the assistant's questions or add more detail..."
                          className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                          style={inputStyle}
                        />
                        <div className="flex flex-wrap gap-[var(--space-3)]">
                          <button
                            type="button"
                            onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/message`, "POST", { message: messageInput })}
                            disabled={busy !== null || !messageInput.trim()}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                          >
                            {busy === "message" ? "Sending..." : "Send Message"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/brief`, "POST")}
                            disabled={busy !== null}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                          >
                            {busy === "brief" ? "Generating..." : "Generate Brief"}
                          </button>
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex flex-wrap gap-[var(--space-3)]">
                        {[
                          { label: "Messages", value: String(detail.messages.length) },
                          { label: "Sources", value: String(approvedSourceCount) },
                          { label: "Draft", value: draft ? "Ready" : "Pending" },
                        ].map((item) => (
                          <span key={item.label} className="rounded-full px-3 py-1 text-[var(--text-xs)]" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}>
                            {item.value} {item.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-[var(--space-5)] py-[var(--space-10)]">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "color-mix(in oklch, var(--color-accent-lightest) 40%, var(--color-bg) 60%)" }}>
                        <span className="text-2xl">✨</span>
                      </div>
                      <div className="text-center">
                        <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.25rem,2.5vw,1.5rem)] font-semibold" style={{ color: "var(--color-text)" }}>
                          What should we write about?
                        </h2>
                        <p className="mt-[var(--space-2)] max-w-[48ch] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          Describe your blog topic and the AI will generate a brief, research, and full draft.
                        </p>
                      </div>
                      <div className="flex w-full max-w-[36rem] flex-col gap-[var(--space-3)]">
                        <textarea
                          value={topicInput}
                          onChange={(event) => setTopicInput(event.target.value)}
                          rows={3}
                          placeholder="e.g. AI tools for small business marketing..."
                          className="w-full px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-base)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                          style={{ ...inputStyle, minHeight: "5rem" }}
                        />
                        <button
                          type="button"
                          onClick={() => void createConversation()}
                          disabled={busy !== null || !topicInput.trim()}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-md)] px-6 py-3 text-[var(--text-base)] font-600 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                        >
                          {busy === "create" ? "Starting..." : "Generate Blog Post →"}
                        </button>
                      </div>
                      {conversations.length > 0 && (
                        <p className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                          Or open ☰ to continue an existing conversation
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* ═══════════ STEP 2: BRIEF ═══════════ */}
              {currentStep === 2 && (
                <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)] lg:p-[var(--space-8)]" style={panelShellStyle}>
                  {detail?.brief ? (
                    <div className="flex flex-col gap-[var(--space-6)]">

                      {/* ── Brief summary card ── */}
                      <div className="rounded-[calc(var(--radius-md)+2px)] px-[var(--space-5)] py-[var(--space-5)]" style={panelInsetStyle}>
                        <p className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>Content Brief</p>
                        <p className="mt-[var(--space-1)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                          Review the AI-generated brief. Edit advanced fields if needed, then approve.
                        </p>
                        <div className="mt-[var(--space-5)] grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                          {[
                            { label: "Topic", value: briefForm.topic },
                            { label: "Audience", value: briefForm.audience || "—" },
                            { label: "Goal", value: briefForm.goal || "—" },
                            { label: "Tone", value: briefForm.tone || "—" },
                            { label: "Words", value: `~${briefForm.wordCount || 1600}` },
                            { label: "Type", value: briefForm.contentType.charAt(0).toUpperCase() + briefForm.contentType.slice(1).replace(/-/g, " ") },
                          ].map((item) => (
                            <div key={item.label}>
                              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{item.label}</span>
                              <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>{item.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ── Primary CTA ── */}
                      <div className="flex flex-wrap gap-[var(--space-3)]">
                        <button
                          type="button"
                          onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/brief`, "PUT", { ...briefForm, secondaryKeywords: briefForm.secondaryKeywords, approved: true })}
                          disabled={busy !== null}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                        >
                          {busy === "approve" ? "Approving..." : briefApproved ? "Update Approved Brief" : "Approve Brief & Generate Draft"}
                        </button>
                        {briefApproved && !draft && (
                          <button
                            type="button"
                            onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/draft`, "POST")}
                            disabled={busy !== null}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                          >
                            {busy === "draft" ? "Generating..." : "Generate Draft"}
                          </button>
                        )}
                      </div>
                      <p className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                        {briefApproved ? `Brief approved ${detail.brief?.approvedAt ? formatTimestamp(detail.brief.approvedAt) : ""}.` : "Approve the brief to enable draft generation."}
                      </p>

                      {/* ── Collapsible: Advanced Settings ── */}
                      <div className="pt-[var(--space-2)]" style={{ borderTop: "1px solid var(--color-border)" }}>
                        <button
                          type="button"
                          onClick={() => setShowAdvancedBrief(!showAdvancedBrief)}
                          className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          <ChevronRight open={showAdvancedBrief} />
                          Advanced Settings
                        </button>
                        {showAdvancedBrief && (
                          <div className="mt-[var(--space-3)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <div className="flex flex-col gap-[var(--space-3)]">
                              <label className="flex flex-col gap-[var(--space-1)]">
                                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Topic</span>
                                <input value={briefForm.topic} onChange={(event) => setBriefForm((current) => ({ ...current, topic: event.target.value }))} placeholder="What is this post about?" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                              </label>
                              <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Audience</span>
                                  <input value={briefForm.audience} onChange={(event) => setBriefForm((current) => ({ ...current, audience: event.target.value }))} placeholder="Who is this for?" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                                </label>
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Goal</span>
                                  <input value={briefForm.goal} onChange={(event) => setBriefForm((current) => ({ ...current, goal: event.target.value }))} placeholder="What should the reader do?" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                                </label>
                              </div>
                              <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Tone</span>
                                  <input value={briefForm.tone} onChange={(event) => setBriefForm((current) => ({ ...current, tone: event.target.value }))} placeholder="e.g. Professional, Casual" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                                </label>
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Content Type</span>
                                  <select value={briefForm.contentType} onChange={(event) => setBriefForm((current) => ({ ...current, contentType: event.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle}>
                                    <option value="guide">Guide</option>
                                    <option value="listicle">Listicle</option>
                                    <option value="comparison">Comparison</option>
                                    <option value="thought-leadership">Thought Leadership</option>
                                    <option value="tutorial">Tutorial</option>
                                  </select>
                                </label>
                              </div>
                              <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Primary Keyword</span>
                                  <input value={briefForm.primaryKeyword} onChange={(event) => setBriefForm((current) => ({ ...current, primaryKeyword: event.target.value }))} placeholder="Main SEO keyword" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                                </label>
                                <label className="flex flex-col gap-[var(--space-1)]">
                                  <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Word Count</span>
                                  <input type="number" value={briefForm.wordCount ?? 1600} onChange={(event) => setBriefForm((current) => ({ ...current, wordCount: Number(event.target.value) || null }))} placeholder="Target word count" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                                </label>
                              </div>
                              <label className="flex flex-col gap-[var(--space-1)]">
                                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Secondary Keywords</span>
                                <input value={briefForm.secondaryKeywords.join(", ")} onChange={(event) => setBriefForm((current) => ({ ...current, secondaryKeywords: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) }))} placeholder="Comma-separated keywords" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                              </label>
                              <label className="flex flex-col gap-[var(--space-1)]">
                                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>CTA</span>
                                <input value={briefForm.cta} onChange={(event) => setBriefForm((current) => ({ ...current, cta: event.target.value }))} placeholder="Call to action" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                              </label>
                              <label className="flex flex-col gap-[var(--space-1)]">
                                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Notes</span>
                                <textarea value={briefForm.notes} onChange={(event) => setBriefForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Additional notes, examples, references" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Collapsible: AI Usage ── */}
                      <div className="pt-[var(--space-2)]" style={{ borderTop: "1px solid var(--color-border)" }}>
                        <button
                          type="button"
                          onClick={() => setShowAiUsage(!showAiUsage)}
                          className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          <ChevronRight open={showAiUsage} />
                          AI Usage Details
                          <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                            {detail.usageSummary.totalCalls} calls
                          </span>
                        </button>
                        {showAiUsage && (
                          <div className="mt-[var(--space-3)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <div className="grid grid-cols-3 gap-[var(--space-2)]">
                              {[
                                { label: "Tokens", value: detail.usageSummary.totalTokens || 0 },
                                { label: "Avg ms", value: detail.usageSummary.avgLatencyMs || 0 },
                                { label: "Est. $", value: detail.usageSummary.estimatedCostUsd?.toFixed(4) || "0.0000" },
                              ].map((item) => (
                                <div key={item.label} className="rounded-[var(--radius-md)] p-[var(--space-2)] text-center" style={{ background: "var(--color-bg-elevated)" }}>
                                  <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{item.value}</p>
                                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{item.label}</p>
                                </div>
                              ))}
                            </div>
                            {detail.usageEvents.length > 0 ? (
                              <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
                                {detail.usageEvents.slice(0, 4).map((event) => (
                                  <div key={event.id} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)]" style={{ borderColor: "var(--color-border)" }}>
                                    <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
                                      <span className="text-[var(--text-xs)] font-semibold" style={{ color: "var(--color-text)" }}>
                                        {event.operation.replace(/_/g, " ")}
                                      </span>
                                      <span className="font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>
                                        {event.provider}{event.model ? ` · ${event.model}` : ""}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                                      {event.totalTokens || 0} tokens · {event.latencyMs || 0} ms
                                      {event.estimatedCostUsd ? ` · $${event.estimatedCostUsd.toFixed(4)}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* ── Collapsible: Run Research ── */}
                      <div className="pt-[var(--space-2)]" style={{ borderTop: "1px solid var(--color-border)" }}>
                        <button
                          type="button"
                          onClick={() => setShowResearchPanel(!showResearchPanel)}
                          className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          <ChevronRight open={showResearchPanel} />
                          Run Research
                          <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                            {research ? `${approvedSourceCount} sources` : "optional"}
                          </span>
                        </button>
                        {showResearchPanel && (
                          <div className="mt-[var(--space-3)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
                                  {research
                                    ? `Status: ${research.status.replace(/_/g, " ")}`
                                    : detail.researchEnabled
                                      ? "No research run yet."
                                      : detail.researchMessage || "Live research is disabled."}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/research`, "POST")}
                                disabled={busy !== null || !detail.researchEnabled}
                                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                              >
                                {busy === "research" ? "Researching..." : "Start Research"}
                              </button>
                            </div>
                            {!detail.researchEnabled && (
                              <p className="mt-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                                Draft generation will use best-practice guidance only.
                              </p>
                            )}
                            {research && (
                              <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
                                {research.topicSummary && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Topic Summary</p>
                                    <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{research.topicSummary}</p>
                                  </div>
                                )}
                                {research.searchIntent && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Search Intent</p>
                                    <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{research.searchIntent}</p>
                                  </div>
                                )}
                                {research.keywordIdeas.length > 0 && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Keyword Ideas</p>
                                    <div className="mt-[var(--space-2)] flex flex-wrap gap-2">
                                      {research.keywordIdeas.map((keyword) => (
                                        <span key={keyword} className="rounded-full px-3 py-1 text-[var(--text-xs)]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-secondary)" }}>
                                          {keyword}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {research.relatedQuestions.length > 0 && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Related Questions</p>
                                    <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                                      {research.relatedQuestions.map((question) => (
                                        <li key={question} className="mb-1 text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{question}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {research.contentGaps.length > 0 && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Content Gaps</p>
                                    <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                                      {research.contentGaps.map((gap) => (
                                        <li key={gap} className="mb-1 text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{gap}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {research.riskFlags.length > 0 && (
                                  <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)]" style={{ background: "oklch(97% 0.03 85)", color: "oklch(40% 0.08 85)" }}>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest">Verification Flags</p>
                                    <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                                      {research.riskFlags.map((flag) => (
                                        <li key={flag} className="mb-1 text-[var(--text-sm)]">{flag}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {sourceForm.length > 0 && (
                                  <div>
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Source Notes</p>
                                    <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-3)]">
                                      {sourceForm.map((source) => (
                                        <div key={source.id} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)" }}>
                                          <div className="flex items-start justify-between gap-[var(--space-3)]">
                                            <div>
                                              <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{source.title}</p>
                                              <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                                                {[source.publisher, source.publishedDate || "Date unclear", source.usefulness].filter(Boolean).join(" - ")}
                                              </p>
                                            </div>
                                            {source.url ? (
                                              <a href={source.url} target="_blank" rel="noreferrer" className="text-[var(--text-xs)] underline" style={{ color: "var(--color-accent)" }}>Open</a>
                                            ) : null}
                                          </div>
                                          {source.summary && <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{source.summary}</p>}
                                          {getSourceWarnings(source).length > 0 && (
                                            <div className="mt-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]" style={{ background: "oklch(97% 0.03 85)", color: "oklch(40% 0.08 85)" }}>
                                              <ul className="list-disc pl-[var(--space-4)]">
                                                {getSourceWarnings(source).map((warning) => (
                                                  <li key={warning} className="mb-1 text-[var(--text-xs)]">{warning}</li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          <div className="mt-[var(--space-3)] grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-[12rem,1fr]">
                                            <label className="flex flex-col gap-[var(--space-1)]">
                                              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Source State</span>
                                              <select
                                                value={source.approvalStatus}
                                                onChange={(event) =>
                                                  setSourceForm((current) =>
                                                    current.map((entry) =>
                                                      entry.id === source.id ? { ...entry, approvalStatus: event.target.value as AiResearchSource["approvalStatus"] } : entry
                                                    )
                                                  )
                                                }
                                                className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                                                style={inputStyle}
                                              >
                                                <option value="needs_review">Needs review</option>
                                                <option value="approved">Approved</option>
                                                <option value="rejected">Rejected</option>
                                              </select>
                                            </label>
                                            <label className="flex flex-col gap-[var(--space-1)]">
                                              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Admin Notes</span>
                                              <textarea
                                                value={source.adminNotes}
                                                onChange={(event) =>
                                                  setSourceForm((current) =>
                                                    current.map((entry) =>
                                                      entry.id === source.id ? { ...entry, adminNotes: event.target.value } : entry
                                                    )
                                                  )
                                                }
                                                rows={2}
                                                className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                                                style={inputStyle}
                                              />
                                            </label>
                                          </div>
                                          <label className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                                            <input
                                              type="checkbox"
                                              checked={source.includeInReferences !== false}
                                              disabled={source.approvalStatus !== "approved"}
                                              onChange={(event) =>
                                                setSourceForm((current) =>
                                                  current.map((entry) =>
                                                    entry.id === source.id ? { ...entry, includeInReferences: event.target.checked } : entry
                                                  )
                                                )
                                              }
                                            />
                                            Include in References block
                                          </label>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="mt-[var(--space-3)]">
                                      <button
                                        type="button"
                                        onClick={() => void saveSourceReview()}
                                        disabled={busy !== null || sourceForm.length === 0}
                                        className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                                      >
                                        {busy === "research" ? "Saving..." : "Save Source Review"}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : detail ? (
                    <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-10)]">
                      <span className="text-2xl">📝</span>
                      <p className="text-[var(--text-base)]" style={{ color: "var(--color-text-secondary)" }}>
                        Go back to Step 1 and generate a brief first.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-[var(--space-4)] py-[var(--space-10)]">
                      <span className="text-2xl">✨</span>
                      <p className="text-[var(--text-base)]" style={{ color: "var(--color-text-secondary)" }}>
                        Start a new blog from Step 1 to begin.
                      </p>
                    </div>
                  )}
                </section>
              )}

              {/* ═══════════ STEP 3: DRAFT ═══════════ */}
              {currentStep === 3 && (
                <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)] lg:p-[var(--space-8)]" style={panelShellStyle}>
                  {detail ? (
                    <div className="flex flex-col gap-[var(--space-6)]">

                      {/* Generate draft (if not yet generated) */}
                      {!draft && (
                        <button
                          type="button"
                          onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/draft`, "POST")}
                          disabled={busy !== null || !briefApproved}
                          className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                        >
                          {busy === "draft" ? "Generating..." : "Generate Draft"}
                        </button>
                      )}

                      {draft ? (
                        <div className="flex flex-col gap-[var(--space-5)]">

                          {/* ── Panel: Draft Overview ── */}
                          <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Draft Overview</p>
                            <h3 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-600" style={{ color: "var(--color-text)" }}>{draft.title}</h3>
                            <p className="mt-[var(--space-1)] break-all text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{draft.slug}</p>
                            <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-2)]">
                              {[
                                { label: "SEO", value: draft.seoScore },
                                { label: "Engage", value: draft.engagementScore },
                                { label: "Read", value: draft.readabilityScore },
                              ].map((score) => (
                                <span
                                  key={score.label}
                                  className="rounded-full px-3 py-1 font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                                  style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                >
                                  {score.label} {score.value}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* ── Panel: SEO Preview ── */}
                          <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>SEO Meta</p>
                            <p className="mt-[var(--space-2)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{draft.metaTitle}</p>
                            <p className="mt-[var(--space-1)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{draft.metaDescription}</p>
                          </div>

                          {/* ── Panel: Recommendations ── */}
                          {draft.recommendations.length > 0 && (
                            <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                              <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Recommendations</p>
                              <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                                {draft.recommendations.map((rec) => (
                                  <li key={rec} className="mb-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* ── Panel: Article Preview ── */}
                          <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Article Preview</p>
                            <div className="prose mt-[var(--space-3)] max-h-[32rem] overflow-y-auto rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ background: "var(--color-bg)" }} dangerouslySetInnerHTML={{ __html: draft.contentHtml }} />
                            {includeReferences && referencePreviewHtml && (
                              <div className="prose mt-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg)" }} dangerouslySetInnerHTML={{ __html: referencePreviewHtml }} />
                            )}
                          </div>

                          {/* ── Panel: Quality & Insights ── */}
                          <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Quality & Insights</p>
                            <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">

                            {/* ── Collapsible: Review Flags ── */}
                            {draft.verificationFlags.length > 0 && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => setShowReviewFlags(!showReviewFlags)}
                                  className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                                  style={{ color: riskyFlags.length > 0 ? "oklch(50% 0.1 25)" : "var(--color-text-secondary)" }}
                                >
                                <ChevronRight open={showReviewFlags} />
                                Review Flags
                                <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                                  {draft.verificationFlags.length}
                                </span>
                                {riskyFlags.length > 0 && (
                                  <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "oklch(97% 0.03 25)", color: "oklch(45% 0.1 25)" }}>
                                    {riskyFlags.length} risky
                                  </span>
                                )}
                              </button>
                              {showReviewFlags && (
                                <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
                                  {draft.verificationFlags.map((flag, flagIndex) => (
                                    <div key={`${flag.claim}-${flag.status}`} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)", background: flag.status === "risky" ? "oklch(97% 0.03 25)" : "var(--color-bg)" }}>
                                      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                                        <span className="rounded-full px-2 py-1 text-[0.625rem] uppercase tracking-widest" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                                          {flag.status.replace(/_/g, " ")}
                                        </span>
                                        {flag.sourceId && (
                                          <span className="font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>Source: {flag.sourceId}</span>
                                        )}
                                      </div>
                                      <p className="mt-[var(--space-2)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{flag.claim}</p>
                                      <p className="mt-1 text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{flag.recommendation}</p>
                                      <div className="mt-[var(--space-3)] grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-[12rem,1fr]">
                                        <label className="flex flex-col gap-[var(--space-1)]">
                                          <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Review State</span>
                                          <select
                                            value={flag.reviewStatus || "pending"}
                                            onChange={(event) => setVerificationReviewField(flagIndex, "reviewStatus", event.target.value)}
                                            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                                            style={inputStyle}
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="accepted">Accepted</option>
                                            <option value="soften">Soften claim</option>
                                            <option value="remove">Remove claim</option>
                                          </select>
                                        </label>
                                        <label className="flex flex-col gap-[var(--space-1)]">
                                          <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Review Notes</span>
                                          <textarea
                                            value={flag.reviewNotes || ""}
                                            onChange={(event) => setVerificationReviewField(flagIndex, "reviewNotes", event.target.value)}
                                            rows={2}
                                            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                                            style={inputStyle}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => void updateVerificationFlags()}
                                    disabled={busy !== null}
                                    className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                                  >
                                    {busy === "reviewFlags" ? "Saving..." : "Save Verification Review"}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Collapsible: Internal Link Suggestions ── */}
                          {draft.internalLinkSuggestions.length > 0 && (
                            <div>
                              <button
                                type="button"
                                onClick={() => setShowInternalLinks(!showInternalLinks)}
                                className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                <ChevronRight open={showInternalLinks} />
                                Internal Link Suggestions
                                <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                                  {draft.internalLinkSuggestions.length}
                                </span>
                              </button>
                              {showInternalLinks && (
                                <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)]">
                                  {draft.internalLinkSuggestions.map((link, linkIndex) => {
                                    const applied = "applied" in link && link.applied === true;
                                    return (
                                    <div key={`${link.slug}-${link.anchorText}`} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: applied ? "var(--color-accent)" : "var(--color-border)", opacity: applied ? 0.7 : 1 }}>
                                      <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{link.title}</p>
                                      <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                                        Anchor: {link.anchorText} — /blog/{link.slug}
                                      </p>
                                      <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{link.reason}</p>
                                      {applied ? (
                                        <p className="mt-[var(--space-3)] text-[var(--text-xs)] font-500" style={{ color: "var(--color-accent)" }}>Applied</p>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => void applyInternalLinkSuggestion(linkIndex)}
                                          disabled={busy !== null}
                                          className="mt-[var(--space-3)] inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-xs)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                          style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                        >
                                          {busy === "internalLink" ? "Applying..." : "Apply Link"}
                                        </button>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* ── Collapsible: Improve This Draft (Rewrite) ── */}
                          <div>
                            <button
                              type="button"
                              onClick={() => setShowRewriteActions(!showRewriteActions)}
                              className="flex items-center gap-[var(--space-2)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              <ChevronRight open={showRewriteActions} />
                              Improve This Draft
                              {proposals.length > 0 && (
                                <span className="rounded-full px-2 py-0.5 text-[0.625rem]" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                                  {proposals.length} proposals
                                </span>
                              )}
                            </button>
                            {showRewriteActions && (
                              <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-4)]">
                                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-[12rem,1fr]">
                                  <label className="flex flex-col gap-[var(--space-1)]">
                                    <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Rewrite Focus</span>
                                    <select
                                      value={rewriteFocusMode}
                                      onChange={(event) => setRewriteFocusMode(event.target.value as "auto" | "title" | "excerpt" | "intro" | "faq" | "custom")}
                                      className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                                      style={inputStyle}
                                    >
                                      <option value="auto">Auto-select</option>
                                      <option value="title">Title</option>
                                      <option value="excerpt">Excerpt</option>
                                      <option value="intro">Intro</option>
                                      <option value="faq">FAQ</option>
                                      <option value="custom">Custom text</option>
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-[var(--space-1)]">
                                    <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Custom Focus Text</span>
                                    <textarea
                                      value={rewriteSelectedText}
                                      onChange={(event) => setRewriteSelectedText(event.target.value)}
                                      rows={2}
                                      disabled={rewriteFocusMode !== "custom"}
                                      className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                                      style={inputStyle}
                                    />
                                  </label>
                                </div>
                                <div className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
                                  {rewriteActions.map((ra) => (
                                    <button
                                      key={ra.action}
                                      type="button"
                                      onClick={() => void requestRewrite(ra.action)}
                                      disabled={busy !== null}
                                      className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                      style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                    >
                                      {busy === "rewrite" ? "Working..." : ra.label}
                                    </button>
                                  ))}
                                </div>
                                {proposals.length > 0 && (
                                  <div className="flex flex-col gap-[var(--space-2)]">
                                    <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Rewrite Proposals</p>
                                    {proposals.map((proposal) => (
                                      <button
                                        key={proposal.id || `${proposal.action}-${proposal.createdAt}`}
                                        type="button"
                                        onClick={() => setRewriteProposal(proposal)}
                                        className="w-full rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)] text-left transition-colors"
                                        style={{ borderColor: "var(--color-border)", background: rewriteProposal?.id === proposal.id ? "var(--color-accent-lightest)" : "var(--color-bg)" }}
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
                                          <span className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{proposal.label}</span>
                                          <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>
                                            {proposal.status || "proposed"}
                                          </span>
                                        </div>
                                        <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>{proposal.summary}</p>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {rewriteProposal && (
                                  <div className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                                    <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{rewriteProposal.label}</p>
                                    <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{rewriteProposal.summary}</p>
                                    <div className="mt-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg-elevated)" }}>
                                      {rewriteProposal.target === "contentHtml" ? (
                                        <div className="prose max-h-[18rem] overflow-y-auto" dangerouslySetInnerHTML={{ __html: rewriteProposal.preview }} />
                                      ) : (
                                        <p className="whitespace-pre-wrap break-words text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>{rewriteProposal.preview}</p>
                                      )}
                                    </div>
                                    <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
                                      <button
                                        type="button"
                                        onClick={() => void applyRewrite()}
                                        disabled={busy !== null || rewriteProposal.status !== "proposed"}
                                        className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                                      >
                                        {busy === "applyRewrite" ? "Applying..." : "Apply Rewrite"}
                                      </button>
                                      {rewriteProposal.id && (
                                        <button
                                          type="button"
                                          onClick={() => void rejectRewrite(rewriteProposal.id!)}
                                          disabled={busy !== null || rewriteProposal.status !== "proposed"}
                                          className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                          style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                        >
                                          Reject
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setRewriteProposal(null)}
                                        disabled={busy !== null}
                                        className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                      >
                                        Dismiss
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                            </div>
                          </div>

                          {/* ── Panel: Actions ── */}
                          <div className="rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-4)]" style={panelInsetStyle}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Publish</p>
                            <div className="mt-[var(--space-3)]">
                              <label className="flex items-start gap-[var(--space-3)]">
                              <input
                                type="checkbox"
                                checked={includeReferences}
                                onChange={(event) => setIncludeReferences(event.target.checked)}
                                disabled={approvedSources.length === 0}
                                className="mt-1"
                              />
                              <span>
                                <span className="block text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Include approved references</span>
                                <span className="mt-1 block text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                                  Only approved sources will appear in the References block.
                                </span>
                              </span>
                            </label>
                          </div>

                          {/* ── Save CTA ── */}
                          <button
                            type="button"
                            onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/save-draft`, "POST", { includeReferences })}
                            disabled={busy !== null}
                            className="inline-flex min-h-[40px] w-full items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                          >
                            {busy === "save" ? "Saving..." : detail.draft?.postId ? "Update CMS Draft" : "Save as CMS Draft"}
                          </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="py-[var(--space-6)] text-center">
                      <p className="text-[var(--text-base)]" style={{ color: "var(--color-text-secondary)" }}>
                        Select or create a conversation from the sidebar.
                      </p>
                    </div>
                  )}
                </section>
              )}

            </div> {/* Close workspace div */}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AiWriterPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <WriterContent />
      </UIProvider>
    </AuthProvider>
  );
}
