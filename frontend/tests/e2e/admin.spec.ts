import { test, expect } from "@playwright/test";
import { API_URL, fetchJson, loginViaUi } from "./helpers";

type Category = { id: string; name: string; slug: string };
type Tag = { id: string; name: string; slug: string };
type MockResearchSource = {
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
};
type MockRewriteProposal = {
  id: string;
  action: string;
  label: string;
  summary: string;
  target: "title" | "contentHtml" | "meta" | "faq" | "excerpt";
  preview: string;
  draftPatch: Record<string, unknown>;
  status: "proposed" | "applied" | "rejected";
  createdAt: string;
  updatedAt: string;
};
type MockAiWriterDetail = {
  id: string;
  title: string;
  topic: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
  brief: Record<string, unknown> | null;
  draft: Record<string, unknown> | null;
  research: {
    provider: string;
    status: string;
    topicSummary: string;
    searchIntent: string;
    keywordIdeas: string[];
    relatedQuestions: string[];
    competitorNotes: string[];
    contentGaps: string[];
    sources: MockResearchSource[];
    internalLinkSuggestions: Array<Record<string, unknown>>;
    riskFlags: string[];
  } | null;
  proposals: MockRewriteProposal[];
  researchEnabled: boolean;
  researchMessage: string | null;
};

test("admin posts page redirects when logged out", async ({ page }) => {
  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
});

test("admin login works and posts page loads after login", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL || "admin@myplweb.com");
  await page.getByLabel("Password").fill(process.env.E2E_ADMIN_PASSWORD || "admin123");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Dashboard", { exact: true })).toBeVisible();
  await page.goto("/admin/posts");
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
});

test("duplicate category create shows an error and keeps the form open", async ({ page, request }) => {
  const categories = await fetchJson<Category[]>(request, `${API_URL}/api/categories`);
  test.skip(categories.length === 0, "Requires at least one existing category");

  await loginViaUi(page);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "+ New Category" }).click();
  await page.locator("#category-name").fill(categories[0].name);
  await page.locator("#category-slug").fill(categories[0].slug);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("main").getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Category" })).toBeVisible();
  await expect(page.locator("#category-name")).toHaveValue(categories[0].name);
});

test("failed category delete keeps the item visible", async ({ page }) => {
  await loginViaUi(page);

  await page.route("**/api/categories", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ id: "category-delete-failure", name: "AI", slug: "ai", postCount: 3 }]),
    });
  });

  await page.route("**/api/categories/category-delete-failure", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Failed to delete category" }),
    });
  });

  await page.goto("/admin/categories");
  await expect(page.locator("main").getByText("AI").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).last().click();

  await expect(page.getByText("Failed to delete category").first()).toBeVisible();
  await expect(page.locator("main").getByText("AI").first()).toBeVisible();
});

test("duplicate tag create shows an error and keeps the form open", async ({ page, request }) => {
  const tags = await fetchJson<Tag[]>(request, `${API_URL}/api/tags`);
  test.skip(tags.length === 0, "Requires at least one existing tag");

  await loginViaUi(page);
  await page.goto("/admin/tags");
  await page.getByRole("button", { name: "+ New Tag" }).click();
  await page.locator("#tag-name").fill(tags[0].name);
  await page.locator("#tag-slug").fill(tags[0].slug);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("main").getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Tag" })).toBeVisible();
  await expect(page.locator("#tag-name")).toHaveValue(tags[0].name);
});

