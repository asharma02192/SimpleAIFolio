import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createAdminAiRouter } from "./admin-ai";
import { createTestApp } from "../test/test-app";
import type {
  AiBriefData,
  AiDraftData,
  AiResearchData,
  AiRewriteProposal,
  BlogStudioAiService,
} from "../services/ai/blog-studio";
import type { ResearchService } from "../services/ai/research";

const originalJwtSecret = process.env.JWT_SECRET;
const originalRateLimitStore = process.env.RATE_LIMIT_STORE;

type ConversationState = {
  id: string;
  userId: string;
  topic: string;
  title: string;
  status: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

function createToken(userId = "user-1") {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

function now() {
  return new Date().toISOString();
}

function createFixture() {
  const state = {
    conversations: [] as ConversationState[],
    messages: [] as any[],
    briefs: new Map<string, any>(),
    drafts: new Map<string, any>(),
    researches: new Map<string, any>(),
    proposals: [] as any[],
    usageEvents: [] as any[],
    posts: [
      {
        id: "published-1",
        title: "Published Guide",
        slug: "published-guide",
        excerpt: "Published excerpt",
        body: "<p>Published body</p>",
        status: "PUBLISHED",
        publishedAt: new Date("2026-05-01T00:00:00.000Z"),
        category: { name: "AI" },
        tags: [{ name: "seo" }],
      },
      {
        id: "draft-1",
        title: "Draft Guide",
        slug: "draft-guide",
        excerpt: "Draft excerpt",
        body: "<p>Draft body</p>",
        status: "DRAFT",
        publishedAt: null,
        category: { name: "AI" },
        tags: [{ name: "private" }],
      },
    ] as any[],
    categories: [{ id: "category-1", name: "AI", slug: "ai" }],
    tags: [{ id: "tag-1", name: "seo", slug: "seo" }],
  };

  let messageSeq = 1;
  let draftSeq = 1;
  let proposalSeq = 1;
  let postSeq = 20;

  function hydrateConversation(conversation: ConversationState | undefined) {
    if (!conversation) return null;
    return {
      ...conversation,
      messages: state.messages
        .filter((message) => message.conversationId === conversation.id)
        .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))),
      brief: state.briefs.get(conversation.id) || null,
      draft: state.drafts.get(conversation.id) || null,
      research: state.researches.get(conversation.id) || null,
      rewriteProposals: state.proposals
        .filter((proposal) => proposal.conversationId === conversation.id)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
      usageEvents: state.usageEvents
        .filter((event) => event.conversationId === conversation.id)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt))),
    };
  }

  function matchesConversationWhere(conversation: ConversationState, where: any) {
    if (conversation.userId !== where.userId) return false;

    if (where?.archivedAt?.not === null && !conversation.archivedAt) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(where || {}, "archivedAt") && where.archivedAt === null && conversation.archivedAt) {
      return false;
    }

    if (Array.isArray(where?.OR) && where.OR.length > 0) {
      const matchesSearch = where.OR.some((entry: any) => {
        const titleContains = entry?.title?.contains;
        const topicContains = entry?.topic?.contains;
        return (
          (typeof titleContains === "string" &&
            conversation.title.toLowerCase().includes(String(titleContains).toLowerCase())) ||
          (typeof topicContains === "string" &&
            conversation.topic.toLowerCase().includes(String(topicContains).toLowerCase()))
        );
      });

      if (!matchesSearch) {
        return false;
      }
    }

    return true;
  }

  const prismaClient = {
    aiConversation: {
      findMany: async ({ where, skip, take }: any) =>
        state.conversations
          .filter((conversation) => matchesConversationWhere(conversation, where))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(skip || 0, typeof take === "number" ? (skip || 0) + take : undefined),
      count: async ({ where }: any) =>
        state.conversations.filter((conversation) => matchesConversationWhere(conversation, where)).length,
      create: async ({ data }: any) => {
        const record = {
          id: `conversation-${state.conversations.length + 1}`,
          userId: data.userId,
          topic: data.topic,
          title: data.title,
          status: data.status,
          createdAt: now(),
          updatedAt: now(),
        };
        state.conversations.push(record);
        return record;
      },
      findFirst: async ({ where }: any) =>
        hydrateConversation(
          state.conversations.find(
            (conversation) => conversation.id === where.id && conversation.userId === where.userId
          )
        ),
      update: async ({ where, data }: any) => {
        const conversation = state.conversations.find((entry) => entry.id === where.id);
        if (!conversation) throw new Error("Conversation not found");
        Object.assign(conversation, data);
        if (!data.updatedAt) conversation.updatedAt = now();
        return conversation;
      },
      delete: async ({ where }: any) => {
        const index = state.conversations.findIndex((entry) => entry.id === where.id);
        if (index < 0) throw new Error("Conversation not found");
        const [deleted] = state.conversations.splice(index, 1);
        state.messages = state.messages.filter((message) => message.conversationId !== where.id);
        state.proposals = state.proposals.filter((proposal) => proposal.conversationId !== where.id);
        state.usageEvents = state.usageEvents.filter((event) => event.conversationId !== where.id);
        state.briefs.delete(where.id);
        state.drafts.delete(where.id);
        state.researches.delete(where.id);
        return deleted;
      },
    },
    aiMessage: {
      create: async ({ data }: any) => {
        const record = {
          id: `message-${messageSeq++}`,
          conversationId: data.conversationId,
          role: data.role,
          content: data.content,
          metadataJson: data.metadataJson ?? null,
          createdAt: now(),
        };
        state.messages.push(record);
        return record;
      },
    },
    aiContentBrief: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.briefs.get(where.conversationId);
        const next = existing
          ? { ...existing, ...update, updatedAt: now() }
          : { id: `brief-${where.conversationId}`, ...create, createdAt: now(), updatedAt: now() };
        state.briefs.set(where.conversationId, next);
        return next;
      },
    },
    aiDraftOutput: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.drafts.get(where.conversationId);
        const next = existing
          ? { ...existing, ...update, updatedAt: now() }
          : { id: `draft-${draftSeq++}`, ...create, createdAt: now(), updatedAt: now() };
        state.drafts.set(where.conversationId, next);
        return next;
      },
      update: async ({ where, data }: any) => {
        const existing = state.drafts.get(where.conversationId);
        if (!existing) throw new Error("Draft not found");
        const next = { ...existing, ...data, updatedAt: now() };
        state.drafts.set(where.conversationId, next);
        return next;
      },
    },
    aiResearchRun: {
      upsert: async ({ where, update, create }: any) => {
        const existing = state.researches.get(where.conversationId);
        const next = existing
          ? { ...existing, ...update, updatedAt: now() }
          : { id: `research-${where.conversationId}`, ...create, createdAt: now(), updatedAt: now() };
        state.researches.set(where.conversationId, next);
        return next;
      },
      update: async ({ where, data }: any) => {
        const existing = state.researches.get(where.conversationId);
        if (!existing) throw new Error("Research not found");
        const next = { ...existing, ...data, updatedAt: now() };
        state.researches.set(where.conversationId, next);
        return next;
      },
    },
    aiRewriteProposal: {
      create: async ({ data }: any) => {
        const record = {
          id: `proposal-${proposalSeq++}`,
          ...data,
          createdAt: now(),
          updatedAt: now(),
        };
        state.proposals.push(record);
        return record;
      },
      findFirst: async ({ where }: any) =>
        state.proposals.find((proposal) =>
          Object.entries(where).every(([key, value]) => proposal[key] === value)
        ) || null,
      update: async ({ where, data }: any) => {
        const proposal = state.proposals.find((entry) => entry.id === where.id);
        if (!proposal) throw new Error("Proposal not found");
        Object.assign(proposal, data, { updatedAt: now() });
        return proposal;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const proposal of state.proposals) {
          if (Object.entries(where).every(([key, value]) => proposal[key] === value)) {
            Object.assign(proposal, data, { updatedAt: now() });
            count += 1;
          }
        }
        return { count };
      },
    },
    aiUsageEvent: {
      create: async ({ data }: any) => {
        const record = {
          id: `usage-${state.usageEvents.length + 1}`,
          ...data,
          createdAt: now(),
        };
        state.usageEvents.push(record);
        return record;
      },
    },
    post: {
      findMany: async ({ where, take }: any) => {
        const filtered = state.posts.filter((post) =>
          where?.status ? post.status === where.status : true
        );
        return typeof take === "number" ? filtered.slice(0, take) : filtered;
      },
      findUnique: async ({ where }: any) =>
        state.posts.find((post) => post.slug === where.slug || post.id === where.id) || null,
      create: async ({ data }: any) => {
        const record = {
          id: `post-${postSeq++}`,
          ...data,
          tags: data.tags?.connect
            ? data.tags.connect.map((entry: { id: string }) => {
                const tag = state.tags.find((item) => item.id === entry.id);
                return { name: tag?.name || entry.id };
              })
            : [],
        };
        state.posts.push(record);
        return { id: record.id, slug: record.slug, status: record.status, body: record.body };
      },
    },
    category: {
      findMany: async () => state.categories,
    },
    tag: {
      findMany: async () => state.tags,
      create: async ({ data }: any) => {
        const created = { id: `tag-${state.tags.length + 1}`, name: data.name, slug: data.slug };
        state.tags.push(created);
        return { id: created.id };
      },
    },
    pageView: {
      groupBy: async () => [],
    },
    user: {
      findUnique: async () => ({ role: "admin", name: "Admin" }),
    },
  };

  function seedConversation(overrides?: Partial<ConversationState>) {
    const conversation = {
      id: `conversation-${state.conversations.length + 1}`,
      userId: "user-1",
      topic: "AI tools for small business marketing",
      title: "AI tools for small business marketing",
      status: "active",
      createdAt: now(),
      updatedAt: now(),
      ...overrides,
    };
    state.conversations.push(conversation);
    return conversation;
  }

  return { state, prismaClient, seedConversation };
}

