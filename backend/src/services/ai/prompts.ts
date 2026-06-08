import type { AiChatMessage } from "./provider";
import type { AiBriefInput, AiDraftInput, AiRewriteAction, AiDraftData, AiResearchData, AiBriefData } from "./blog-studio";

const BLOG_STUDIO_SYSTEM_PROMPT = `
You are an expert blog strategist, SEO editor, researcher, and content writer.

Your job is to help an admin create high-quality blog posts for their website.

Rules:
- Do not write the full blog immediately.
- First ask clarification questions.
- Ask maximum 5 questions at a time.
- If enough context is available, create a content brief.
- Write in a natural, human, expert tone.
- Avoid generic AI-style wording.
- Avoid keyword stuffing.
- Keep paragraphs short.
- Use SEO headings naturally.
- Include practical examples where useful.
- Never invent statistics or factual claims without marking them as unverified.
- Never auto-publish.
- Save only as draft when the admin explicitly requests it.
`.trim();

function serializeMessages(messages: Array<{ role: string; content: string }>) {
  return messages
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

export function buildClarificationMessages(input: {
  topic: string;
  messages: Array<{ role: string; content: string }>;
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: BLOG_STUDIO_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: [
        `The admin wants to create a blog post about: "${input.topic}".`,
        "Respond as a chat assistant inside an admin CMS.",
        "Ask the next best clarification questions only.",
        "Maximum 5 questions.",
        "If enough context already exists in the transcript, say that the brief is ready and suggest generating it.",
        "",
        "Conversation transcript:",
        serializeMessages(input.messages),
      ].join("\n"),
    },
  ];
}

export function buildBriefMessages(input: AiBriefInput): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.`,
    },
    {
      role: "user",
      content: [
        `Create a structured content brief for the topic "${input.topic}".`,
        "Use the conversation transcript below.",
        "Fill in these fields: topic, audience, goal, tone, primaryKeyword, secondaryKeywords, wordCount, contentType, cta, notes.",
        "Keep it production-ready for an SEO-focused editorial workflow.",
        "",
        "Conversation transcript:",
        serializeMessages(input.messages),
        "",
        "JSON schema:",
        JSON.stringify({
          topic: "string",
          audience: "string",
          goal: "string",
          tone: "string",
          primaryKeyword: "string",
          secondaryKeywords: ["string"],
          wordCount: 1800,
          contentType: "guide",
          cta: "string",
          notes: "string",
        }),
      ].join("\n"),
    },
  ];
}

export function buildDraftMessages(input: AiDraftInput): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Do not include a status field. The backend controls draft status.
Write the article body as safe semantic HTML using headings, paragraphs, lists, blockquotes, code blocks, and strong emphasis where useful.`,
    },
    {
      role: "user",
      content: [
        `Generate a full blog draft for the topic "${input.brief.topic || input.topic}".`,
        "Use the approved content brief below.",
        "Generate title options mentally, but return the single strongest final option in the title field.",
        "Include SEO metadata, slug, excerpt, outline, FAQ, contentHtml, category/tag suggestions, scores, and recommendations.",
        "If facts are uncertain, avoid inventing precise statistics.",
        "If research is available, use it to improve the content angle and call out anything that still needs verification.",
        input.historicalContext
          ? `Historical context:\n${input.historicalContext}`
          : "Historical context: Not enough historical engagement data yet. Using best-practice scoring.",
        input.research
          ? `Research notes:\n${JSON.stringify(input.research)}`
          : "Research notes: No live research is available. Use best-practice editorial guidance only.",
        "",
        "Approved brief:",
        JSON.stringify(input.brief),
        "",
        "Conversation transcript:",
        serializeMessages(input.messages),
        "",
        "JSON schema:",
        JSON.stringify({
          title: "string",
          slug: "string",
          excerpt: "string",
          metaTitle: "string",
          metaDescription: "string",
          ogImagePrompt: "string",
          categorySuggestion: "string",
          tagSuggestions: ["string"],
          outline: [
            {
              heading: "string",
              points: ["string"],
            },
          ],
          contentHtml: "string",
          faq: [
            {
              question: "string",
              answer: "string",
            },
          ],
          seoScore: 82,
          engagementScore: 76,
          readabilityScore: 80,
          recommendations: ["string"],
          verificationNotes: ["string"],
          verificationFlags: [
            {
              claim: "string",
              status: "supported",
              sourceId: "optional string",
              recommendation: "string",
            },
          ],
          engagementInsights: ["string"],
          internalLinkSuggestions: [
            {
              postId: "string",
              title: "string",
              slug: "string",
              anchorText: "string",
              reason: "string",
            },
          ],
          researchUsed: true,
        }),
      ].join("\n"),
    },
  ];
}

