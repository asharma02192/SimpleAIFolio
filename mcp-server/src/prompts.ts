export interface PromptDef {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required?: boolean }>;
}

export const promptDefs: PromptDef[] = [
  {
    name: "write-blog-post",
    description: "Create a complete blog post from a topic. Guides through listing categories/tags, creating the post with SEO meta, and publishing as a draft.",
    arguments: [
      { name: "topic", description: "The blog post topic/title", required: true },
      { name: "audience", description: "Target audience (e.g. 'developers', 'marketers')" },
    ],
  },
  {
    name: "review-draft",
    description: "Review a blog post for quality, SEO, readability, and suggest improvements. Reads the post by ID or slug.",
    arguments: [
      { name: "identifier", description: "Post ID (UUID) or slug", required: true },
    ],
  },
  {
    name: "content-audit",
    description: "Audit all published posts to identify stale content, missing SEO meta, thin posts, and tagging gaps. Uses the published posts resource.",
    arguments: [],
  },
  {
    name: "weekly-summary",
    description: "Generate a weekly summary: posts published, page views, top content, newsletter growth, and recommendations for next week.",
    arguments: [],
  },
  {
    name: "setup-portfolio",
    description: "Interactive onboarding agent that interviews the user about themselves, then populates their entire portfolio site — settings, skills, experience, projects, social links, blog categories, and theme. Ideal for first-time setup or complete rebrand. Works best when the user gives a few sentences about who they are.",
    arguments: [
      { name: "info", description: "Optional: Any information about yourself (name, profession, skills, experience, projects, social links). If omitted, the agent will ask interactively." },
    ],
  },
  {
    name: "refresh-portfolio",
    description: "Update or add to an existing portfolio. Adds new projects, experience entries, or skills without overwriting existing content. Also useful for updating bio text or social links.",
    arguments: [
      { name: "changes", description: "What to update or add (e.g. 'add a new project', 'update my bio', 'add 3 more skills')" },
    ],
  },
];

export function getPrompt(name: string, args: Record<string, unknown>): { description: string; messages: Array<{ role: string; content: { type: string; text: string } }> } | null {
  switch (name) {
    case "write-blog-post": {
      const topic = String(args.topic || "");
      const audience = String(args.audience || "");
      return {
        description: `Create a blog post about "${topic}"`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `I want to create a new blog post.`,
                ``,
                `Topic: ${topic || "[specify topic]"}`,
                audience ? `Target audience: ${audience}` : "",
                ``,
                `Please help me:`,
                `1. First, list all available categories and tags using the list_categories and list_tags tools`,
                `2. Write a compelling title and 1500-2000 word article body in HTML`,
                `3. Write a 1-2 sentence excerpt for listings`,
                `4. Set SEO metaTitle and metaDescription`,
                `5. Create the post as a DRAFT using the create_post tool with the appropriate category and tags`,
                ``,
                `After creating the draft, show me a summary with the post ID and a preview URL.`,
              ].filter(Boolean).join("\n"),
            },
          },
        ],
      };
    }

    case "review-draft": {
      const identifier = String(args.identifier || "");
      return {
        description: `Review post: ${identifier}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Please review the blog post identified by "${identifier}".`,
                ``,
                `1. Fetch the full post using get_post (try by slug first, then by ID if needed)`,
                `2. Evaluate:`,
                `   - Title quality: Is it compelling? Does it include keywords?`,
                `   - Content depth: Is the article long enough? Are key points covered?`,
                `   - SEO: Are metaTitle and metaDescription set? Is there a good keyword distribution?`,
                `   - Readability: Are paragraphs short? Is there good use of headings?`,
                `   - Structure: Is there a clear intro, body, and conclusion?`,
                `3. Check reactions and comments using get_post_reactions and get_post_comments`,
                `4. Provide specific, actionable recommendations for improvement`,
                ``,
                `Format your review as a scored report (0-10 for each dimension) with specific suggestions.`,
              ].join("\n"),
            },
          },
        ],
      };
    }

    case "content-audit": {
      return {
        description: "Audit all published content",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Please perform a comprehensive content audit of this blog.`,
                ``,
                `1. Fetch all published posts using list_posts with a high perPage value`,
                `2. Read the posts://published resource for a quick overview`,
                `3. For each post, evaluate:`,
                `   - Does it have metaTitle and metaDescription set?`,
                `   - Is the excerpt populated?`,
                `   - Does it have tags assigned?`,
                `   - Is the reading time reasonable (not too thin)?`,
                `   - When was it last updated? Is it stale?`,
                `4. Also check the site://stats resource for overall performance`,
                `5. Produce a report with:`,
                `   - Posts missing SEO meta (list with IDs)`,
                `   - Posts with no tags (list with IDs)`,
                `   - Posts that may be stale (>6 months old, list with IDs)`,
                `   - Top performing posts by page views`,
                `   - Content gaps (topics that don't have coverage yet)`,
                ``,
                `Prioritize recommendations by impact.`,
              ].join("\n"),
            },
          },
        ],
      };
    }

    case "weekly-summary": {
      return {
        description: "Weekly content summary",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `Generate a weekly summary report for this blog.`,
                ``,
                `1. Get dashboard stats with a 7-day window using get_dashboard_stats`,
                `2. List posts published in the last week (check list_posts for recent publishedAt)`,
                `3. Check newsletter subscriber count using the newsletter://subscribers/count resource`,
                `4. Read the posts://scheduled resource for upcoming scheduled content`,
                `5. Summarize:`,
                `   - How many posts were published this week?`,
                `   - Total page views and top pages`,
                `   - Newsletter growth (new subscribers)`,
                `   - AI usage and cost summary`,
                `   - What's scheduled for next week?`,
                `   - Recommendations for next week's content`,
              ].join("\n"),
            },
          },
        ],
      };
    }

    case "setup-portfolio": {
      const info = String(args.info || "");
      return {
        description: "Portfolio onboarding — set up the entire site from user information",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: setupPortfolioPrompt(info),
            },
          },
        ],
      };
    }

    case "refresh-portfolio": {
      const changes = String(args.changes || "");
      return {
        description: "Update existing portfolio content",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: refreshPortfolioPrompt(changes),
            },
          },
        ],
      };
    }

    default:
      return null;
  }
}