function createAiService(overrides: Partial<BlogStudioAiService> = {}): BlogStudioAiService {
  const draft: AiDraftData = {
    title: "AI Tools for Small Business Marketing",
    slug: "ai-tools-small-business-marketing",
    excerpt: "How small businesses can use AI tools effectively.",
    metaTitle: "AI tools for small business marketing",
    metaDescription: "A practical guide to AI tools for small business marketing.",
    ogImagePrompt: "Modern AI dashboard for small business marketing",
    categorySuggestion: "AI",
    tagSuggestions: ["seo"],
    outline: [{ heading: "Introduction", points: ["Why this matters"] }],
    contentHtml: "<p>Draft body.</p>",
    faq: [{ question: "What tools?", answer: "Start simple." }],
    seoScore: 78,
    engagementScore: 72,
    readabilityScore: 81,
    recommendations: ["Add a stronger CTA."],
    verificationNotes: ["Verify fast-changing vendor pricing claims."],
    verificationFlags: [],
    engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
    internalLinkSuggestions: [],
    researchUsed: false,
  };

  return {
    isAvailable: () => true,
    getUnavailableReason: () => null,
    startConversation: async () => "Who is the target audience?",
    replyInConversation: async () => "What tone and depth should the article have?",
    generateBrief: async ({ topic }) => ({
      topic,
      audience: "Small business owners",
      goal: "Explain AI opportunities",
      tone: "Practical",
      primaryKeyword: topic,
      secondaryKeywords: ["AI marketing tools"],
      wordCount: 1600,
      contentType: "guide",
      cta: "Book a consultation",
      notes: "Avoid hype.",
      approvedAt: null,
    }),
    generateDraft: async () => draft,
    analyzeDraft: async () => ({
      seoScore: 80,
      engagementScore: 75,
      readabilityScore: 82,
      recommendations: ["Tighten the intro."],
      verificationNotes: ["Validate vendor-specific claims."],
      verificationFlags: [],
      engagementInsights: ["Not enough historical engagement data yet. Using best-practice scoring."],
      internalLinkSuggestions: [],
    }),
    rewriteDraft: async () => ({
      action: "improve_intro",
      label: "Improve intro",
      summary: "Sharper opening for the article.",
      target: "contentHtml",
      preview: "<p>Improved intro.</p>",
      draftPatch: { contentHtml: "<p>Improved intro.</p>" },
    }),
    ...overrides,
  };
}

