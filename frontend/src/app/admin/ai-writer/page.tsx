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
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
};

const panelInsetStyle = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
};

const panelSoftStyle = {
  background: "color-mix(in oklch, var(--color-bg) 92%, var(--color-accent-lightest) 8%)",
  border: "1px solid color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)",
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

type TabId = "chat" | "brief" | "research" | "draft" | "review" | "rewrite";

const TABS: { id: TabId; label: string }[] = [
  { id: "chat", label: "Chat" },
  { id: "brief", label: "Brief" },
  { id: "research", label: "Research" },
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "rewrite", label: "Rewrite" },
];

function WriterContent() {
  const { token } = useAuth();
  const { toast } = useUI();
  const router = useRouter();
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
  const [loadingDetail, setLoadingDetail] = useState(false);
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
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const syncList = useCallback((conversation: AiConversationDetail) => {
    setConversations((current) => {
      const item = normalizeConversationListItem(conversation);
      const next = [item, ...current.filter((entry) => entry.id !== item.id)];
      return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });
  }, []);

  const loadList = useCallback(async (options?: { page?: number; append?: boolean }) => {
    if (!token) return;
    setLoadingList(true);
    setPageError(null);
    try {
      const page = options?.page || 1;
      const params = new URLSearchParams();
      params.set("filter", listFilter);
      params.set("page", String(page));
      params.set("pageSize", "25");
      if (listSearch.trim()) {
        params.set("search", listSearch.trim());
      }
      const data = await adminApiRequest<AiConversationListResponse>(`/api/admin/ai/conversations?${params.toString()}`);
      const items = Array.isArray(data.items) ? data.items.map((item) => normalizeConversationListItem(item)) : [];
      setListPage(data.page);
      setListHasMore(data.hasMore);
      setListTotal(data.total);
      setConversations((current) => (options?.append ? [...current, ...items.filter((item) => !current.some((entry) => entry.id === item.id))] : items));
      if (!options?.append) {
        const selectedStillVisible = selectedId ? items.some((item) => item.id === selectedId) : false;
        if (!selectedStillVisible) {
          setSelectedId(items[0]?.id || null);
        }
      } else if (!selectedId && items.length > 0) {
        setSelectedId(items[0].id);
      }
    } catch (error) {
      setPageError(getAdminErrorMessage(error, "Failed to load AI conversations."));
    } finally {
      setLoadingList(false);
    }
  }, [listFilter, listSearch, selectedId, token]);

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
      // Auto-select tab based on conversation state
      if (next.draft?.contentHtml) {
        setActiveTab("draft");
      } else if (next.brief?.approvedAt) {
        setActiveTab("brief");
      } else {
        setActiveTab("chat");
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
  }, [loadList, token]);

  useEffect(() => {
    if (!selectedId) {
      const timeoutId = window.setTimeout(() => {
        setDetail(null);
        setBriefForm(emptyBrief);
        setSourceForm([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
    const timeoutId = window.setTimeout(() => {
      void loadDetail(selectedId);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDetail, selectedId]);

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
      setActiveTab("brief");
    } else if (path.endsWith("/brief") && method === "PUT") {
      toast("Brief saved and approved", "success");
      setActiveTab("draft");
    } else if (path.endsWith("/research")) {
      toast(normalized.research?.status === "disabled" ? "Research unavailable. Using brief-only mode." : "Research notes updated", normalized.research?.status === "disabled" ? "info" : "success");
    } else if (path.endsWith("/draft")) {
      toast("Draft generated", "success");
      setActiveTab("draft");
    } else if (path.endsWith("/analyze")) {
      toast("Draft analysis refreshed", "success");
      setActiveTab("review");
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
    setDetail((current) =>
      current
        ? {
            ...current,
            proposals: [
              next.proposal,
              ...(Array.isArray(current.proposals) ? current.proposals : []).filter(
                (proposal) => proposal.id !== next.proposal.id
              ),
            ],
          }
        : current
    );
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
    setActiveTab("draft");
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
    if (!detail || sourceForm.length === 0) return;
    const next = await runAction("research", () =>
      adminApiRequest<AiConversationDetail>(`/api/admin/ai/conversations/${detail.id}/research`, {
        method: "PUT",
        body: JSON.stringify({
          sources: sourceForm.map((source) => ({
            id: source.id,
            approvalStatus: source.approvalStatus,
            adminNotes: source.adminNotes,
            includeInReferences: source.includeInReferences !== false,
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

  const statusLabel = useMemo(() => detail?.status.replace(/_/g, " ") || "No conversation selected", [detail]);
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
  const studioSummary = [
    { label: "Conversations", value: String(listTotal || visibleConversationCount), note: `${visibleConversationCount} visible` },
    { label: "Brief", value: briefApproved ? "Approved" : detail ? "In progress" : "Waiting", note: detail?.brief?.approvedAt ? formatTimestamp(detail.brief.approvedAt) : "Clarify before drafting" },
    { label: "Draft", value: draft ? "Ready" : detail ? "Pending" : "Idle", note: draft ? `${draft.seoScore} SEO · ${draft.readabilityScore} readability` : "Generate after brief approval" },
    { label: "Research", value: research ? research.status.replace(/_/g, " ") : detail?.researchEnabled ? "Not run" : "Disabled", note: research ? `${approvedSourceCount} approved sources` : detail?.researchMessage || "Directional guidance only" },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <section
          className="mb-[var(--space-8)] rounded-[calc(var(--radius-lg)+4px)] p-[var(--space-5)] lg:p-[var(--space-7)]"
          style={panelShellStyle}
        >
          <div className="grid gap-[var(--space-6)] xl:grid-cols-[minmax(0,1.25fr),minmax(18rem,0.75fr)]">
            <div>
              <p
                className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.24em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Admin AI Writer
              </p>
              <h1
                className="mt-[var(--space-3)] max-w-[14ch] font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.96]"
                style={{ color: "var(--color-text)" }}
              >
                Research, shape, and draft posts like an editorial workflow.
              </h1>
              <p
                className="mt-[var(--space-4)] max-w-[74ch] text-[var(--text-sm)] leading-relaxed sm:text-[var(--text-base)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Start with a rough topic, answer the assistant’s clarification questions, approve the brief, then generate and review a draft before saving it into the CMS as a private draft.
              </p>
            </div>

            <div className="self-start">
              <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={panelSoftStyle}>
                <p
                  className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Active Status
                </p>
                <p
                  className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[1.35rem] font-semibold leading-none"
                  style={{ color: "var(--color-text)" }}
                >
                  {statusLabel}
                </p>
                <p className="mt-[var(--space-2)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  Drafts remain private until you publish them from the existing post editor.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-[var(--space-6)] grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 2xl:grid-cols-4">
            {studioSummary.map((item) => (
              <div key={item.label} className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={panelInsetStyle}>
                <p
                  className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {item.label}
                </p>
                <p
                  className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[1.45rem] font-semibold leading-none"
                  style={{ color: "var(--color-text)" }}
                >
                  {item.value}
                </p>
                <p className="mt-[var(--space-2)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  {item.note}
                </p>
              </div>
            ))}
          </div>
        </section>

        {pageError ? (
          <div className="rounded-[var(--radius-lg)] px-[var(--space-4)] py-[var(--space-4)] text-[var(--text-sm)]" style={{ ...panelShellStyle, color: "var(--color-text-secondary)" }}>
            {pageError}
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-[var(--space-6)] xl:grid-cols-[18rem,minmax(0,1fr)] 2xl:grid-cols-[19rem,minmax(0,1fr)]">
            {/* Mobile conversation toggle */}
            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((prev) => !prev)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors"
                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
              >
                {mobileSidebarOpen ? "Hide Conversations" : `Conversations (${listTotal})`}
              </button>
            </div>
            {/* Left sidebar - desktop: always visible, mobile: toggleable */}
            <section className={`space-y-[var(--space-5)] xl:sticky xl:top-[var(--space-6)] ${mobileSidebarOpen ? "block" : "hidden"} xl:block`}>
              <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-4)]" style={panelShellStyle}>
                <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>New AI Blog</h2>
                <p className="mt-[var(--space-1)] max-w-[30ch] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  Start with a rough topic. The assistant will ask up to 5 clarification questions at a time.
                </p>
              <textarea
                value={topicInput}
                onChange={(event) => setTopicInput(event.target.value)}
                rows={3}
                placeholder="Example: AI tools for small business marketing"
                className="mt-[var(--space-4)] w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={createConversation}
                disabled={busy !== null || !topicInput.trim()}
                className="mt-[var(--space-3)] inline-flex min-h-[40px] w-full items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
              >
                {busy === "create" ? "Starting..." : "New AI Blog"}
              </button>
              </div>

              <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-4)]" style={panelShellStyle}>
                <div className="flex items-end justify-between gap-[var(--space-3)]">
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>
                      Conversation History
                    </h3>
                    <p className="mt-[var(--space-1)] text-[0.75rem]" style={{ color: "var(--color-text-tertiary)" }}>
                      Showing {visibleConversationCount} of {listTotal}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]"
                    style={{ background: "var(--color-bg)", color: "var(--color-text-tertiary)" }}
                  >
                    {listFilter}
                  </span>
                </div>

                <div className="mb-[var(--space-3)] mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
                <select
                  value={listFilter}
                  onChange={(event) => setListFilter(event.target.value as "active" | "archived" | "all")}
                  className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                  style={inputStyle}
                >
                  <option value="active">Active conversations</option>
                  <option value="archived">Archived conversations</option>
                  <option value="all">All conversations</option>
                </select>
                <input
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                  placeholder="Filter by topic or title"
                  className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                  style={inputStyle}
                />
              </div>
              {loadingList ? (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
              ) : conversations.length === 0 ? (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No AI conversations yet.</p>
              ) : (
                <div className="flex max-h-[calc(100vh-23rem)] flex-col gap-[var(--space-2)] overflow-y-auto pr-[2px]">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="w-full rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)] text-left transition-colors"
                      style={{
                        background:
                          selectedId === conversation.id
                            ? "color-mix(in oklch, var(--color-accent-lightest) 82%, var(--color-bg) 18%)"
                            : "var(--color-bg)",
                        border:
                          selectedId === conversation.id
                            ? "1px solid color-mix(in oklch, var(--color-accent) 55%, var(--color-border) 45%)"
                            : "1px solid var(--color-border)",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(conversation.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-[var(--space-2)]">
                          <span className="line-clamp-2 text-[var(--text-sm)] font-500" style={{ color: "var(--color-text)" }}>{conversation.title}</span>
                          <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{conversation.status}</span>
                        </div>
                        <p className="mt-[var(--space-1)] line-clamp-2 text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>{conversation.topic}</p>
                        <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>
                          Updated {formatTimestamp(conversation.updatedAt)}
                        </p>
                      </button>
                      <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
                        <span className="rounded-full px-2 py-0.5 font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                          {conversation.archivedAt ? "Archived" : "Active"}
                        </span>
                        {selectedId === conversation.id ? (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void archiveConversation(conversation.id, !conversation.archivedAt);
                              }}
                              disabled={busy !== null}
                              className="rounded px-2 py-0.5 text-[0.625rem] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ color: "var(--color-text-secondary)" }}
                            >
                              {conversation.archivedAt ? "Restore" : "Archive"}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void deleteConversation(conversation.id);
                              }}
                              disabled={busy !== null}
                              className="rounded px-2 py-0.5 text-[0.625rem] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ color: "oklch(55% 0.1 25)" }}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {listHasMore && (
                    <button
                      type="button"
                      onClick={() => void loadList({ page: listPage + 1, append: true })}
                      disabled={loadingList}
                      className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                    >
                      {loadingList ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>
              )}
              </div>
            </section>

            {/* Workspace area with tabs */}
            <div className="min-w-0">
              {/* Tab bar */}
              <div
                className="flex overflow-x-auto"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className="whitespace-nowrap py-[var(--space-3)] px-[var(--space-4)] text-[var(--text-sm)] transition-colors"
                    style={{
                      borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
                      color: activeTab === tab.id ? "var(--color-text)" : "var(--color-text-tertiary)",
                      fontWeight: activeTab === tab.id ? 500 : 400,
                    }}
                    onMouseEnter={(e) => {
                      if (activeTab !== tab.id) {
                        e.currentTarget.style.color = "var(--color-text)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (activeTab !== tab.id) {
                        e.currentTarget.style.color = "var(--color-text-tertiary)";
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Chat */}
              {activeTab === "chat" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {detail ? (
                <>
                  <div className="mb-[var(--space-5)] flex flex-col gap-[var(--space-4)] border-b pb-[var(--space-5)] lg:flex-row lg:items-end lg:justify-between" style={{ borderColor: "var(--color-border)" }}>
                    <div>
                      <p
                        className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        Conversation Thread
                      </p>
                      <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[clamp(1.4rem,2vw,2rem)] font-semibold leading-tight" style={{ color: "var(--color-text)" }}>{detail.title}</h2>
                      <p className="mt-[var(--space-2)] max-w-[60ch] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{detail.topic}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-[var(--space-2)] sm:w-auto">
                      {[
                        { label: "Messages", value: String(detail.messages.length) },
                        { label: "Sources", value: String(approvedSourceCount) },
                        { label: "Draft", value: draft ? "Ready" : "Pending" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-center" style={panelInsetStyle}>
                          <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{item.value}</p>
                          <p className="mt-[2px] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--color-text-tertiary)" }}>
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {loadingDetail ? (
                    <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading conversation...</p>
                  ) : (
                    <>
                      <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-3)]" style={panelInsetStyle}>
                        <div className="flex max-h-[52vh] flex-col gap-[var(--space-3)] overflow-y-auto pr-1">
                        {detail.messages.map((message) => (
                          <div
                            key={message.id}
                            className="rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)]"
                            style={{
                              background:
                                message.role === "user"
                                  ? "color-mix(in oklch, var(--color-bg) 84%, var(--color-accent-lightest) 16%)"
                                  : "var(--color-bg-subtle)",
                              border: "1px solid var(--color-border)",
                            }}
                          >
                            <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-2)]">
                              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{message.role}</span>
                              <span className="font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>{formatTimestamp(message.createdAt)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text)" }}>{message.content}</p>
                          </div>
                        ))}
                      </div>
                      </div>
                      <textarea
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        rows={4}
                        placeholder="Answer the clarification questions or add more context..."
                        className="mt-[var(--space-5)] w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                        style={inputStyle}
                      />
                      <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
                        <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/message`, "POST", { message: messageInput })} disabled={busy !== null || !messageInput.trim()} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}>
                          {busy === "message" ? "Sending..." : "Send Message"}
                        </button>
                        <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/brief`, "POST")} disabled={busy !== null} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                          {busy === "brief" ? "Generating..." : "Generate Brief"}
                        </button>
                        <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/draft`, "POST")} disabled={busy !== null || !briefApproved} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                          {busy === "draft" ? "Generating Draft..." : "Generate Draft"}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex min-h-[420px] items-center justify-center rounded-[var(--radius-lg)] border border-dashed" style={{ borderColor: "var(--color-border)" }}>
                  <div className="max-w-md px-[var(--space-4)] text-center">
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>Start a conversation</h2>
                    <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
                      Create a new AI Blog Studio conversation from the left panel, then answer the clarification questions before generating a brief or draft.
                    </p>
                  </div>
                </div>
              )}
            </section>
              )}

              {/* Tab: Brief */}
              {activeTab === "brief" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {actionError ? (
                <div className="mb-[var(--space-4)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", border: "1px solid oklch(90% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
                  {actionError}
                </div>
              ) : null}
              {detail ? (
                <div className="flex flex-col gap-[var(--space-4)]">
                  <div className="rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                    <div className="flex items-center justify-between gap-[var(--space-3)]">
                      <div>
                        <p className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>AI Usage</p>
                        <p className="mt-[var(--space-1)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                          Recent provider calls for this conversation.
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{detail.usageSummary.totalCalls}</p>
                        <p className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>Calls</p>
                      </div>
                    </div>
                    <div className="mt-[var(--space-3)] grid grid-cols-3 gap-[var(--space-2)]">
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
                            {!event.success && event.errorMessage ? (
                              <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-error)" }}>{event.errorMessage}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                    <p className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Content Brief</p>
                    <p className="mt-[var(--space-1)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Edit the brief fields, then save and approve to enable draft generation.
                    </p>
                    <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
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
                  <div className="flex flex-wrap gap-[var(--space-3)]">
                    <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/brief`, "PUT", { ...briefForm, secondaryKeywords: briefForm.secondaryKeywords, approved: true })} disabled={busy !== null} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}>
                      {busy === "approve" ? "Saving..." : briefApproved ? "Update Approved Brief" : "Save Brief & Approve"}
                    </button>
                    <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/analyze`, "POST")} disabled={busy !== null || !draft} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                      {busy === "analyze" ? "Analyzing..." : "Analyze Draft"}
                    </button>
                  </div>
                  <p className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                    {briefApproved ? `Brief approved ${detail.brief?.approvedAt ? formatTimestamp(detail.brief.approvedAt) : ""}.` : "Save and approve the brief before generating the full article."}
                  </p>
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                  Select a conversation to review the brief, draft, and save controls.
                </div>
              )}
            </section>
              )}

              {/* Tab: Research */}
              {activeTab === "research" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {actionError ? (
                <div className="mb-[var(--space-4)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", border: "1px solid oklch(90% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
                  {actionError}
                </div>
              ) : null}
              {detail ? (
                <div className="flex flex-col gap-[var(--space-4)]">
                  <div className="border-t pt-[var(--space-4)]" style={{ borderColor: "var(--color-border)" }}>
                  <div className="rounded-[calc(var(--radius-md)+2px)] px-[var(--space-4)] py-[var(--space-4)]" style={panelInsetStyle}>
                    <div className="flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Research</p>
                        <p className="mt-[var(--space-1)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
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
                        disabled={busy !== null}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                      >
                        {busy === "research" ? "Researching..." : "Start Research"}
                      </button>
                    </div>
                    {!detail.researchEnabled ? (
                      <p className="mt-[var(--space-3)] text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                        {detail.researchMessage || "Live research is disabled. Draft generation will continue using best-practice guidance only."}
                      </p>
                    ) : null}
                    {research ? (
                      <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
                        {research.topicSummary ? (
                          <div>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Topic Summary</p>
                            <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{research.topicSummary}</p>
                          </div>
                        ) : null}
                        {research.searchIntent ? (
                          <div>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Search Intent</p>
                            <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{research.searchIntent}</p>
                          </div>
                        ) : null}
                        {research.keywordIdeas.length > 0 ? (
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
                        ) : null}
                        {research.relatedQuestions.length > 0 ? (
                          <div>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Related Questions</p>
                            <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                              {research.relatedQuestions.map((question) => (
                                <li key={question} className="mb-1 text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {research.contentGaps.length > 0 ? (
                          <div>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Content Gaps</p>
                            <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                              {research.contentGaps.map((gap) => (
                                <li key={gap} className="mb-1 text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{gap}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {research.internalLinkSuggestions.length > 0 ? (
                          <div>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Internal Link Ideas</p>
                            <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
                              {research.internalLinkSuggestions.map((link) => (
                                <div key={`${link.slug}-${link.anchorText}`} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)" }}>
                                  <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{link.title}</p>
                                  <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                                    Anchor: {link.anchorText} - /blog/{link.slug}
                                  </p>
                                  <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{link.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {research.riskFlags.length > 0 ? (
                          <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)]" style={{ background: "oklch(97% 0.03 85)", color: "oklch(40% 0.08 85)" }}>
                            <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest">Verification Flags</p>
                            <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                              {research.riskFlags.map((flag) => (
                                <li key={flag} className="mb-1 text-[var(--text-sm)]">{flag}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {sourceForm.length > 0 ? (
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
                                      <a href={source.url} target="_blank" rel="noreferrer" className="text-[var(--text-xs)] underline" style={{ color: "var(--color-accent)" }}>
                                        Open
                                      </a>
                                    ) : null}
                                  </div>
                                  {source.summary ? (
                                    <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{source.summary}</p>
                                  ) : null}
                                  {source.notes.length > 0 ? (
                                    <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                                      {source.notes.map((note) => (
                                        <li key={note} className="mb-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{note}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {getSourceWarnings(source).length > 0 ? (
                                    <div className="mt-[var(--space-2)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)]" style={{ background: "oklch(97% 0.03 85)", color: "oklch(40% 0.08 85)" }}>
                                      <ul className="list-disc pl-[var(--space-4)]">
                                        {getSourceWarnings(source).map((warning) => (
                                          <li key={warning} className="mb-1 text-[var(--text-xs)]">{warning}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
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
                                    Include this source in the References block
                                  </label>
                                </div>
                              ))}
                            </div>
                            <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
                              <button
                                type="button"
                                onClick={() => void saveSourceReview()}
                                disabled={busy !== null || sourceForm.length === 0}
                                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                              >
                                {busy === "research" ? "Saving..." : "Save Source Review"}
                              </button>
                              {research.sources.length > 0 && approvedSources.length === 0 ? (
                                <p className="max-w-xl text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                                  Research is available, but no sources have been approved yet. The draft will use research notes only as directional guidance.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                  Select a conversation to review research data.
                </div>
              )}
            </section>
              )}

              {/* Tab: Draft */}
              {activeTab === "draft" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {actionError ? (
                <div className="mb-[var(--space-4)] rounded-[calc(var(--radius-md)+2px)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", border: "1px solid oklch(90% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
                  {actionError}
                </div>
              ) : null}
              {detail ? (
                <div className="flex flex-col gap-[var(--space-4)]">
                  <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/draft`, "POST")} disabled={busy !== null || !briefApproved} className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                    {busy === "draft" ? "Generating Draft..." : "Generate Draft"}
                  </button>
                  {draft ? (
                    <div className="border-t pt-[var(--space-4)]" style={{ borderColor: "var(--color-border)" }}>
                      <h3 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>Draft Preview</h3>
                      <p className="mt-[var(--space-2)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{draft.title}</p>
                      <p className="mt-[var(--space-1)] break-all text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{draft.slug}</p>
                      <div className="mt-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg)" }}>
                        <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{draft.metaTitle}</p>
                        <p className="mt-[var(--space-1)] text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>{draft.metaDescription}</p>
                      </div>
                      <div className="mt-[var(--space-3)] grid grid-cols-3 gap-[var(--space-2)]">
                        {[
                          { label: "SEO", value: draft.seoScore },
                          { label: "Engage", value: draft.engagementScore },
                          { label: "Read", value: draft.readabilityScore },
                        ].map((score) => (
                          <div key={score.label} className="rounded-[var(--radius-md)] p-[var(--space-3)] text-center" style={{ background: "var(--color-bg)" }}>
                            <p className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>{score.value}</p>
                            <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{score.label}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-[var(--space-3)]">
                        <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Recommendations</p>
                        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                          {draft.recommendations.map((recommendation) => (
                            <li key={recommendation} className="mb-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{recommendation}</li>
                          ))}
                        </ul>
                        {draft.verificationNotes.length > 0 ? (
                          <>
                            <p className="mt-[var(--space-3)] font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Verification Notes</p>
                            <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                              {draft.verificationNotes.map((note) => (
                                <li key={note} className="mb-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{note}</li>
                              ))}
                            </ul>
                          </>
                        ) : null}
                        {draft.engagementInsights.length > 0 ? (
                          <>
                            <p className="mt-[var(--space-3)] font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Engagement Insights</p>
                            <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-4)]">
                              {draft.engagementInsights.map((insight) => (
                                <li key={insight} className="mb-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{insight}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p className="mt-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            Not enough historical engagement data yet. Using best-practice scoring.
                          </p>
                        )}
                        <p className="mt-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                          {draft.researchUsed ? "Research-backed notes were used while generating this draft." : "This draft was generated without live research notes."}
                        </p>
                      </div>
                      <div className="prose mt-[var(--space-3)] max-h-[28rem] overflow-y-auto rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg)" }} dangerouslySetInnerHTML={{ __html: draft.contentHtml }} />
                      {includeReferences && referencePreviewHtml ? (
                        <div className="prose mt-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg)" }} dangerouslySetInnerHTML={{ __html: referencePreviewHtml }} />
                      ) : null}
                      <button type="button" onClick={() => void refreshFromEndpoint(`/api/admin/ai/conversations/${detail.id}/save-draft`, "POST", { includeReferences })} disabled={busy !== null} className="mt-[var(--space-4)] inline-flex min-h-[40px] w-full items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}>
                        {busy === "save" ? "Saving Draft..." : "Save as Draft"}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                      Generate and approve a brief, then create the full article draft here.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                  Select a conversation to review the draft.
                </div>
              )}
            </section>
              )}

              {/* Tab: Review */}
              {activeTab === "review" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {detail ? (
                <div className="flex flex-col gap-[var(--space-4)]">
                  {draft ? (
                    <div>
                      {draft.verificationFlags.length > 0 ? (
                        <>
                          <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Verification Flags</p>
                          <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
                            {draft.verificationFlags.map((flag, flagIndex) => (
                              <div key={`${flag.claim}-${flag.status}`} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)", background: flag.status === "risky" ? "oklch(97% 0.03 25)" : "var(--color-bg)" }}>
                                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                                  <span className="rounded-full px-2 py-1 text-[0.625rem] uppercase tracking-widest" style={{ background: "var(--color-bg-elevated)", color: "var(--color-text-tertiary)" }}>
                                    {flag.status.replace(/_/g, " ")}
                                  </span>
                                  {flag.sourceId ? (
                                    <span className="font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>Source: {flag.sourceId}</span>
                                  ) : null}
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
                          </div>
                          <button
                            type="button"
                            onClick={() => void updateVerificationFlags()}
                            disabled={busy !== null}
                            className="mt-[var(--space-3)] inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                          >
                            {busy === "reviewFlags" ? "Saving..." : "Save Verification Review"}
                          </button>
                        </>
                      ) : null}
                      {draft.internalLinkSuggestions.length > 0 ? (
                        <>
                          <p className="mt-[var(--space-4)] font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>Internal Link Suggestions</p>
                          <div className="mt-[var(--space-2)] flex flex-col gap-[var(--space-2)]">
                            {draft.internalLinkSuggestions.map((link, linkIndex) => (
                              <div key={`${link.slug}-${link.anchorText}`} className="rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)" }}>
                                <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{link.title}</p>
                                <p className="mt-1 text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                                  Suggested anchor: {link.anchorText} - /blog/{link.slug}
                                </p>
                                <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>{link.reason}</p>
                                <button
                                  type="button"
                                  onClick={() => void applyInternalLinkSuggestion(linkIndex)}
                                  disabled={busy !== null}
                                  className="mt-[var(--space-3)] inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-3 py-2 text-[var(--text-xs)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                                >
                                  {busy === "internalLink" ? "Applying..." : "Apply Link Suggestion"}
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                      <div className="mt-[var(--space-4)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
                        <label className="flex items-start gap-[var(--space-3)]">
                          <input
                            type="checkbox"
                            checked={includeReferences}
                            onChange={(event) => setIncludeReferences(event.target.checked)}
                            disabled={approvedSources.length === 0}
                            className="mt-1"
                          />
                          <span>
                            <span className="block text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Include approved references when saving</span>
                            <span className="mt-1 block text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                              Only approved sources will appear in the final References block.
                            </span>
                          </span>
                        </label>
                        {approvedSources.length === 0 ? (
                          <p className="mt-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            Approve at least one source in the research panel before enabling references.
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-[var(--space-4)] grid grid-cols-3 gap-[var(--space-2)]">
                        {[
                          { label: "SEO", value: draft.seoScore },
                          { label: "Engage", value: draft.engagementScore },
                          { label: "Read", value: draft.readabilityScore },
                        ].map((score) => (
                          <div key={score.label} className="rounded-[var(--radius-md)] p-[var(--space-3)] text-center" style={{ background: "var(--color-bg)" }}>
                            <p className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>{score.value}</p>
                            <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>{score.label}</p>
                          </div>
                        ))}
                      </div>
                      {riskyFlags.length > 0 ? (
                        <div className="mt-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(97% 0.03 25)", color: "oklch(40% 0.1 25)" }}>
                          {riskyFlags.length} risky claim{riskyFlags.length === 1 ? "" : "s"} still need review before publishing.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                      Generate a draft first, then review its quality scores.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                  Select a conversation to review.
                </div>
              )}
            </section>
              )}

              {/* Tab: Rewrite */}
              {activeTab === "rewrite" && (
            <section className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-5)] lg:p-[var(--space-6)]" style={panelShellStyle}>
              {detail ? (
                <div className="flex flex-col gap-[var(--space-4)]">
                  {draft ? (
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Improve This Draft</p>
                      <div className="mt-[var(--space-3)] grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-[12rem,1fr]">
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
                      <div className="mt-[var(--space-3)] grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-2">
                        {rewriteActions.map((rewriteAction) => (
                          <button
                            key={rewriteAction.action}
                            type="button"
                            onClick={() => void requestRewrite(rewriteAction.action)}
                            disabled={busy !== null}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                          >
                            {busy === "rewrite" ? "Working..." : rewriteAction.label}
                          </button>
                        ))}
                      </div>
                      {proposals.length > 0 ? (
                        <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
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
                      ) : null}
                      {rewriteProposal ? (
                        <div className="mt-[var(--space-4)] rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-3)]" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
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
                            {rewriteProposal.id ? (
                              <button
                                type="button"
                                onClick={() => void rejectRewrite(rewriteProposal.id!)}
                                disabled={busy !== null || rewriteProposal.status !== "proposed"}
                                className="inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[var(--text-sm)] font-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                              >
                                Reject Proposal
                              </button>
                            ) : null}
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
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                      Generate a draft first to enable rewrite actions.
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "var(--color-bg)", color: "var(--color-text-secondary)" }}>
                  Select a conversation to use rewrite tools.
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