function setupPortfolioPrompt(info: string): string {
  const hasInfo = info.trim().length > 0;
  return [
    `You are a portfolio onboarding agent. Your job is to set up the user's entire portfolio website by collecting their information and populating every section of the site using the available MCP tools.`,
    ``,
    `## Phase 1: Gather Information`,
    ``,
    hasInfo
      ? `The user has provided some initial information. Use it as a starting point and ask follow-up questions only for anything missing:`
      : `Ask the user about themselves. You need the following information. Ask in 2-3 natural questions (not a rigid form) — group related items so it feels like a conversation:`,
    ``,
    `You need ALL of the following before proceeding to Phase 2:`,
    ``,
    `1. **Name & Profession** — Their full name and what they do (e.g. "Full-stack developer", "UX designer")`,
    `2. **Tagline** — A one-line description for the hero section (e.g. "I build fast web apps with React and Node.js")`,
    `3. **Bio** — 2-3 paragraphs for the about page. Ask them to describe their background, what they specialize in, and what excites them.`,
    `4. **Hero Stats** — 2-4 quick highlights for the homepage (e.g. "8+ Years Experience", "50+ Projects Shipped", "12 Open Source Repos"). Ask them for impressive numbers.`,
    `5. **Skills** — Grouped by category. Ask "What technologies do you work with?" and organize into groups like:`,
    `   Frontend: React, Next.js, TypeScript, Tailwind CSS`,
    `   Backend: Node.js, Express, PostgreSQL, Redis`,
    `   DevOps: Docker, AWS, GitHub Actions`,
    `   Each skill has a "level" field — set to "expert", "advanced", or "intermediate" based on context.`,
    `6. **Experience** — 2-5 roles. For each: job title, company, time period (e.g. "2022 - Present"), and 1-2 sentences about what they did.`,
    `7. **Projects** — 2-4 portfolio projects. For each: title, description (2-3 sentences), tech stack (list of technologies), live URL (if any), GitHub URL (if any). Ask which one should be "featured".`,
    `8. **Social Links** — GitHub, LinkedIn, Twitter/X, and email address.`,
    `9. **Theme Preference** — Ask if they prefer light, dark, or monochrome/minimalist. Options: "light-minimal" (warm light), "dark-modern" (dark charcoal), "mono-editorial" (black & white print style).`,
    `10. **Blog Categories** — Ask what topics they plan to blog about (e.g. "Web Development", "AI", "Career"). Create these as categories.`,
    ``,
    `## Phase 2: Check Existing Content`,
    ``,
    `Before writing anything, check what already exists so you don't create duplicates:`,
    `- Call \`get_settings\` to see current site settings`,
    `- Call \`list_categories\` to see existing categories`,
    `- Call \`list_experience\` to see existing timeline entries`,
    `- Call \`list_projects\` to see existing projects`,
    ``,
    `If the site already has content (e.g. existing settings with a real site_title, or existing experience entries), tell the user what's there and ASK whether to overwrite or add alongside. Do NOT silently overwrite.`,
    ``,
    `## Phase 3: Populate Everything`,
    ``,
    `Once you have all the information and the user confirms, execute these steps in order. Call tools ONE AT A TIME and report progress after each:`,
    ``,
    `### Step 1: Site Settings`,
    `Call \`update_settings\` with an \`updates\` object containing:`,
    `- \`site_title\`: Their name`,
    `- \`tagline\`: Their tagline`,
    `- \`description\`: Their tagline or a slightly longer version`,
    `- \`author_name\`: Their name`,
    `- \`bio_hero\`: Their tagline or a punchy intro sentence for the homepage hero`,
    `- \`bio_about_1\`, \`bio_about_2\`, \`bio_about_3\`: Their bio paragraphs`,
    `- \`hero_stats\`: Array of \`{ "value": "8+", "label": "Years Experience" }\` objects`,
    `- \`skill_groups\`: Array of \`{ "category": "Frontend", "skills": [{ "name": "React", "level": "expert" }] }\` objects`,
    `- \`social_links\`: \`{ "github": "https://github.com/username", "linkedin": "...", "twitter": "...", "email": "user@example.com" }\``,
    `- \`theme\`: The chosen theme ID`,
    ``,
    `Example call:`,
    `\`\`\``,
    `update_settings({`,
    `  updates: {`,
    `    site_title: "Jane Doe",`,
    `    tagline: "Full-stack developer building fast web apps",`,
    `    author_name: "Jane Doe",`,
    `    bio_hero: "I build fast, accessible web apps with React and Node.js.",`,
    `    bio_about_1: "I'm a full-stack developer with 8 years of experience...",`,
    `    bio_about_2: "I specialize in React, Next.js, and Node.js...",`,
    `    bio_about_3: "When I'm not coding, I write about web development...",`,
    `    hero_stats: [`,
    `      { value: "8+", label: "Years Experience" },`,
    `      { value: "50+", label: "Projects Shipped" }`,
    `    ],`,
    `    skill_groups: [`,
    `      { category: "Frontend", skills: [`,
    `        { name: "React", level: "expert" },`,
    `        { name: "TypeScript", level: "advanced" }`,
    `      ]},`,
    `      { category: "Backend", skills: [`,
    `        { name: "Node.js", level: "expert" },`,
    `        { name: "PostgreSQL", level: "advanced" }`,
    `      ]}`,
    `    ],`,
    `    social_links: {`,
    `      github: "https://github.com/amit",`,
    `      linkedin: "https://linkedin.com/in/amit",`,
    `      twitter: "",`,
    `      email: "amit@example.com"`,
    `    },`,
    `    theme: "dark-modern"`,
    `  }`,
    `})`,
    `\`\`\``,
    `Say: "✅ Site settings configured (name, bio, skills, social links, theme)"`,
    ``,
    `### Step 2: Experience Timeline`,
    `For each role, call \`create_experience\` in order (oldest first — set \`order\` starting at 0):`,
    `- \`{ role: "Senior Developer", period: "2022 - Present", description: "...", order: 0 }\``,
    `- \`{ role: "Developer", period: "2019 - 2022", description: "...", order: 1 }\``,
    `Say: "✅ Created N experience entries"`,
    ``,
    `### Step 3: Projects`,
    `For each project, call \`create_project\`:`,
    `- \`{ title: "E-commerce Platform", description: "...", techStack: ["React", "Node.js", "Stripe"], liveUrl: "https://...", githubUrl: "https://...", featured: true, order: 0 }\``,
    `Set \`featured: true\` only on the 1-2 best projects. Set \`order\` starting at 0.`,
    `Say: "✅ Created N projects"`,
    ``,
    `### Step 4: Blog Categories`,
    `For each topic, call \`create_category\`:`,
    `- \`{ name: "Web Development", slug: "web-development", description: "Articles about web development" }\``,
    `Then create common tags with \`create_tag\`:`,
    `- \`{ name: "React", slug: "react" }\`, \`{ name: "TypeScript", slug: "typescript" }\``,
    `Say: "✅ Created N categories and M tags"`,
    ``,
    `## Phase 4: Verify`,
    ``,
    `After all tools have been called, verify the setup by reading back:`,
    `- Call \`get_settings\` — confirm the name, tagline, theme, and bio are set`,
    `- Call \`list_experience\` — confirm experience entries are created`,
    `- Call \`list_projects\` — confirm projects are created`,
    `- Call \`list_categories\` — confirm categories are created`,
    ``,
    `## Phase 5: Summary`,
    ``,
    `Provide a summary of everything that was set up:`,
    `- "Your portfolio is ready! Here's what I configured:"`,
    `- Site name, tagline, and theme`,
    `- Number of experience entries and projects`,
    `- Categories and tags created`,
    `- Social links configured`,
    `- A link to view the site at the homepage URL`,
    `- Suggest next steps: "Want me to write your first blog post?" or "Want to add more projects?"`,
    ``,
    `## Rules`,
    `- NEVER create duplicate content. Always check what exists first.`,
    `- ALWAYS generate proper URL slugs (lowercase, hyphenated, no special characters).`,
    `- If a tool call fails, report the error clearly and try to fix it (e.g. slug collision → append a number).`,
    `- If the user gives a resume or LinkedIn URL instead of answering questions, parse whatever info is in there and ask only for what's missing.`,
    `- Keep the conversation friendly and natural. Don't dump a giant form — ask in digestible chunks.`,
    `- The user can say "skip" for any section — respect that and move on.`,
  ].join("\n");
}