function createResearchService(overrides: Partial<ResearchService> = {}): ResearchService {
  return {
    providerName: "disabled",
    isEnabled: () => false,
    getUnavailableReason: () => "Live research is disabled.",
    runResearch: async () => ({
      provider: "disabled",
      status: "disabled",
      topicSummary: "Research disabled.",
      searchIntent: "",
      keywordIdeas: [],
      relatedQuestions: [],
      competitorNotes: [],
      contentGaps: [],
      sources: [],
      internalLinkSuggestions: [],
      riskFlags: [],
    }),
    ...overrides,
  };
}

beforeEach(() => {
  process.env.JWT_SECRET = "phase5-test-secret";
  process.env.RATE_LIMIT_STORE = "memory";
});

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;

  if (originalRateLimitStore === undefined) delete process.env.RATE_LIMIT_STORE;
  else process.env.RATE_LIMIT_STORE = originalRateLimitStore;
});

test("AI routes require authentication", async () => {
  const fixture = createFixture();
  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));
  const response = await request(app).get("/api/admin/ai/conversations");
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "No token provided");
});

test("research and source approval require authentication", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));
  const researchResponse = await request(app).post(`/api/admin/ai/conversations/${conversation.id}/research`);
  const reviewResponse = await request(app)
    .put(`/api/admin/ai/conversations/${conversation.id}/research`)
    .send({ sources: [{ id: "source-1", approvalStatus: "approved" }] });
  assert.equal(researchResponse.status, 401);
  assert.equal(reviewResponse.status, 401);
});