test("invalid settings JSON shows an error and blocks false save", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/settings");
  await page.locator("#settings-skill-groups").fill("{\"invalid\": true");
  await page.getByRole("button", { name: "Save All" }).click();

  await expect(page.locator("main").getByText(/must be valid json|expected ',' or '}'|json array/i).first()).toBeVisible();
  await expect(page.locator("#settings-skill-groups")).toHaveValue("{\"invalid\": true");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("failed project delete keeps the item visible", async ({ page }) => {
  await loginViaUi(page);

  await page.route("**/api/projects", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "project-delete-failure",
          title: "MyPLWeb Failure Test",
          description: "Delete should fail safely",
          techStack: ["Next.js"],
          featured: false,
          order: 0,
        },
      ]),
    });
  });

  await page.route("**/api/projects/project-delete-failure", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Failed to delete project" }),
    });
  });

  await page.goto("/admin/projects");
  await expect(page.locator("main").getByText("MyPLWeb Failure Test").first()).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).last().click();

  await expect(page.getByText("Failed to delete project").first()).toBeVisible();
  await expect(page.locator("main").getByText("MyPLWeb Failure Test").first()).toBeVisible();
});

test("post editor requires a title", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/posts/new");
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.locator("main").getByText("Title is required")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);
});

test("admin ai writer redirects when logged out", async ({ page }) => {
  await page.goto("/admin/ai-writer");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
});

test("admin ai writer can start a conversation and send a message", async ({ page }) => {
  test.setTimeout(90000);
  await loginViaUi(page);
  await page.goto("/admin/ai-writer");

  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByPlaceholder("New topic...").fill("AI tools for small business marketing");
  await page.getByRole("button", { name: "New AI Blog" }).click();

  await expect(page.getByText("AI conversation started").first()).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("Assistant").first()).toBeVisible({ timeout: 60000 });

  await page.getByPlaceholder("Answer the assistant's questions or add more detail...").fill("The audience is small business owners. The tone should be practical and expert.");
  await expect(page.getByRole("button", { name: "Send Message" })).toBeEnabled();
  await page.getByRole("button", { name: "Send Message" }).click();

  await expect(page.getByText("Message sent").first()).toBeVisible({ timeout: 30000 });
});