function refreshPortfolioPrompt(changes: string): string {
  const hasChanges = changes.trim().length > 0;
  return [
    `You are a portfolio update assistant. The user wants to update their existing portfolio.`,
    ``,
    hasChanges ? `The user wants to: ${changes}` : `Ask the user what they'd like to update or add.`,
    ``,
    `## Step 1: Review Current State`,
    ``,
    `Before making changes, read the current state so you understand what exists:`,
    `- Call \`get_settings\` to see current site settings, skills, bio, social links`,
    `- Call \`list_experience\` to see existing timeline entries`,
    `- Call \`list_projects\` to see existing projects`,
    `- Call \`list_categories\` and \`list_tags\` to see taxonomy`,
    ``,
    `Summarize what's currently on the site so the user can see the starting point.`,
    ``,
    `## Step 2: Make Changes`,
    ``,
    `Based on what the user wants:`,
    ``,
    `- **Add a project**: Call \`create_project\` with title, description, techStack, links`,
    `- **Update bio**: Call \`update_settings\` with new \`bio_about_1\`, \`bio_about_2\`, \`bio_about_3\` values`,
    `- **Add experience**: Call \`create_experience\` with role, period, description (set \`order\` based on existing count)`,
    `- **Add skills**: Read current \`skill_groups\` from settings, add new skills to the appropriate group, call \`update_settings\` with the full updated array`,
    `- **Update social links**: Call \`update_settings\` with new \`social_links\` object`,
    `- **Change theme**: Call \`update_settings\` with \`{ theme: "dark-modern" }\``,
    `- **Add blog category**: Call \`create_category\``,
    ``,
    `## Step 3: Verify & Summarize`,
    ``,
    `Read back the changed sections to confirm they saved correctly.`,
    `Tell the user exactly what was added or changed.`,
    ``,
    `## Rules`,
    `- NEVER overwrite existing content without confirming with the user first.`,
    `- When updating settings that contain arrays (skill_groups, hero_stats), ALWAYS read the current value first and merge — never replace the entire array.`,
    `- When adding experience, set \`order\` to the next available number (count existing entries).`,
    `- Generate proper slugs for any new content.`,
  ].join("\n");
}
