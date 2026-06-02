import prisma from "./utils/db";
import bcrypt from "bcryptjs";

async function seed() {
  // Check if already seeded (has posts means full seed done)
  const postCount = await prisma.post.count();
  if (postCount > 0) {
    console.log("Seed: Already seeded, skipping.");
    return;
  }

  console.log("Seed: Starting...");

  // Create or ensure admin exists only when explicitly configured
  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL;
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;
  const seedAdminName = process.env.SEED_ADMIN_NAME || "Admin";

  let admin = await prisma.user.findFirst();
  if (!admin && seedAdminEmail && seedAdminPassword) {
    console.log(`Seed: Creating admin account for ${seedAdminEmail}...`);
    const hashed = await bcrypt.hash(seedAdminPassword, 12);
    admin = await prisma.user.create({
      data: { email: seedAdminEmail, password: hashed, name: seedAdminName },
    });
    console.log(`Seed: Admin created for ${seedAdminEmail}`);
  } else if (!admin) {
    console.log("Seed: No admin exists and no SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD provided. Skipping admin and sample posts.");
  }

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({ where: { slug: "ai-machine-learning" }, update: {}, create: { name: "AI & Machine Learning", slug: "ai-machine-learning", description: "Exploring artificial intelligence, LLMs, and building intelligent agents" } }),
    prisma.category.upsert({ where: { slug: "web-development" }, update: {}, create: { name: "Web Development", slug: "web-development", description: "Frontend and backend development tutorials and insights" } }),
    prisma.category.upsert({ where: { slug: "devops-infrastructure" }, update: {}, create: { name: "DevOps & Infrastructure", slug: "devops-infrastructure", description: "Deployment, Docker, CI/CD, and server management" } }),
    prisma.category.upsert({ where: { slug: "productivity-tools" }, update: {}, create: { name: "Productivity & Tools", slug: "productivity-tools", description: "Developer tools, workflows, and productivity hacks" } }),
  ]);

  // Create tags
  const tagDefs = [
    { name: "React", slug: "react" }, { name: "Next.js", slug: "nextjs" },
    { name: "TypeScript", slug: "typescript" }, { name: "Node.js", slug: "nodejs" },
    { name: "Python", slug: "python" }, { name: "Docker", slug: "docker" },
    { name: "LLM", slug: "llm" }, { name: "LangChain", slug: "langchain" },
    { name: "RAG", slug: "rag" }, { name: "PostgreSQL", slug: "postgresql" },
    { name: "Tailwind CSS", slug: "tailwind-css" }, { name: "Express", slug: "express" },
    { name: "CI/CD", slug: "ci-cd" }, { name: "Linux", slug: "linux" },
    { name: "Prompt Engineering", slug: "prompt-engineering" },
    { name: "OpenAI", slug: "openai" }, { name: "Claude", slug: "claude" },
    { name: "VPS", slug: "vps" }, { name: "Security", slug: "security" },
    { name: "Automation", slug: "automation" },
  ];
  const tags = await Promise.all(
    tagDefs.map((t) => prisma.tag.upsert({ where: { slug: t.slug }, update: {}, create: t }))
  );

  // Create posts
  const posts = [
    { title: "Building AI Agents with LangChain: A Practical Guide", slug: "building-ai-agents-langchain", excerpt: "Learn how to build production-ready AI agents using LangChain, from simple chains to complex multi-step reasoning systems.", status: "PUBLISHED", categoryId: categories[0].id, tagIndices: [6, 7, 4, 19] },
    { title: "Setting Up a VPS for Production: The Complete Checklist", slug: "vps-production-setup-checklist", excerpt: "Everything you need to do after getting a fresh VPS - security hardening, Docker, Nginx, SSL, and monitoring.", status: "PUBLISHED", categoryId: categories[2].id, tagIndices: [13, 5, 17, 18] },
    { title: "Next.js App Router: Lessons from Building a Portfolio Site", slug: "nextjs-app-router-lessons", excerpt: "Practical insights from using Next.js App Router in production - server components, caching gotchas, and performance wins.", status: "PUBLISHED", categoryId: categories[1].id, tagIndices: [0, 1, 2, 5] },
    { title: "Prompt Engineering Patterns That Actually Work", slug: "prompt-engineering-patterns", excerpt: "Battle-tested prompt patterns for getting consistent, high-quality output from LLMs.", status: "PUBLISHED", categoryId: categories[0].id, tagIndices: [14, 6, 15, 16] },
    { title: "Docker Compose for Full-Stack Development", slug: "docker-compose-full-stack", excerpt: "How to set up Docker Compose for a full-stack app with hot reload, PostgreSQL, and production-ready configuration.", status: "PUBLISHED", categoryId: categories[2].id, tagIndices: [5, 3, 9, 12] },
    { title: "Building a RAG System from Scratch", slug: "building-rag-system", excerpt: "Step-by-step guide to building a Retrieval-Augmented Generation system.", status: "PUBLISHED", categoryId: categories[0].id, tagIndices: [6, 8, 7, 4] },
    { title: "TypeScript Type Gymnastics: Advanced Patterns", slug: "typescript-advanced-patterns", excerpt: "Deep dive into advanced TypeScript - conditional types, template literals, and type-safe APIs.", status: "PUBLISHED", categoryId: categories[1].id, tagIndices: [2, 0, 3] },
    { title: "My Development Workflow in 2026", slug: "development-workflow-2026", excerpt: "The tools, scripts, and habits that make me productive - from terminal setup to AI-assisted coding.", status: "PUBLISHED", categoryId: categories[3].id, tagIndices: [19] },
    { title: "PostgreSQL Performance Tips for Developers", slug: "postgresql-performance-tips", excerpt: "Practical PostgreSQL optimization - indexes, query analysis, and connection pooling.", status: "PUBLISHED", categoryId: categories[1].id, tagIndices: [9, 3, 11] },
    { title: "Automating Social Media with AI Agents", slug: "automating-social-media-ai", excerpt: "How I built an AI agent that generates and schedules social media content from blog posts.", status: "PUBLISHED", categoryId: categories[0].id, tagIndices: [6, 19, 15] },
    { title: "Tailwind CSS v4: What Changed and What I Love", slug: "tailwind-css-v4-changes", excerpt: "A look at Tailwind CSS v4 - the new engine, CSS-first config, OKLCH colors, and breaking changes.", status: "PUBLISHED", categoryId: categories[1].id, tagIndices: [10, 0, 1] },
  ];

  if (admin) {
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const existing = await prisma.post.findUnique({ where: { slug: p.slug } });
      if (existing) continue;

      const daysAgo = (posts.length - i) * 2;
      const publishedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      await prisma.post.create({
        data: {
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          body: `# ${p.title}\n\nThis is a sample blog post. Edit it from the admin panel to add your own content.\n\n## Getting Started\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n\`\`\`javascript\nconst example = "Hello World";\nconsole.log(example);\n\`\`\`\n\n## Key Takeaways\n\n1. First key point about this topic\n2. Second key point with **bold emphasis**\n3. Third key point with a [link](https://example.com)\n\n> This is a blockquote with an important insight.`,
          status: p.status,
          publishedAt: p.status === "PUBLISHED" ? publishedAt : null,
          readingTime: 5 + Math.floor(Math.random() * 5),
          authorId: admin.id,
          categoryId: p.categoryId,
          tags: { connect: p.tagIndices.map((idx: number) => ({ id: tags[idx].id })) },
        },
      });
      console.log(`Seed: Created post "${p.title}"`);
    }
  } else {
    console.log("Seed: Skipped sample posts because no admin account is configured.");
  }

  // Create projects
  const projects = [
    { title: "MyPLWeb Portfolio", description: "Personal portfolio and blog platform built with Next.js and Express. Features a full admin CMS, real-time content management, and responsive design.", techStack: ["Next.js", "TypeScript", "Express", "PostgreSQL", "Docker", "Tailwind CSS"], featured: true },
    { title: "AI Research Agent", description: "An autonomous research agent that searches the web, synthesizes findings, and generates structured reports. Built with LangChain and OpenAI.", techStack: ["Python", "LangChain", "OpenAI", "FastAPI", "ChromaDB"], featured: true },
    { title: "Markdown Blog Engine", description: "A lightweight blog engine with SSR, syntax highlighting, RSS feed generation, and full-text search. Optimized for performance and SEO.", techStack: ["Node.js", "Markdown", "SQLite", "HTMX"], featured: true },
    { title: "Task Automation CLI", description: "A command-line tool for automating repetitive development tasks - project scaffolding, deployment scripts, and git workflow management.", techStack: ["Node.js", "TypeScript", "Commander.js", "Inquirer"], featured: false },
    { title: "RAG Chat Interface", description: "A retrieval-augmented generation chatbot that answers questions from your own documents. Supports PDF, Markdown, and plain text with semantic search.", techStack: ["Next.js", "LangChain", "OpenAI", "PGVector", "Tailwind CSS"], featured: true },
    { title: "API Monitoring Dashboard", description: "Real-time API health monitoring with uptime tracking, response time graphs, and alert notifications.", techStack: ["React", "Node.js", "PostgreSQL", "Redis", "Chart.js"], featured: false },
    { title: "E-commerce Starter Kit", description: "A production-ready e-commerce template with product management, cart, Stripe payments, and order tracking.", techStack: ["Next.js", "TypeScript", "Stripe", "Prisma", "Tailwind CSS"], featured: false },
    { title: "AI Content Generator", description: "Batch content generation tool powered by LLMs. Generates blog posts, social media updates, and newsletters from brief descriptions.", techStack: ["Python", "OpenAI", "Celery", "Redis", "PostgreSQL"], featured: false },
  ];

  for (let i = 0; i < projects.length; i++) {
    const p = projects[i];
    await prisma.project.upsert({
      where: { id: `proj-${i + 1}` },
      update: {},
      create: { id: `proj-${i + 1}`, title: p.title, description: p.description, techStack: p.techStack, featured: p.featured, order: i },
    });
  }
  console.log(`Seed: Created ${projects.length} projects`);

  // Create experience entries
  const experiences = [
    { role: "Full-Stack Developer & AI Engineer", period: "2024 - Present", description: "Building AI-powered applications and web platforms. Specializing in Next.js, Express, and LLM integration for production systems.", order: 0 },
    { role: "Frontend Developer", period: "2022 - 2024", description: "Developed responsive web applications with React and TypeScript. Focused on performance optimization and accessibility.", order: 1 },
    { role: "Freelance Developer", period: "2020 - 2022", description: "Delivered web applications for startups and small businesses. Specialized in React frontends and Node.js APIs.", order: 2 },
    { role: "Computer Science Student", period: "2017 - 2020", description: "Studied computer science with a focus on software engineering and AI. Built multiple projects including a campus event platform.", order: 3 },
  ];
  for (const exp of experiences) {
    await prisma.experience.upsert({
      where: { id: `exp-${exp.order}` },
      update: {},
      create: { id: `exp-${exp.order}`, ...exp },
    });
  }
  console.log(`Seed: Created ${experiences.length} experience entries`);

  console.log("Seed: Complete.");
}

seed()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