test("conversation creation stores the topic and first messages", async () => {
  const fixture = createFixture();
  const app = createTestApp(
    "/api/admin/ai",
    createAdminAiRouter({
      prismaClient: fixture.prismaClient as any,
      aiService: createAiService(),
    })
  );

  const response = await request(app)
    .post("/api/admin/ai/conversations")
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ topic: "AI tools for small business marketing" });

  assert.equal(response.status, 201);
  assert.equal(fixture.state.conversations.length, 1);
  assert.equal(fixture.state.messages.length, 2);
  assert.equal(fixture.state.messages[0].role, "user");
  assert.equal(fixture.state.messages[1].role, "assistant");
});

test("disabled research is stored gracefully and internal link suggestions use published posts only", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.messages.push({
    id: "message-seed",
    conversationId: conversation.id,
    role: "user",
    content: conversation.topic,
    metadataJson: null,
    createdAt: now(),
  });
  fixture.state.briefs.set(conversation.id, {
    id: "brief-1",
    conversationId: conversation.id,
    topic: conversation.topic,
    audience: "Owners",
    goal: "Teach",
    tone: "Helpful",
    primaryKeyword: "AI tools",
    secondaryKeywordsJson: JSON.stringify(["AI marketing"]),
    wordCount: 1200,
    contentType: "guide",
    cta: "Get help",
    notes: null,
    approvedAt: new Date(),
  });

  let capturedInternalLinks: any[] = [];
  const researchService = createResearchService({
    providerName: "disabled",
    runResearch: async ({ internalLinkSuggestions }) => {
      capturedInternalLinks = internalLinkSuggestions;
      return {
        provider: "disabled",
        status: "disabled",
        topicSummary: "Research disabled.",
        searchIntent: "Informational",
        keywordIdeas: ["ai tools"],
        relatedQuestions: [],
        competitorNotes: [],
        contentGaps: [],
        sources: [],
        internalLinkSuggestions,
        riskFlags: [],
      };
    },
  });

  const app = createTestApp(
    "/api/admin/ai",
    createAdminAiRouter({
      prismaClient: fixture.prismaClient as any,
      aiService: createAiService(),
      researchService,
    })
  );

  const response = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/research`)
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.research.status, "disabled");
  assert.ok(Array.isArray(response.body.research.internalLinkSuggestions));
  assert.ok(capturedInternalLinks.every((entry) => entry.slug !== "draft-guide"));
});

test("source approval state is saved on the research record", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.researches.set(conversation.id, {
    id: "research-1",
    conversationId: conversation.id,
    provider: "mock",
    status: "completed",
    topicSummary: "Summary",
    searchIntent: "Intent",
    keywordIdeasJson: JSON.stringify([]),
    relatedQuestionsJson: JSON.stringify([]),
    competitorNotesJson: JSON.stringify([]),
    contentGapsJson: JSON.stringify([]),
    sourceNotesJson: JSON.stringify([
      {
        id: "source-1",
        title: "Source One",
        url: "https://example.com/source",
        publisher: "Example",
        publishedDate: null,
        summary: "Summary",
        usefulness: "high",
        notes: ["Useful"],
        approvalStatus: "needs_review",
        adminNotes: "",
      },
    ]),
    internalLinkOpportunitiesJson: JSON.stringify([]),
    riskFlagsJson: JSON.stringify([]),
  });

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));
  const response = await request(app)
    .put(`/api/admin/ai/conversations/${conversation.id}/research`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({
      sources: [{ id: "source-1", approvalStatus: "approved", adminNotes: "Looks credible." }],
    });

  assert.equal(response.status, 200);
  const savedSources = JSON.parse(fixture.state.researches.get(conversation.id).sourceNotesJson);
  assert.equal(savedSources[0].approvalStatus, "approved");
  assert.equal(savedSources[0].adminNotes, "Looks credible.");
});

test("conversation archive state is saved and list filters respect archived status", async () => {
  const fixture = createFixture();
  const activeConversation = fixture.seedConversation({ topic: "Active conversation", title: "Active conversation" });
  const archivedConversation = fixture.seedConversation({
    topic: "Archived conversation",
    title: "Archived conversation",
    archivedAt: now(),
  } as any);

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));

  const archiveResponse = await request(app)
    .post(`/api/admin/ai/conversations/${activeConversation.id}/archive`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ archived: true });

  assert.equal(archiveResponse.status, 200);
  assert.ok(fixture.state.conversations.find((item) => item.id === activeConversation.id)?.archivedAt);

  const activeList = await request(app)
    .get("/api/admin/ai/conversations?filter=active")
    .set("Authorization", `Bearer ${createToken()}`);
  assert.equal(activeList.status, 200);
  assert.equal(activeList.body.items.some((item: any) => item.id === activeConversation.id), false);
  assert.equal(activeList.body.items.some((item: any) => item.id === archivedConversation.id), false);

  const archivedList = await request(app)
    .get("/api/admin/ai/conversations?filter=archived")
    .set("Authorization", `Bearer ${createToken()}`);
  assert.equal(archivedList.status, 200);
  assert.equal(archivedList.body.items.some((item: any) => item.id === activeConversation.id), true);
  assert.equal(archivedList.body.items.some((item: any) => item.id === archivedConversation.id), true);
});

test("conversation list pagination and search are handled server-side", async () => {
  const fixture = createFixture();
  fixture.seedConversation({ title: "Alpha SEO", topic: "Alpha SEO", updatedAt: "2026-06-09T10:03:00.000Z" });
  fixture.seedConversation({ title: "Beta AI", topic: "Beta AI", updatedAt: "2026-06-09T10:02:00.000Z" });
  fixture.seedConversation({ title: "Gamma SEO", topic: "Gamma SEO", updatedAt: "2026-06-09T10:01:00.000Z" });

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));

  const searchResponse = await request(app)
    .get("/api/admin/ai/conversations?filter=active&search=seo&page=1&pageSize=1")
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(searchResponse.status, 200);
  assert.equal(searchResponse.body.total, 2);
  assert.equal(searchResponse.body.items.length, 1);
  assert.equal(searchResponse.body.items[0].title, "Alpha SEO");
  assert.equal(searchResponse.body.hasMore, true);

  const secondPage = await request(app)
    .get("/api/admin/ai/conversations?filter=active&search=seo&page=2&pageSize=1")
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(secondPage.status, 200);
  assert.equal(secondPage.body.items.length, 1);
  assert.equal(secondPage.body.items[0].title, "Gamma SEO");
  assert.equal(secondPage.body.hasMore, false);
});

test("research failure does not break the conversation state", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  const app = createTestApp(
    "/api/admin/ai",
    createAdminAiRouter({
      prismaClient: fixture.prismaClient as any,
      aiService: createAiService(),
      researchService: createResearchService({
        providerName: "exa",
        isEnabled: () => true,
        getUnavailableReason: () => null,
        runResearch: async () => {
          throw new Error("Research provider unavailable");
        },
      }),
    })
  );

  const failure = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/research`)
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(failure.status, 502);
  const followUp = await request(app)
    .get(`/api/admin/ai/conversations/${conversation.id}`)
    .set("Authorization", `Bearer ${createToken()}`);
  assert.equal(followUp.status, 200);
  assert.equal(followUp.body.status, "active");
});