test("admin ai writer shows the research status area", async ({ page }) => {
  await loginViaUi(page);

  const conversationId = "conversation-research-status";
  const currentDetail: MockAiWriterDetail = {
    id: conversationId,
    title: "Research Status Test",
    topic: "AI tools for small business marketing",
    status: "brief_ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Brief generated. You can now run research.",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
    brief: {
      topic: "AI tools for small business marketing",
      audience: "Small business owners",
      goal: "Teach",
      tone: "Practical",
      primaryKeyword: "AI tools for small business marketing",
      secondaryKeywords: ["AI marketing tools"],
      wordCount: 1400,
      contentType: "guide",
      cta: "Book a strategy call",
      notes: "",
      approvedAt: new Date().toISOString(),
    },
    draft: null,
    research: null,
    proposals: [],
    usageEvents: [],
    usageSummary: {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
      avgLatencyMs: 0,
    },
    researchEnabled: true,
    researchMessage: null,
  };

  await page.route(/\/api\/admin\/ai\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: conversationId,
            title: currentDetail.title,
            topic: currentDetail.topic,
            status: currentDetail.status,
            createdAt: currentDetail.createdAt,
            updatedAt: currentDetail.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}$`), async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.goto("/admin/ai-writer");
  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByRole("button", { name: /Research Status Test/i }).click();

  // Navigate to Step 2 (Brief) where research lives
  await page.getByRole("button", { name: /Brief.*Review the brief/ }).click();
  // Expand the Run Research collapsible
  await page.getByRole("button", { name: /Run Research/i }).click();

  const researchButton = page.getByRole("button", { name: "Start Research" });
  const disabledMessage = page.locator("main").getByText(/live research is disabled/i).first();

  const hasButton = await researchButton.isVisible({ timeout: 30000 }).catch(() => false);
  if (!hasButton) {
    await expect(disabledMessage).toBeVisible({ timeout: 30000 });
  }
});

test("admin ai writer supports source approval and references gating", async ({ page }) => {
  await loginViaUi(page);

  const conversationId = "conversation-source-review";
  let currentDetail: MockAiWriterDetail = {
    id: conversationId,
    title: "Source Review Conversation",
    topic: "AI tools for small business marketing",
    status: "brief_ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "I generated a structured content brief. Review it, then run research.",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
    brief: {
      topic: "AI tools for small business marketing",
      audience: "Small business owners",
      goal: "Teach",
      tone: "Practical",
      primaryKeyword: "AI tools for small business marketing",
      secondaryKeywords: ["AI marketing tools"],
      wordCount: 1400,
      contentType: "guide",
      cta: "Book a strategy call",
      notes: "",
      approvedAt: new Date().toISOString(),
    },
    draft: null,
    research: {
      provider: "mock",
      status: "completed",
      topicSummary: "Research summary for the topic.",
      searchIntent: "Informational and commercial",
      keywordIdeas: ["ai marketing tools", "small business ai"],
      relatedQuestions: ["Which tools are worth paying for?"],
      competitorNotes: [],
      contentGaps: ["Add a practical example."],
      sources: [
        {
          id: "source-1",
          title: "Approved Candidate",
          url: "https://example.com/approved-candidate",
          publisher: "Example",
          publishedDate: null,
          summary: "Short source summary.",
          usefulness: "high",
          notes: ["Verify any changing stats."],
          approvalStatus: "needs_review",
          adminNotes: "",
        },
      ],
      internalLinkSuggestions: [],
      riskFlags: ["Check freshness before citing any fast-moving stats."],
    },
    proposals: [],
    usageEvents: [],
    usageSummary: {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
      avgLatencyMs: 0,
    },
    researchEnabled: true,
    researchMessage: null,
  };

  await page.route(/\/api\/admin\/ai\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: conversationId,
            title: currentDetail.title,
            topic: currentDetail.topic,
            status: currentDetail.status,
            createdAt: currentDetail.createdAt,
            updatedAt: currentDetail.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}$`), async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/research$`), async (route) => {
    const payload = route.request().postDataJSON() as { sources: Array<{ id: string; approvalStatus: string; adminNotes: string }> };
    currentDetail = {
      ...currentDetail,
      updatedAt: new Date().toISOString(),
      research: currentDetail.research
        ? {
            ...currentDetail.research,
            sources: currentDetail.research.sources.map((source) => {
              const update = payload.sources.find((entry) => entry.id === source.id);
              return update ? { ...source, approvalStatus: update.approvalStatus, adminNotes: update.adminNotes } : source;
            }),
          }
        : null,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/draft$`), async (route) => {
    currentDetail = {
      ...currentDetail,
      status: "draft_ready",
      draft: {
        title: "AI Tools for Small Business Marketing",
        slug: "ai-tools-small-business-marketing",
        excerpt: "A practical guide for small business owners.",
        metaTitle: "AI tools for small business marketing",
        metaDescription: "Practical AI tools for small business owners.",
        ogImagePrompt: "AI tools dashboard",
        categorySuggestion: "AI",
        tagSuggestions: ["seo"],
        outline: [{ heading: "Introduction", points: ["Why this matters"] }],
        contentHtml: "<p>Draft body.</p>",
        faq: [{ question: "What should I start with?", answer: "Start with one workflow." }],
        seoScore: 82,
        engagementScore: 76,
        readabilityScore: 80,
        recommendations: ["Add a stronger CTA."],
        verificationNotes: ["Verify vendor pricing claims."],
        verificationFlags: [
          {
            claim: "Some AI tool pricing changes quickly.",
            status: "needs_verification",
            sourceId: "source-1",
            recommendation: "Check current pricing before publishing.",
          },
        ],
        engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
        internalLinkSuggestions: [],
        researchUsed: true,
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.goto("/admin/ai-writer");
  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByRole("button", { name: /Source Review Conversation/i }).click();

  // Step 2 (Brief): approve sources
  await page.getByRole("button", { name: /Brief.*Review the brief/ }).click();
  // Expand the Run Research collapsible to see sources
  await page.getByRole("button", { name: /Run Research/i }).click();
  await expect(page.locator("main").getByText("Approved Candidate")).toBeVisible();

  await page.locator('label:has-text("Source State") select').first().selectOption("approved");
  await page.locator('label:has-text("Admin Notes") textarea').first().fill("Approved for references.");
  await page.getByRole("button", { name: "Save Source Review" }).click();
  await expect(page.locator('label:has-text("Source State") select').first()).toHaveValue("approved");

  // Research section shows verification flags (risk flags from research)
  await expect(page.locator("main").getByText("Verification Flags").first()).toBeVisible();

  // Step 2 (Brief): generate draft
  await page.getByRole("button", { name: "Generate Draft" }).click();

  // Auto-switches to Step 3 (Draft) — draft title shown as h3
  await expect(page.getByRole("heading", { name: "AI Tools for Small Business Marketing" })).toBeVisible({ timeout: 60000 });

  // Step 3 (Draft): expand Review Flags collapsible for draft verification flags
  await page.getByRole("button", { name: /Review Flags/i }).click();
  await expect(page.getByText("Include approved references")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Include approved references/i })).toBeEnabled();
});

