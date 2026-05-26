-- Seed data for MyPLWeb
-- Run: docker exec -i myplweb-db-1 psql -U myplweb -d myplweb < seed-data.sql

-- ========== CATEGORIES ==========
INSERT INTO categories (id, name, slug, description) VALUES
  ('cat-ai', 'AI & Machine Learning', 'ai-machine-learning', 'Exploring artificial intelligence, LLMs, and building intelligent agents'),
  ('cat-webdev', 'Web Development', 'web-development', 'Frontend and backend development tutorials and insights'),
  ('cat-devops', 'DevOps & Infrastructure', 'devops-infrastructure', 'Deployment, Docker, CI/CD, and server management'),
  ('cat-productivity', 'Productivity & Tools', 'productivity-tools', 'Developer tools, workflows, and productivity hacks')
ON CONFLICT (slug) DO NOTHING;

-- ========== TAGS ==========
INSERT INTO tags (id, name, slug) VALUES
  ('tag-react', 'React', 'react'),
  ('tag-nextjs', 'Next.js', 'nextjs'),
  ('tag-typescript', 'TypeScript', 'typescript'),
  ('tag-nodejs', 'Node.js', 'nodejs'),
  ('tag-python', 'Python', 'python'),
  ('tag-docker', 'Docker', 'docker'),
  ('tag-llm', 'LLM', 'llm'),
  ('tag-langchain', 'LangChain', 'langchain'),
  ('tag-rag', 'RAG', 'rag'),
  ('tag-postgresql', 'PostgreSQL', 'postgresql'),
  ('tag-tailwind', 'Tailwind CSS', 'tailwind-css'),
  ('tag-express', 'Express', 'express'),
  ('tag-ci-cd', 'CI/CD', 'ci-cd'),
  ('tag-linux', 'Linux', 'linux'),
  ('tag-prompt-engineering', 'Prompt Engineering', 'prompt-engineering'),
  ('tag-openai', 'OpenAI', 'openai'),
  ('tag-claude', 'Claude', 'claude'),
  ('tag-vps', 'VPS', 'vps'),
  ('tag-security', 'Security', 'security'),
  ('tag-automation', 'Automation', 'automation')
ON CONFLICT (slug) DO NOTHING;