test("draft generation uses approved research only and stores the draft", async () => {
  process.env.RESEARCH_PROVIDER = "exa";
  process.env.RESEARCH_API_KEY = "test-exa-key";

  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.messages.push({
    id: "message-seed",
    conversationId: conversation.id,
    role: "user",
    content: conversation.topic,
    metadataJson: null,
    createdAt: now(),
  });
  fixture.state.briefs.set(conversation.id, {
    id: "brief-1",
    conversationId: conversation.id,
    topic: conversation.topic,
    audience: "Owners",
    goal: "Teach",
    tone: "Helpful",
    primaryKeyword: "AI tools",
    secondaryKeywordsJson: JSON.stringify(["AI marketing"]),
    wordCount: 1200,
    contentType: "guide",
    cta: "Get help",
    notes: null,
    approvedAt: new Date(),
  });
  fixture.state.researches.set(conversation.id, {
    id: "research-1",
    conversationId: conversation.id,
    provider: "mock",
    status: "completed",
    topicSummary: "Summary",
    searchIntent: "Intent",
    keywordIdeasJson: JSON.stringify([]),
    relatedQuestionsJson: JSON.stringify([]),
    competitorNotesJson: JSON.stringify([]),
    contentGapsJson: JSON.stringify([]),
    sourceNotesJson: JSON.stringify([
      {
        id: "approved-1",
        title: "Approved Source",
        url: "https://example.com/approved",
        publisher: "Example",
        publishedDate: null,
        summary: "Summary",
        usefulness: "high",
        notes: ["Use this"],
        approvalStatus: "approved",
        adminNotes: "Trusted",
      },
      {
        id: "rejected-1",
        title: "Rejected Source",
        url: "https://example.com/rejected",
        publisher: "Example",
        publishedDate: null,
        summary: "Summary",
        usefulness: "low",
        notes: ["Ignore this"],
        approvalStatus: "rejected",
        adminNotes: "Do not use",
      },
    ]),
    internalLinkOpportunitiesJson: JSON.stringify([{ postId: "published-1", title: "Published Guide", slug: "published-guide", anchorText: "Published Guide", reason: "Good fit" }]),
    riskFlagsJson: JSON.stringify([]),
  });

  let capturedResearch: AiResearchData | null | undefined;
  const app = createTestApp(
    "/api/admin/ai",
    createAdminAiRouter({
      prismaClient: fixture.prismaClient as any,
      aiService: createAiService({
        generateDraft: async (input) => {
          capturedResearch = input.research;
          return createAiService().generateDraft(input);
        },
      }),
    })
  );

  const response = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/draft`)
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(response.status, 200);
  assert.equal(capturedResearch?.sources.length, 1);
  assert.equal(capturedResearch?.sources[0].id, "approved-1");
  assert.equal(fixture.state.drafts.get(conversation.id).status, "generated");
});

test("rewrite proposals are stored server-side and applied by proposal id", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.drafts.set(conversation.id, {
    id: "draft-1",
    conversationId: conversation.id,
    title: "Draft title",
    slug: "draft-title",
    excerpt: "Excerpt",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    contentHtml: "<p>Original intro.</p>",
    faqJson: JSON.stringify([]),
    recommendationsJson: JSON.stringify([]),
    verificationNotesJson: JSON.stringify([]),
    verificationFlagsJson: JSON.stringify([]),
    engagementInsightsJson: JSON.stringify([]),
    internalLinkSuggestionsJson: JSON.stringify([]),
    researchUsed: false,
    status: "generated",
  });

  const app = createTestApp(
    "/api/admin/ai",
    createAdminAiRouter({
      prismaClient: fixture.prismaClient as any,
      aiService: createAiService({
        rewriteDraft: async (): Promise<AiRewriteProposal> => ({
          action: "improve_intro",
          label: "Improve intro",
          summary: "Sharper opening.",
          target: "contentHtml",
          preview: "<p>Improved intro.</p>",
          draftPatch: { contentHtml: "<p>Improved intro.</p>" },
        }),
      }),
    })
  );

  const proposalResponse = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/rewrite`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ action: "improve_intro" });

  assert.equal(proposalResponse.status, 200);
  assert.equal(fixture.state.proposals.length, 1);
  assert.equal(fixture.state.proposals[0].status, "proposed");

  const applyResponse = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/rewrite/${fixture.state.proposals[0].id}/apply`)
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(applyResponse.status, 200);
  assert.equal(fixture.state.drafts.get(conversation.id).contentHtml, "<p>Improved intro.</p>");
  assert.equal(fixture.state.proposals[0].status, "applied");
});

test("draft review notes and internal link suggestions are applied server-side", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.drafts.set(conversation.id, {
    id: "draft-1",
    conversationId: conversation.id,
    title: "Draft title",
    slug: "draft-title",
    excerpt: "Excerpt",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    contentHtml: "<p>See our published guide for implementation details.</p>",
    faqJson: JSON.stringify([]),
    recommendationsJson: JSON.stringify([]),
    verificationNotesJson: JSON.stringify([]),
    verificationFlagsJson: JSON.stringify([
      {
        claim: "Docker-based AI workflows need verification gates.",
        status: "needs_verification",
        recommendation: "Confirm the exact gates in the product flow.",
      },
    ]),
    engagementInsightsJson: JSON.stringify([]),
    internalLinkSuggestionsJson: JSON.stringify([
      {
        postId: "published-1",
        title: "Published Guide",
        slug: "published-guide",
        anchorText: "published guide",
        reason: "Relevant implementation reference",
      },
    ]),
    researchUsed: false,
    status: "generated",
  });

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any }));

  const reviewResponse = await request(app)
    .put(`/api/admin/ai/conversations/${conversation.id}/draft-review`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({
      verificationFlags: [
        {
          claim: "Docker-based AI workflows need verification gates.",
          status: "needs_verification",
          recommendation: "Confirm the exact gates in the product flow.",
          reviewStatus: "accepted",
          reviewNotes: "Confirmed in the current admin flow.",
        },
      ],
    });

  assert.equal(reviewResponse.status, 200);
  const savedFlags = JSON.parse(fixture.state.drafts.get(conversation.id).verificationFlagsJson);
  assert.equal(savedFlags[0].reviewStatus, "accepted");
  assert.equal(savedFlags[0].reviewNotes, "Confirmed in the current admin flow.");

  const internalLinkResponse = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/internal-link`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ suggestionIndex: 0 });

  assert.equal(internalLinkResponse.status, 200);
  assert.match(
    fixture.state.drafts.get(conversation.id).contentHtml,
    /<a[^>]+href="\/blog\/published-guide"[^>]*>published guide<\/a>/i
  );

  // Clean up env vars
  delete process.env.RESEARCH_PROVIDER;
  delete process.env.RESEARCH_API_KEY;
});