test("admin ai writer can reject a rewrite proposal without changing the draft", async ({ page }) => {
  await loginViaUi(page);
  const conversationId = "conversation-rewrite";
  let currentDetail: MockAiWriterDetail = {
    id: conversationId,
    title: "Rewrite Test",
    topic: "Rewrite Test Topic",
    status: "draft_ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Draft ready for review.",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
    brief: {
      topic: "Rewrite Test Topic",
      audience: "Owners",
      goal: "Teach",
      tone: "Helpful",
      primaryKeyword: "Rewrite Test Topic",
      secondaryKeywords: [],
      wordCount: 1200,
      contentType: "guide",
      cta: "Get help",
      notes: "",
      approvedAt: new Date().toISOString(),
    },
    draft: {
      title: "Original Draft Title",
      slug: "original-draft-title",
      excerpt: "Original excerpt",
      metaTitle: "Original Draft Title",
      metaDescription: "Original meta description",
      ogImagePrompt: "",
      categorySuggestion: "AI",
      tagSuggestions: ["seo"],
      outline: [],
      contentHtml: "<p>Original intro.</p>",
      faq: [],
      seoScore: 70,
      engagementScore: 70,
      readabilityScore: 70,
      recommendations: [],
      verificationNotes: [],
      verificationFlags: [],
      engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
      internalLinkSuggestions: [],
      researchUsed: false,
    },
    research: null,
    proposals: [],
    usageEvents: [],
    usageSummary: {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
      avgLatencyMs: 0,
    },
    researchEnabled: false,
    researchMessage: "Live research is disabled.",
  };

  await page.route(/\/api\/admin\/ai\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: conversationId,
            title: currentDetail.title,
            topic: currentDetail.topic,
            status: currentDetail.status,
            createdAt: currentDetail.createdAt,
            updatedAt: currentDetail.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}$`), async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/rewrite$`), async (route) => {
    currentDetail = {
      ...currentDetail,
      proposals: [
        {
          id: "proposal-reject",
          action: "improve_intro",
          label: "Improve intro",
          summary: "Sharper opening.",
          target: "contentHtml",
          preview: "<p>Improved intro.</p>",
          draftPatch: { contentHtml: "<p>Improved intro.</p>" },
          status: "proposed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ proposal: currentDetail.proposals[0] }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/rewrite/proposal-reject/reject$`), async (route) => {
    currentDetail = {
      ...currentDetail,
      proposals: currentDetail.proposals.map((proposal: MockRewriteProposal) =>
        proposal.id === "proposal-reject" ? { ...proposal, status: "rejected" } : proposal
      ),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        detail: currentDetail,
        proposal: currentDetail.proposals[0],
      }),
    });
  });

  await page.goto("/admin/ai-writer");
  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByRole("button", { name: /Rewrite Test/i }).click();
  await expect(page.getByRole("heading", { name: "Original Draft Title" })).toBeVisible({ timeout: 60000 });

  // Expand rewrite collapsible and trigger rewrite
  await page.getByRole("button", { name: /Improve This Draft/i }).click();
  await page.getByRole("button", { name: "Improve intro" }).click();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();

  await expect(page.locator("main").getByText("rejected").first()).toBeVisible();

  // Verify draft unchanged
  await expect(page.locator("main").getByText("Original Draft Title").first()).toBeVisible();
  await expect(page.locator("main").getByText("Improved intro.")).not.toBeVisible();
});