export function buildAnalyzeMessages(input: {
  topic: string;
  brief: Record<string, unknown>;
  draft: Record<string, unknown>;
  historicalContext?: string | null;
  research?: Record<string, unknown> | null;
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.`,
    },
    {
      role: "user",
      content: [
        `Analyze this draft for the topic "${input.topic}".`,
        "Score it for SEO, engagement, and readability.",
        "Return recommendations, verificationNotes, verificationFlags, engagementInsights, and internalLinkSuggestions as concise structured output.",
        input.historicalContext
          ? `Historical context:\n${input.historicalContext}`
          : "Historical context: Not enough historical engagement data yet. Using best-practice scoring.",
        input.research
          ? `Research notes:\n${JSON.stringify(input.research)}`
          : "Research notes: No live research available.",
        "",
        "Brief:",
        JSON.stringify(input.brief),
        "",
        "Draft:",
        JSON.stringify(input.draft),
        "",
        "JSON schema:",
        JSON.stringify({
          seoScore: 80,
          engagementScore: 75,
          readabilityScore: 78,
          recommendations: ["string"],
          verificationNotes: ["string"],
          verificationFlags: [
            {
              claim: "string",
              status: "supported",
              sourceId: "optional string",
              recommendation: "string",
            },
          ],
          engagementInsights: ["string"],
          internalLinkSuggestions: [
            {
              postId: "string",
              title: "string",
              slug: "string",
              anchorText: "string",
              reason: "string",
            },
          ],
        }),
      ].join("\n"),
    },
  ];
}

export function buildResearchSynthesisMessages(input: {
  topic: string;
  brief: AiBriefData | null;
  transcript: Array<{ role: string; content: string }>;
  rawSources: unknown[];
  internalLinkSuggestions: Array<{
    postId: string;
    title: string;
    slug: string;
    anchorText: string;
    reason: string;
  }>;
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Do not copy long passages from sources. Summarize them briefly and conservatively.`,
    },
    {
      role: "user",
      content: [
        `Synthesize research notes for the topic "${input.topic}".`,
        "Use the source results and conversation context to produce a concise research package for an admin blog writer.",
        "Flag anything that still needs verification.",
        "",
        "Approved brief:",
        JSON.stringify(input.brief),
        "",
        "Conversation transcript:",
        serializeMessages(input.transcript),
        "",
        "Potential internal linking suggestions:",
        JSON.stringify(input.internalLinkSuggestions),
        "",
        "Source results:",
        JSON.stringify(input.rawSources),
        "",
        "JSON schema:",
        JSON.stringify({
          topicSummary: "string",
          searchIntent: "string",
          keywordIdeas: ["string"],
          relatedQuestions: ["string"],
          competitorNotes: ["string"],
          contentGaps: ["string"],
          internalLinkSuggestions: [
            {
              postId: "string",
              title: "string",
              slug: "string",
              anchorText: "string",
              reason: "string",
            },
          ],
          riskFlags: ["string"],
          sources: [
            {
              id: "string",
              title: "string",
              url: "string",
              publisher: "string",
              publishedDate: "string or null",
              summary: "string",
              usefulness: "high",
              notes: ["string"],
              approvalStatus: "needs_review",
              adminNotes: "string",
            },
          ],
        }),
      ].join("\n"),
    },
  ];
}

export function buildRewriteMessages(input: {
  topic: string;
  brief: AiBriefData | null;
  draft: AiDraftData;
  action: AiRewriteAction;
  selectedText?: string | null;
  historicalContext?: string | null;
  research?: AiResearchData | null;
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Return a proposed improvement only. Do not describe multiple alternatives.
Do not overwrite unrelated parts of the draft.`,
    },
    {
      role: "user",
      content: [
        `Create a proposal for the rewrite action "${input.action}" on this blog draft.`,
        "Return a concise proposal that the admin can review before applying.",
        input.selectedText ? `Selected text to focus on:\n${input.selectedText}` : "Selected text: none. Improve the most relevant part of the draft for this action.",
        input.historicalContext
          ? `Historical context:\n${input.historicalContext}`
          : "Historical context: Not enough historical engagement data yet. Using best-practice scoring.",
        input.research ? `Research notes:\n${JSON.stringify(input.research)}` : "Research notes: none",
        "",
        "Brief:",
        JSON.stringify(input.brief),
        "",
        "Draft:",
        JSON.stringify(input.draft),
        "",
        "JSON schema:",
        JSON.stringify({
          label: "string",
          summary: "string",
          target: "contentHtml",
          preview: "string",
          draftPatch: {
            title: "optional string",
            metaTitle: "optional string",
            metaDescription: "optional string",
            excerpt: "optional string",
            contentHtml: "optional string",
            faq: [
              {
                question: "string",
                answer: "string",
              },
            ],
            recommendations: ["string"],
            verificationNotes: ["string"],
            verificationFlags: [
              {
                claim: "string",
                status: "supported",
                sourceId: "optional string",
                recommendation: "string",
              },
            ],
            engagementInsights: ["string"],
            internalLinkSuggestions: [
              {
                postId: "string",
                title: "string",
                slug: "string",
                anchorText: "string",
                reason: "string",
              },
            ],
            researchUsed: true,
          },
        }),
      ].join("\n"),
    },
  ];
}