test("rejecting or applying an invalid rewrite proposal is safe", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.drafts.set(conversation.id, {
    id: "draft-1",
    conversationId: conversation.id,
    title: "Draft title",
    slug: "draft-title",
    excerpt: "Excerpt",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    contentHtml: "<p>Original intro.</p>",
    faqJson: JSON.stringify([]),
    recommendationsJson: JSON.stringify([]),
    verificationNotesJson: JSON.stringify([]),
    verificationFlagsJson: JSON.stringify([]),
    engagementInsightsJson: JSON.stringify([]),
    internalLinkSuggestionsJson: JSON.stringify([]),
    researchUsed: false,
    status: "generated",
  });
  fixture.state.proposals.push({
    id: "proposal-1",
    conversationId: conversation.id,
    draftOutputId: "draft-1",
    action: "improve_intro",
    label: "Improve intro",
    summary: "Sharper opening.",
    targetSection: "contentHtml",
    originalText: "<p>Original intro.</p>",
    proposedText: "<p>Improved intro.</p>",
    draftPatchJson: JSON.stringify({ contentHtml: "<p>Improved intro.</p>" }),
    status: "proposed",
    createdAt: now(),
    updatedAt: now(),
  });

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any, aiService: createAiService() }));

  const rejectResponse = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/rewrite/proposal-1/reject`)
    .set("Authorization", `Bearer ${createToken()}`);
  assert.equal(rejectResponse.status, 200);
  assert.equal(fixture.state.proposals[0].status, "rejected");
  assert.equal(fixture.state.drafts.get(conversation.id).contentHtml, "<p>Original intro.</p>");

  const invalidApply = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/rewrite/missing-proposal/apply`)
    .set("Authorization", `Bearer ${createToken()}`);
  assert.equal(invalidApply.status, 404);
});