test("admin ai writer shows a clear error when draft generation fails", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/ai-writer");

  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByPlaceholder("New topic...").fill("AI tools for small business marketing");
  await page.getByRole("button", { name: "New AI Blog" }).click();
  await page.getByRole("button", { name: "Generate Brief" }).click();
  const approveBriefButton = page.getByRole("button", { name: /Approve Brief & Generate Draft|Update Approved Brief/ });
  await expect(approveBriefButton).toBeEnabled({ timeout: 60000 });
  await approveBriefButton.click();

  await page.route("**/api/admin/ai/conversations/*/draft", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "Mock AI draft failure" }),
    });
  });

  await page.getByRole("button", { name: "Generate Draft" }).click();
  await expect(page.locator("main").getByText("Mock AI draft failure").first()).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/ai-writer$/);
});

test("admin ai writer can propose and apply a rewrite after draft generation", async ({ page }) => {
  await loginViaUi(page);
  const conversationId = "conversation-apply-rewrite";
  let currentDetail: MockAiWriterDetail = {
    id: conversationId,
    title: "Rewrite Apply Test",
    topic: "Rewrite Apply Test Topic",
    status: "draft_ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Draft ready for rewrite.",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
    brief: {
      topic: "Rewrite Apply Test Topic",
      audience: "Owners",
      goal: "Teach",
      tone: "Helpful",
      primaryKeyword: "Rewrite Apply Test Topic",
      secondaryKeywords: [],
      wordCount: 1200,
      contentType: "guide",
      cta: "Get help",
      notes: "",
      approvedAt: new Date().toISOString(),
    },
    draft: {
      title: "Original Draft Title",
      slug: "original-draft-title",
      excerpt: "Original excerpt",
      metaTitle: "Original Draft Title",
      metaDescription: "Original meta description",
      ogImagePrompt: "",
      categorySuggestion: "AI",
      tagSuggestions: ["seo"],
      outline: [],
      contentHtml: "<p>Original intro.</p>",
      faq: [],
      seoScore: 70,
      engagementScore: 70,
      readabilityScore: 70,
      recommendations: [],
      verificationNotes: [],
      verificationFlags: [],
      engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
      internalLinkSuggestions: [],
      researchUsed: false,
    },
    research: null,
    proposals: [],
    usageEvents: [],
    usageSummary: {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
      avgLatencyMs: 0,
    },
    researchEnabled: false,
    researchMessage: "Live research is disabled.",
  };

  await page.route(/\/api\/admin\/ai\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: conversationId,
            title: currentDetail.title,
            topic: currentDetail.topic,
            status: currentDetail.status,
            createdAt: currentDetail.createdAt,
            updatedAt: currentDetail.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}$`), async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/rewrite$`), async (route) => {
    currentDetail = {
      ...currentDetail,
      proposals: [
        {
          id: "proposal-apply",
          action: "improve_intro",
          label: "Improve intro",
          summary: "Sharper opening.",
          target: "contentHtml",
          preview: "<p>Improved intro.</p>",
          draftPatch: { contentHtml: "<p>Improved intro.</p>" },
          status: "proposed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ proposal: currentDetail.proposals[0] }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/rewrite/proposal-apply/apply$`), async (route) => {
    currentDetail = {
      ...currentDetail,
      draft: currentDetail.draft
        ? {
            ...currentDetail.draft,
            contentHtml: "<p>Improved intro.</p>",
          }
        : currentDetail.draft,
      proposals: currentDetail.proposals.map((proposal: MockRewriteProposal) =>
        proposal.id === "proposal-apply" ? { ...proposal, status: "applied" } : proposal
      ),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        detail: currentDetail,
        proposal: currentDetail.proposals[0],
      }),
    });
  });

  await page.goto("/admin/ai-writer");
  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByRole("button", { name: /Rewrite Apply Test/i }).click();
  await expect(page.getByRole("heading", { name: "Original Draft Title" })).toBeVisible();

  // Expand rewrite collapsible and trigger rewrite
  await page.getByRole("button", { name: /Improve This Draft/i }).click();
  await page.getByRole("button", { name: "Improve intro" }).click();
  await expect(page.getByRole("button", { name: "Apply Rewrite" })).toBeVisible();
  await page.getByRole("button", { name: "Apply Rewrite" }).click();
  await expect(page.getByText("Rewrite applied to draft").first()).toBeVisible();
  await expect(page.locator("main").getByText("Improved intro.").first()).toBeVisible();
});

