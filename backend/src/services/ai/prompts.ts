import type { AiChatMessage } from "./provider";
import type { AiBriefInput, AiDraftInput, AiRewriteAction, AiDraftData, AiResearchData, AiBriefData, AiWritingProfile } from "./blog-studio";

function serializeProfile(profile: AiWritingProfile | null | undefined): string {
  if (!profile) return "No writing profile configured.";
  if (!profile.authorCredibility && profile.reusableStories.length === 0 && profile.strongOpinions.length === 0 && profile.voiceRules.length === 0 && profile.proofRequirements.length === 0) {
    return "No writing profile configured.";
  }
  return [
    profile.authorCredibility ? `Author credibility:\n${profile.authorCredibility}` : "",
    profile.reusableStories.length ? `Reusable stories/examples:\n${profile.reusableStories.map((s) => `- ${s}`).join("\n")}` : "",
    profile.strongOpinions.length ? `Strong opinions/stance:\n${profile.strongOpinions.map((s) => `- ${s}`).join("\n")}` : "",
    profile.voiceRules.length ? `Voice rules:\n${profile.voiceRules.map((s) => `- ${s}`).join("\n")}` : "",
    profile.proofRequirements.length ? `Proof requirements:\n${profile.proofRequirements.map((s) => `- ${s}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

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
        "Also fill expert fields: expertAngle, personalProofNeeded, stance, exampleRequirements, contentFormat.",
        "The expertAngle should be a unique perspective the author can own.",
        "The stance should be a clear editorial position, not neutral.",
        "The personalProofNeeded should state what real evidence/examples the author needs to provide.",
        "The exampleRequirements should specify what concrete examples, code, or data would strengthen the post.",
        "The contentFormat should suggest a structure beyond the default intro-bullets-FAQ pattern.",
        input.writingProfile ? `\nWriting profile (use this to inform the expert fields):\n${serializeProfile(input.writingProfile)}` : "",
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
          expertAngle: "string — unique perspective the author can own",
          personalProofNeeded: "string — what real evidence the author must provide",
          stance: "string — clear editorial position",
          exampleRequirements: "string — what concrete examples/code/data would strengthen this",
          contentFormat: "string — suggested structure (e.g. 'case study', 'tutorial with code', 'contrarian analysis')",
        }),
      ].join("\n"),
    },
  ];
}

export function buildDraftMessages(input: AiDraftInput): AiChatMessage[] {
  const profileBlock = input.writingProfile ? `\n\nWriting profile — use this to add author-specific evidence, opinions, examples, and voice. Do NOT fabricate personal stories or numbers that are not in the profile. If the profile lacks evidence for a claim, add a recommendation asking the author to provide it.\n${serializeProfile(input.writingProfile)}` : "";

  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Do not include a status field. The backend controls draft status.
Write the article body as safe semantic HTML using headings, paragraphs, lists, blockquotes, code blocks, and strong emphasis where useful.

Quality requirements:
- Take a clear editorial stance. Do not be neutral or wishy-washy.
- Back current facts with research sources. Do not invent statistics.
- Include concrete examples, code snippets, or tested workflow notes for technical posts.
- Vary structure — do not default to intro → bullet list → FAQ for every post.
- Write in a direct, practical voice. Avoid generic AI phrases like "In today's fast-paced world" or "It's worth noting that."
- If the writing profile is provided, weave in author-specific context where relevant.
- Never invent personal stories, numbers, GitHub stats, campaign data, or screenshots.${profileBlock}`,
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
        "Include a qualityScore object with self-assessment scores 1-10 for: accuracy, depth, originality, voice, proof, seo, overall.",
        "The qualityScore.checklist should list specific items the author should verify or improve before publishing.",
        "Be honest in the self-assessment — if the draft lacks personal proof or originality, score accordingly.",
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
          qualityScore: {
            accuracy: 8,
            depth: 7,
            originality: 6,
            voice: 5,
            proof: 4,
            seo: 8,
            overall: 6,
            checklist: ["Add a real code example", "Include author's personal experience with X", "Verify the claim about Y"],
          },
        }),
      ].join("\n"),
    },
  ];
}

const DRAFT_CONTENT_QUALITY_RULES = `
Quality requirements:
- Take a clear editorial stance. Do not be neutral or wishy-washy.
- Back current facts with research sources. Do not invent statistics.
- Include concrete examples, code snippets, or tested workflow notes for technical posts.
- Vary structure — do not default to intro → bullet list → FAQ for every post.
- Write in a direct, practical voice. Avoid generic AI phrases like "In today's fast-paced world" or "It's worth noting that."
- Never invent personal stories, numbers, GitHub stats, campaign data, or screenshots.`.trim();

export function buildDraftContentMessages(input: AiDraftInput): AiChatMessage[] {
  const profileBlock = input.writingProfile ? `\n\nWriting profile — use this to add author-specific evidence, opinions, examples, and voice. Do NOT fabricate personal stories or numbers that are not in the profile. If the profile lacks evidence for a claim, add a recommendation asking the author to provide it.\n${serializeProfile(input.writingProfile)}` : "";

  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Do not include a status field.
Write the article body as safe semantic HTML using headings, paragraphs, lists, blockquotes, code blocks, and strong emphasis where useful.

${DRAFT_CONTENT_QUALITY_RULES}${profileBlock}`,
    },
    {
      role: "user",
      content: [
        `Write the full article for the topic "${input.brief.topic || input.topic}".`,
        "Use the approved content brief below.",
        "Return ONLY the article content: title, slug, contentHtml (full article), outline, faq, and categorySuggestion.",
        "Generate the strongest single title — do not list alternatives.",
        input.historicalContext
          ? `Historical context:\n${input.historicalContext}`
          : "Historical context: Not enough data. Using best-practice scoring.",
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
          contentHtml: "string — full article as semantic HTML",
          outline: [{ heading: "string", points: ["string"] }],
          faq: [{ question: "string", answer: "string" }],
          categorySuggestion: "string",
        }),
      ].join("\n"),
    },
  ];
}