-- ========== POSTS ==========
INSERT INTO posts (id, title, slug, excerpt, body, status, "publishedAt", "readingTime", "authorId", "categoryId", "updatedAt") VALUES
  ('post-1', 'Building AI Agents with LangChain: A Practical Guide',
   'building-ai-agents-langchain',
   'Learn how to build production-ready AI agents using LangChain, from simple chains to complex multi-step reasoning systems.',
   E'# Building AI Agents with LangChain: A Practical Guide\n\nArtificial intelligence agents are transforming how we build software. Unlike simple chatbots, agents can reason, plan, and take actions autonomously.\n\n## What is an AI Agent?\n\nAn AI agent uses a large language model as its reasoning engine. Instead of just responding to prompts, an agent can **plan** multi-step approaches, **use tools** like web search or API calls, **reflect** on its own output, and **remember** context across interactions.\n\n## Setting Up LangChain\n\n```bash\nnpm install langchain @langchain/openai @langchain/community\n```\n\n## Building Your First Agent\n\n```typescript\nimport { ChatOpenAI } from "@langchain/openai";\nimport { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";\n\nconst llm = new ChatOpenAI({ modelName: "gpt-4", temperature: 0 });\nconst agent = await createOpenAIFunctionsAgent({\n  llm,\n  tools: [searchTool, summarizeTool],\n  prompt: researchPrompt,\n});\n```\n\n## Adding Memory\n\n```typescript\nimport { BufferMemory } from "langchain/memory";\nconst memory = new BufferMemory({\n  returnMessages: true,\n  memoryKey: "chat_history",\n});\n```\n\n## Key Takeaways\n\n1. Start simple — build a basic agent before adding complexity\n2. Tools are everything — the quality depends on its tools\n3. Memory matters — context windows fill up fast\n4. Test thoroughly — agents can be unpredictable',
   'PUBLISHED', NOW() - INTERVAL '14 days', 8,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-ai', NOW()),

  ('post-2', 'Setting Up a VPS for Production: The Complete Checklist',
   'vps-production-setup-checklist',
   'Everything you need to do after getting a fresh VPS — security hardening, Docker, Nginx, SSL, and monitoring.',
   E'# Setting Up a VPS for Production\n\nGetting a fresh VPS is exciting, but a lot needs to happen before it is production-ready. Here is my complete checklist.\n\n## Initial Server Setup\n\n```bash\napt update && apt upgrade -y\nadduser deploy\nusermod -aG sudo deploy\nsed -i ''s/PermitRootLogin yes/PermitRootLogin no/'' /etc/ssh/sshd_config\nsystemctl restart sshd\n```\n\n## Firewall Configuration\n\n```bash\nufw default deny incoming\nufw default allow outgoing\nufw allow 22/tcp\nufw allow 80/tcp\nufw allow 443/tcp\nufw enable\n```\n\n## Install Docker\n\n```bash\ncurl -fsSL https://get.docker.com | sh\nusermod -aG docker deploy\n```\n\n## SSL with Let''s Encrypt\n\n```bash\napt install certbot python3-certbot-nginx\napt install nginx\ncertbot --nginx -d yourdomain.com\n```\n\n## Key Takeaways\n\n1. Never run as root — always use a deploy user\n2. Firewall first — lock down everything except what you need\n3. Automate SSL renewal with cron\n4. Set up monitoring before you need it',
   'PUBLISHED', NOW() - INTERVAL '12 days', 6,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-devops', NOW()),

  ('post-3', 'Next.js App Router: Lessons from Building a Portfolio Site',
   'nextjs-app-router-lessons',
   'Practical insights from using Next.js App Router in production — server components, caching gotchas, and performance wins.',
   E'# Next.js App Router: Lessons Learned\n\nAfter building my portfolio site with the Next.js App Router, I learned several lessons the hard way.\n\n## Server Components by Default\n\nEverything is a server component unless you opt into client rendering:\n\n```tsx\nexport default async function BlogPage() {\n  const posts = await fetchPosts();\n  return <PostList posts={posts} />;\n}\n```\n\n## Caching Gotchas\n\n```tsx\n// This caches at build time — stale data!\nconst res = await fetch("/api/posts");\n\n// This always fetches fresh data\nconst res = await fetch("/api/posts", { cache: "no-store" });\n```\n\nIn Docker, build-time caching means your data is frozen. Use `cache: "no-store"` for dynamic content.\n\n## Docker Deployment\n\nUse `output: "standalone"` in next.config for Docker:\n\n```dockerfile\nFROM node:20-alpine AS runner\nCOPY --from=builder /app/.next/standalone ./\nCMD ["node", "server.js"]\n```\n\n## Key Takeaways\n\n1. Server components are the default — embrace it\n2. Docker builds freeze data — use no-store caching\n3. Keep client boundaries minimal\n4. Standalone output mode is essential for Docker',
   'PUBLISHED', NOW() - INTERVAL '10 days', 7,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW()),

  ('post-4', 'Prompt Engineering Patterns That Actually Work',
   'prompt-engineering-patterns',
   'Battle-tested prompt patterns for getting consistent, high-quality output from LLMs — from few-shot to chain-of-thought.',
   E'# Prompt Engineering Patterns That Actually Work\n\nAfter thousands of hours working with LLMs, these are the patterns I rely on daily.\n\n## 1. The Role Pattern\n\n```\nYou are a senior backend engineer specializing in Node.js performance.\nReview this code for bottlenecks and suggest optimizations.\n```\n\n## 2. Few-Shot Examples\n\n```\nConvert these descriptions to API endpoints:\nInput: "Users can create accounts" → POST /api/users\nInput: "Get a user by ID" → GET /api/users/:id\nInput: "Users can update profile" → ?\n```\n\n## 3. Chain of Thought\n\n```\nThink through this step by step:\n1. First identify the data sources\n2. Then determine the transformation logic\n3. Finally write the code\n```\n\n## 4. Structured Output\n\n```\nReturn JSON: { summary: string, confidence: 0-1, tags: string[] }\n```\n\n## 5. The Critic Pattern\n\n```\nGenerate the solution. Then critique for edge cases, performance, security. Then improve.\n```\n\n## Key Takeaways\n\n1. Always specify the output format\n2. Examples beat explanations\n3. Ask for reasoning, not just answers\n4. Self-critique dramatically improves quality',
   'PUBLISHED', NOW() - INTERVAL '8 days', 5,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-ai', NOW()),

  ('post-5', 'Docker Compose for Full-Stack Development',
   'docker-compose-full-stack',
   'How to set up Docker Compose for a full-stack app with hot reload, PostgreSQL, and production-ready configuration.',
   E'# Docker Compose for Full-Stack Development\n\nDocker Compose is not just for production — it is the best local development environment too.\n\n## The Stack\n\n```yaml\nservices:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_USER: app\n      POSTGRES_PASSWORD: secret\n      POSTGRES_DB: app\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n  backend:\n    build: ./backend\n    depends_on: [db]\n  frontend:\n    build: ./frontend\n    depends_on: [backend]\n```\n\n## Hot Reload in Docker\n\nMount source code as a volume:\n\n```yaml\nbackend:\n  volumes:\n    - ./backend/src:/app/src\n  command: npm run dev\n```\n\n## Production vs Development\n\nUse override files:\n\n```bash\ndocker compose -f docker-compose.yml -f docker-compose.dev.yml up  # dev\ndocker compose up -d --build  # production\n```\n\n## Key Takeaways\n\n1. Use named volumes for database persistence\n2. Internal URLs differ from external ones in Docker\n3. Override files keep configs clean\n4. Always pin your image versions',
   'PUBLISHED', NOW() - INTERVAL '6 days', 6,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-devops', NOW()),

  ('post-6', 'Building a RAG System from Scratch',
   'building-rag-system',
   'Step-by-step guide to building a Retrieval-Augmented Generation system — embeddings, vector stores, and query pipelines.',
   E'# Building a RAG System from Scratch\n\nRAG lets you ground LLM responses in your own data. Here is how to build one.\n\n## The Architecture\n\n1. **Ingest** documents → 2. **Chunk** into pieces → 3. **Embed** as vectors → 4. **Store** in vector DB → 5. **Retrieve** relevant chunks → 6. **Generate** answer\n\n## Setting Up Embeddings\n\n```typescript\nimport { OpenAIEmbeddings } from "@langchain/openai";\nconst embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });\n```\n\n## Chunking Strategy\n\n```typescript\nimport { RecursiveCharacterTextSplitter } from "langchain/text_splitter";\nconst splitter = new RecursiveCharacterTextSplitter({\n  chunkSize: 1000, chunkOverlap: 200,\n});\n```\n\n## Query Pipeline\n\n```typescript\nconst retriever = store.asRetriever(4);\nconst relevantDocs = await retriever.invoke("How does auth work?");\nconst response = await llm.invoke([\n  { role: "system", content: "Answer based on: " + JSON.stringify(relevantDocs) },\n  { role: "user", content: "How does auth work?" },\n]);\n```\n\n## Key Takeaways\n\n1. Chunk size matters — too small loses context, too big adds noise\n2. Embedding model choice affects quality significantly\n3. Always test with real queries\n4. Metadata filtering improves relevance',
   'PUBLISHED', NOW() - INTERVAL '5 days', 9,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-ai', NOW()),

  ('post-7', 'TypeScript Type Gymnastics: Advanced Patterns',
   'typescript-advanced-patterns',
   'Deep dive into advanced TypeScript — conditional types, template literals, and building type-safe APIs.',
   E'# TypeScript Type Gymnastics\n\nTypeScript type system is incredibly powerful. Here are patterns I use in production.\n\n## Conditional Types\n\n```typescript\ntype ApiResponse<T> = T extends Array<infer U>\n  ? { data: U[]; total: number }\n  : { data: T };\n```\n\n## Template Literal Types\n\n```typescript\ntype HttpMethod = "GET" | "POST" | "PUT" | "DELETE";\ntype ApiRoute = `/api/${string}`;\ntype Endpoint = `${HttpMethod} ${ApiRoute}`;\n```\n\n## Branded Types\n\n```typescript\ntype Brand<T, B> = T & { readonly __brand: B };\ntype Email = Brand<string, "Email">;\ntype UserId = Brand<string, "UserId">;\n```\n\n## Key Takeaways\n\n1. Conditional types replace function overloads\n2. Branded types prevent mixing up string types\n3. Template literals make type-safe routing possible\n4. The type system can encode business rules',
   'PUBLISHED', NOW() - INTERVAL '4 days', 7,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW()),

  ('post-8', 'My Development Workflow in 2026',
   'development-workflow-2026',
   'The tools, scripts, and habits that make me productive — from terminal setup to AI-assisted coding.',
   E'# My Development Workflow in 2026\n\nMy setup has evolved significantly. Here is what I use daily.\n\n## Terminal & Shell\n\nI use Windows Terminal with WSL2. Must-have tools: Starship prompt, zoxide, fzf, bat, eza.\n\n## Editor Setup\n\nVS Code with Error Lens, GitLens, Tailwind IntelliSense, Prisma extension.\n\n## AI-Assisted Coding\n\nI use AI for: boilerplate generation, code review, documentation, and debugging.\n\n## Git Workflow\n\n```bash\ngit checkout -b feat/settings-api\n# make changes\ngit add -p\ngit commit\ngh pr create --fill\n```\n\n## Daily Habits\n\n- Morning: Check CI, review PRs\n- Coding: 25-min pomodoro sessions\n- End of day: Commit WIP, update notes\n\n## Key Takeaways\n\n1. Invest in your dotfiles\n2. AI assistants multiply velocity\n3. Small habits compound\n4. Automate anything you do twice',
   'PUBLISHED', NOW() - INTERVAL '3 days', 5,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-productivity', NOW()),

  ('post-9', 'PostgreSQL Performance Tips for Developers',
   'postgresql-performance-tips',
   'Practical PostgreSQL optimization — indexes, query analysis, and connection pooling for production apps.',
   E'# PostgreSQL Performance Tips\n\nPostgreSQL needs tuning for production. Here are the optimizations that matter most.\n\n## Index Strategy\n\n```sql\nCREATE INDEX CONCURRENTLY idx_posts_status_published\nON posts (status, published_at DESC)\nWHERE status = ''PUBLISHED'';\n```\n\n## Query Analysis\n\n```sql\nEXPLAIN (ANALYZE, BUFFERS)\nSELECT * FROM posts WHERE status = ''PUBLISHED''\nORDER BY published_at DESC LIMIT 10;\n```\n\n## Connection Pooling\n\n```typescript\nimport { Pool } from "pg";\nconst pool = new Pool({\n  max: 20,\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 2000,\n});\n```\n\n## Key Takeaways\n\n1. Use partial indexes for filtered queries\n2. Always EXPLAIN ANALYZE before optimizing\n3. Connection pooling is non-negotiable\n4. Monitor pg_stat_statements regularly',
   'PUBLISHED', NOW() - INTERVAL '2 days', 6,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW()),

  ('post-10', 'Automating Social Media with AI Agents',
   'automating-social-media-ai',
   'How I built an AI agent that generates and schedules social media content from blog posts.',
   E'# Automating Social Media with AI Agents\n\nConsistency on social media is hard. I built an AI agent to handle it.\n\n## The Pipeline\n\n1. **Trigger** — New blog post published\n2. **Extract** — Pull key points and quotes\n3. **Generate** — Create platform-specific content\n4. **Schedule** — Post at optimal times\n\n## Content Generation\n\n```typescript\nasync function generateSocialContent(post: BlogPost) {\n  const tweets = await llm.invoke({\n    role: "system",\n    content: `Generate 3 tweets from: ${post.title} - ${post.excerpt}`\n  });\n  return parseTweets(tweets);\n}\n```\n\n## Results After 3 Months\n\n- 4x more consistent posting\n- 2x engagement rate\n- 2 hours/week saved\n\n## Key Takeaways\n\n1. Start with content extraction, not generation\n2. Platform-specific formatting matters\n3. Always review before auto-posting\n4. Schedule when your audience is active',
   'PUBLISHED', NOW() - INTERVAL '1 day', 5,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-ai', NOW()),

  ('post-11', 'Tailwind CSS v4: What Changed and What I Love',
   'tailwind-css-v4-changes',
   'A look at Tailwind CSS v4 — the new engine, CSS-first config, OKLCH colors, and breaking changes.',
   E'# Tailwind CSS v4: What Changed\n\nTailwind v4 is a ground-up rewrite. Here is what is different.\n\n## CSS-First Configuration\n\nNo more tailwind.config.js:\n\n```css\n@import "tailwindcss";\n@theme inline {\n  --color-primary: oklch(65% 0.25 25);\n}\n```\n\n## OKLCH Colors\n\n```css\n--color-accent: oklch(55% 0.2 25);\n--color-accent-light: oklch(75% 0.15 25);\n```\n\n## New Engine\n\nBuilt on Rust via Lightning CSS — 10x faster builds.\n\n## Key Takeaways\n\n1. CSS-first config is cleaner than JS config\n2. OKLCH colors are superior for design systems\n3. Build speed improvement is noticeable\n4. Migration takes about a day',
   'PUBLISHED', NOW() - INTERVAL '18 hours', 6,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW()),

  ('post-12', 'Building a CLI Tool with Node.js',
   'building-cli-tool-nodejs',
   'A guide to building command-line tools with Node.js — argument parsing, interactive prompts, and npm distribution.',
   E'# Building a CLI Tool with Node.js\n\nCommand-line tools are underrated. Here is how to build one properly.\n\n## Project Setup\n\n```bash\nmkdir my-cli && cd my-cli\nnpm init -y\n```\n\nAdd the bin field to package.json:\n\n```json\n{ "bin": { "my-cli": "./dist/index.js" } }\n```\n\n## Argument Parsing\n\n```typescript\nimport { Command } from "commander";\nconst program = new Command();\nprogram\n  .name("my-cli")\n  .command("generate <type>")\n  .option("--name <name>", "Component name")\n  .action((type, options) => { console.log(type, options.name); });\n```\n\n## Interactive Prompts\n\n```typescript\nimport { select, input } from "@inquirer/prompts";\n```\n\nThis post is a work in progress.',
   'DRAFT', NULL, 5,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW()),

  ('post-13', 'Security Best Practices for Node.js APIs',
   'nodejs-api-security',
   'Essential security measures for production Node.js APIs — rate limiting, input validation, JWT best practices.',
   E'# Security Best Practices for Node.js APIs\n\nSecurity is not optional. Here are the practices I follow for every API.\n\n## Rate Limiting\n\n```typescript\nimport rateLimit from "express-rate-limit";\napp.use("/api/", rateLimit({ windowMs: 15*60*1000, max: 100 }));\n```\n\n## Input Validation\n\n```typescript\nimport { z } from "zodiac";\nconst schema = z.object({\n  title: z.string().min(1).max(200),\n  body: z.string().min(1),\n});\n```\n\n## JWT Best Practices\n\n- Short expiry (15 min access + refresh)\n- Store in httpOnly cookies\n- Rotate secrets periodically\n\nThis post is still being written.',
   'DRAFT', NULL, 4,
   'f186d27f-24ae-4183-8bdf-36113096af21', 'cat-webdev', NOW())
ON CONFLICT (slug) DO NOTHING;

-- ========== POST-TAG RELATIONSHIPS ==========
INSERT INTO "_PostToTag" ("A", "B") VALUES
  ('post-1', 'tag-llm'), ('post-1', 'tag-langchain'), ('post-1', 'tag-python'), ('post-1', 'tag-automation'),
  ('post-2', 'tag-linux'), ('post-2', 'tag-docker'), ('post-2', 'tag-vps'), ('post-2', 'tag-security'),
  ('post-3', 'tag-react'), ('post-3', 'tag-nextjs'), ('post-3', 'tag-typescript'), ('post-3', 'tag-docker'),
  ('post-4', 'tag-prompt-engineering'), ('post-4', 'tag-llm'), ('post-4', 'tag-openai'), ('post-4', 'tag-claude'),
  ('post-5', 'tag-docker'), ('post-5', 'tag-nodejs'), ('post-5', 'tag-postgresql'), ('post-5', 'tag-ci-cd'),
  ('post-6', 'tag-llm'), ('post-6', 'tag-rag'), ('post-6', 'tag-langchain'), ('post-6', 'tag-python'),
  ('post-7', 'tag-typescript'), ('post-7', 'tag-react'), ('post-7', 'tag-nodejs'),
  ('post-8', 'tag-automation'),
  ('post-9', 'tag-postgresql'), ('post-9', 'tag-nodejs'), ('post-9', 'tag-express'),
  ('post-10', 'tag-llm'), ('post-10', 'tag-automation'), ('post-10', 'tag-openai'),
  ('post-11', 'tag-tailwind'), ('post-11', 'tag-react'), ('post-11', 'tag-nextjs'),
  ('post-12', 'tag-nodejs'), ('post-12', 'tag-typescript'),
  ('post-13', 'tag-nodejs'), ('post-13', 'tag-security'), ('post-13', 'tag-express')
ON CONFLICT DO NOTHING;

-- ========== PROJECTS ==========
INSERT INTO projects (id, title, description, "techStack", "liveUrl", "githubUrl", featured, "order", "updatedAt") VALUES
  ('proj-1', 'MyPLWeb Portfolio',
   'Personal portfolio and blog platform built with Next.js and Express. Features a full admin CMS, real-time content management, and responsive design.',
   ARRAY['Next.js', 'TypeScript', 'Express', 'PostgreSQL', 'Docker', 'Tailwind CSS'],
   NULL, NULL, true, 0, NOW()),

  ('proj-2', 'AI Research Agent',
   'An autonomous research agent that searches the web, synthesizes findings, and generates structured reports. Built with LangChain and OpenAI.',
   ARRAY['Python', 'LangChain', 'OpenAI', 'FastAPI', 'ChromaDB'],
   NULL, NULL, true, 1, NOW()),

  ('proj-3', 'Markdown Blog Engine',
   'A lightweight blog engine with SSR, syntax highlighting, RSS feed generation, and full-text search. Optimized for performance and SEO.',
   ARRAY['Node.js', 'Markdown', 'SQLite', 'HTMX'],
   NULL, NULL, true, 2, NOW()),

  ('proj-4', 'Task Automation CLI',
   'A command-line tool for automating repetitive development tasks — project scaffolding, deployment scripts, and git workflow management.',
   ARRAY['Node.js', 'TypeScript', 'Commander.js', 'Inquirer'],
   NULL, NULL, false, 3, NOW()),

  ('proj-5', 'RAG Chat Interface',
   'A retrieval-augmented generation chatbot that answers questions from your own documents. Supports PDF, Markdown, and plain text with semantic search.',
   ARRAY['Next.js', 'LangChain', 'OpenAI', 'PGVector', 'Tailwind CSS'],
   NULL, NULL, true, 4, NOW()),

  ('proj-6', 'API Monitoring Dashboard',
   'Real-time API health monitoring with uptime tracking, response time graphs, and alert notifications via email and Slack.',
   ARRAY['React', 'Node.js', 'PostgreSQL', 'Redis', 'Chart.js'],
   NULL, NULL, false, 5, NOW()),

  ('proj-7', 'E-commerce Starter Kit',
   'A production-ready e-commerce template with product management, cart, Stripe payments, and order tracking.',
   ARRAY['Next.js', 'TypeScript', 'Stripe', 'Prisma', 'Tailwind CSS'],
   NULL, NULL, false, 6, NOW()),

  ('proj-8', 'AI Content Generator',
   'Batch content generation tool powered by LLMs. Generates blog posts, social media updates, and newsletters from brief descriptions.',
   ARRAY['Python', 'OpenAI', 'Celery', 'Redis', 'PostgreSQL'],
   NULL, NULL, false, 7, NOW())
ON CONFLICT DO NOTHING;

-- ========== EXPERIENCE (extra entries) ==========
INSERT INTO experiences (id, role, period, description, "order", "updatedAt") VALUES
  ('exp-3', 'Freelance Developer', '2020 — 2022',
   'Delivered web applications for startups and small businesses. Specialized in React frontends and Node.js APIs with a focus on performance.',
   2, NOW()),
  ('exp-4', 'Computer Science Student', '2017 — 2020',
   'Studied computer science with a focus on software engineering and AI. Built multiple projects including a campus event platform.',
   3, NOW())
ON CONFLICT DO NOTHING;