test("admin ai writer can save a generated draft into the post editor", async ({ page }) => {
  await loginViaUi(page);
  const conversationId = "conversation-save-draft";
  const savedPostId = "mock-post-123";
  const currentDetail: MockAiWriterDetail = {
    id: conversationId,
    title: "Save Draft Test",
    topic: "Save Draft Test Topic",
    status: "draft_ready",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Draft ready to save.",
        metadata: null,
        createdAt: new Date().toISOString(),
      },
    ],
    brief: {
      topic: "Save Draft Test Topic",
      audience: "Owners",
      goal: "Teach",
      tone: "Helpful",
      primaryKeyword: "Save Draft Test Topic",
      secondaryKeywords: [],
      wordCount: 1200,
      contentType: "guide",
      cta: "Get help",
      notes: "",
      approvedAt: new Date().toISOString(),
    },
    draft: {
      title: "Save Draft Title",
      slug: "save-draft-title",
      excerpt: "Original excerpt",
      metaTitle: "Save Draft Title",
      metaDescription: "Original meta description",
      ogImagePrompt: "",
      categorySuggestion: "AI",
      tagSuggestions: ["seo"],
      outline: [],
      contentHtml: "<p>Draft body.</p>",
      faq: [],
      seoScore: 70,
      engagementScore: 70,
      readabilityScore: 70,
      recommendations: [],
      verificationNotes: [],
      verificationFlags: [],
      engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
      internalLinkSuggestions: [],
      researchUsed: false,
    },
    research: null,
    proposals: [],
    usageEvents: [],
    usageSummary: {
      totalCalls: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      failures: 0,
      avgLatencyMs: 0,
    },
    researchEnabled: false,
    researchMessage: "Live research is disabled.",
  };

  await page.route(/\/api\/admin\/ai\/conversations(?:\?.*)?$/, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: conversationId,
            title: currentDetail.title,
            topic: currentDetail.topic,
            status: currentDetail.status,
            createdAt: currentDetail.createdAt,
            updatedAt: currentDetail.updatedAt,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        hasMore: false,
      }),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}$`), async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentDetail),
    });
  });

  await page.route(new RegExp(`/api/admin/ai/conversations/${conversationId}/save-draft$`), async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        postId: savedPostId,
        editUrl: `/admin/posts/${savedPostId}/edit`,
      }),
    });
  });

  await page.goto("/admin/ai-writer");
  await page.getByRole("button", { name: /☰/ }).click();
  await page.getByRole("button", { name: /Save Draft Test/i }).click();
  await expect(page.getByRole("heading", { name: "Save Draft Title" })).toBeVisible();

  await page.getByRole("button", { name: "Save as CMS Draft" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/posts/${savedPostId}/edit$`));
});