export function buildDraftMetadataMessages(input: {
  topic: string;
  brief: AiBriefData | null;
  contentSummary: { plainText: string; headings: string[]; wordCount: number; excerpt: string };
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
You are generating SEO metadata for an article that has already been written. Base all scores on the content provided.`,
    },
    {
      role: "user",
      content: [
        `Generate SEO metadata for an article about "${input.brief?.topic || input.topic}".`,
        "The article has already been written. Here is a summary of its content:",
        "",
        `Word count: ${input.contentSummary.wordCount}`,
        `Headings: ${input.contentSummary.headings.join(" | ") || "None extracted"}`,
        `Content excerpt (first 220 chars): ${input.contentSummary.excerpt}`,
        "",
        "Based on the article content and brief, produce:",
        "- excerpt: 1-2 sentence summary for listings and social sharing",
        "- metaTitle: SEO title (under 60 chars)",
        "- metaDescription: meta description (under 160 chars)",
        "- tagSuggestions: 3-8 relevant tags",
        "- ogImagePrompt: description for an Open Graph image",
        "- seoScore, engagementScore, readabilityScore: 0-100 based on content quality",
        "",
        "Brief:",
        JSON.stringify(input.brief),
        "",
        "JSON schema:",
        JSON.stringify({
          excerpt: "string",
          metaTitle: "string",
          metaDescription: "string",
          tagSuggestions: ["string"],
          ogImagePrompt: "string",
          seoScore: 82,
          engagementScore: 76,
          readabilityScore: 80,
        }),
      ].join("\n"),
    },
  ];
}

export function buildDraftReviewMessages(input: {
  topic: string;
  brief: AiBriefData | null;
  contentSummary: { plainText: string; headings: string[]; wordCount: number; excerpt: string };
  research?: AiResearchData | null;
}): AiChatMessage[] {
  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
You are reviewing an article that has already been written. Be honest in your assessment — if the article lacks personal proof or originality, score accordingly.`,
    },
    {
      role: "user",
      content: [
        `Review this article about "${input.brief?.topic || input.topic}" and generate quality scores, recommendations, and verification notes.`,
        "",
        `Word count: ${input.contentSummary.wordCount}`,
        `Headings: ${input.contentSummary.headings.join(" | ") || "None"}`,
        `Content excerpt (first 4000 chars): ${input.contentSummary.plainText}`,
        input.research ? `Research notes:\n${JSON.stringify(input.research)}` : "Research notes: none",
        "",
        "Brief:",
        JSON.stringify(input.brief),
        "",
        "Assess the article on these dimensions (1-10):",
        "- accuracy: Are claims source-backed? Any invented statistics?",
        "- depth: Does it go beyond surface-level explanations?",
        "- originality: Does it offer a unique perspective or just rehash common advice?",
        "- voice: Does it sound human and direct, or generic AI?",
        "- proof: Are there concrete examples, code, data, or personal evidence?",
        "- seo: Is the structure SEO-friendly with proper headings?",
        "- overall: Weighted average considering all factors",
        "",
        "The checklist should list specific items the author should verify or improve before publishing.",
        "If the writing profile is missing evidence, recommend what to add.",
        "",
        "JSON schema:",
        JSON.stringify({
          recommendations: ["string"],
          verificationNotes: ["string"],
          verificationFlags: [{ claim: "string", status: "supported", sourceId: "optional string", recommendation: "string" }],
          engagementInsights: ["string"],
          internalLinkSuggestions: [{ postId: "string", title: "string", slug: "string", anchorText: "string", reason: "string" }],
          qualityScore: { accuracy: 8, depth: 7, originality: 6, voice: 5, proof: 4, seo: 8, overall: 6, checklist: ["string"] },
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
  writingProfile?: AiWritingProfile | null;
}): AiChatMessage[] {
  const actionGuidance: Partial<Record<AiRewriteAction, string>> = {
    add_personal_experience: "Inject author-specific stories, examples, or evidence from the writing profile. Do NOT fabricate personal experiences that are not in the profile. If the profile lacks relevant evidence, recommend what the author should add.",
    make_more_opinionated: "Take a clearer, stronger editorial stance. Remove hedging language. State the position directly.",
    add_code_examples: "Add concrete code snippets, configuration examples, or command-line output. Use proper <pre><code> blocks.",
    add_real_workflow: "Add tested workflow notes, step-by-step processes, or real operational details that a practitioner would know.",
    reduce_generic_ai_tone: "Remove generic AI phrases ('In today's fast-paced world', 'It's worth noting', 'Delve into', etc.). Make the voice more direct, specific, and human.",
  };

  return [
    {
      role: "system",
      content: `${BLOG_STUDIO_SYSTEM_PROMPT}

Return valid JSON only. Do not wrap it in markdown fences.
Return a proposed improvement only. Do not describe multiple alternatives.
Do not overwrite unrelated parts of the draft.${input.writingProfile ? `\n\nWriting profile:\n${serializeProfile(input.writingProfile)}` : ""}`,
    },
    {
      role: "user",
      content: [
        `Create a proposal for the rewrite action "${input.action}" on this blog draft.`,
        actionGuidance[input.action] || "",
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