test("save-draft uses approved references only, blocks unsafe URLs, and remains DRAFT", async () => {
  const fixture = createFixture();
  const conversation = fixture.seedConversation();
  fixture.state.drafts.set(conversation.id, {
    id: "draft-1",
    conversationId: conversation.id,
    title: "Draft title",
    slug: "draft-title",
    excerpt: "Excerpt",
    metaTitle: "Meta title",
    metaDescription: "Meta description",
    contentHtml: "<p>Original intro.</p>",
    categorySuggestion: "AI",
    tagsJson: JSON.stringify(["seo"]),
    faqJson: JSON.stringify([]),
    recommendationsJson: JSON.stringify([]),
    verificationNotesJson: JSON.stringify([]),
    verificationFlagsJson: JSON.stringify([]),
    engagementInsightsJson: JSON.stringify([]),
    internalLinkSuggestionsJson: JSON.stringify([]),
    researchUsed: true,
    status: "generated",
  });
  fixture.state.researches.set(conversation.id, {
    id: "research-1",
    conversationId: conversation.id,
    provider: "mock",
    status: "completed",
    topicSummary: "Summary",
    searchIntent: "Intent",
    keywordIdeasJson: JSON.stringify([]),
    relatedQuestionsJson: JSON.stringify([]),
    competitorNotesJson: JSON.stringify([]),
    contentGapsJson: JSON.stringify([]),
    sourceNotesJson: JSON.stringify([
      {
        id: "safe-source",
        title: "Approved Source",
        url: "https://example.com/approved",
        publisher: "Example",
        publishedDate: null,
        summary: "Summary",
        usefulness: "high",
        notes: [],
        approvalStatus: "approved",
        adminNotes: "",
      },
      {
        id: "bad-source",
        title: "Unsafe Source",
        url: "javascript:alert(1)",
        publisher: "Bad",
        publishedDate: null,
        summary: "Unsafe",
        usefulness: "low",
        notes: [],
        approvalStatus: "approved",
        adminNotes: "",
      },
      {
        id: "rejected-source",
        title: "Rejected Source",
        url: "https://example.com/rejected",
        publisher: "Example",
        publishedDate: null,
        summary: "Rejected",
        usefulness: "low",
        notes: [],
        approvalStatus: "rejected",
        adminNotes: "",
      },
    ]),
    internalLinkOpportunitiesJson: JSON.stringify([]),
    riskFlagsJson: JSON.stringify([]),
  });

  const app = createTestApp("/api/admin/ai", createAdminAiRouter({ prismaClient: fixture.prismaClient as any, aiService: createAiService() }));
  const response = await request(app)
    .post(`/api/admin/ai/conversations/${conversation.id}/save-draft`)
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ includeReferences: true });

  assert.equal(response.status, 201);
  const createdPost = fixture.state.posts.find((post) => post.id === response.body.postId);
  assert.equal(createdPost?.status, "DRAFT");
  assert.match(createdPost?.body || "", /Approved Source/);
  assert.doesNotMatch(createdPost?.body || "", /Rejected Source/);
  assert.doesNotMatch(createdPost?.body || "", /javascript:/i);
});
