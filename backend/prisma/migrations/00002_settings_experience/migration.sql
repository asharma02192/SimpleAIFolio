-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

-- Seed default settings
INSERT INTO "site_settings" ("id", "key", "value", "updatedAt") VALUES
  (gen_random_uuid(), 'site_title', 'Amit', NOW()),
  (gen_random_uuid(), 'tagline', 'Developer. Writer. Building with AI.', NOW()),
  (gen_random_uuid(), 'description', 'Personal portfolio — exploring AI tools, techniques, and building intelligent agents.', NOW()),
  (gen_random_uuid(), 'author_name', 'Amit', NOW()),
  (gen_random_uuid(), 'bio_hero', 'Writing about AI tools, building intelligent agents, and sharing techniques that make development faster and smarter.', NOW()),
  (gen_random_uuid(), 'bio_about_1', 'I''m a developer who loves building things at the intersection of software engineering and artificial intelligence. This site is where I share what I learn along the way — techniques, tools, and ideas that make development smarter.', NOW()),
  (gen_random_uuid(), 'bio_about_2', 'My focus areas include full-stack web development, AI agent architectures, and practical applications of large language models. I believe in learning by building, and I write about the things I wish I''d known when I started.', NOW()),
  (gen_random_uuid(), 'bio_about_3', 'When I''m not coding, you''ll find me exploring new AI tools, reading technical papers, or experimenting with the latest frameworks. I''m always happy to connect with fellow developers.', NOW()),
  (gen_random_uuid(), 'social_links', '{"github":"https://github.com","linkedin":"https://linkedin.com","twitter":"https://twitter.com","email":"hello@example.com"}', NOW()),
  (gen_random_uuid(), 'hero_stats', '[{"value":"Full-Stack","label":"Development"},{"value":"AI & ML","label":"Specialization"},{"value":"Open Source","label":"Contributor"}]', NOW()),
  (gen_random_uuid(), 'skill_groups', '[{"category":"Frontend","skills":[{"name":"React / Next.js","level":"expert"},{"name":"TypeScript","level":"expert"},{"name":"Tailwind CSS","level":"expert"},{"name":"HTML / CSS","level":"expert"}]},{"category":"Backend","skills":[{"name":"Node.js / Express","level":"expert"},{"name":"Python","level":"proficient"},{"name":"PostgreSQL","level":"proficient"},{"name":"REST APIs","level":"expert"}]},{"category":"AI & Machine Learning","skills":[{"name":"LLM Integration","level":"expert"},{"name":"AI Agents / LangChain","level":"proficient"},{"name":"Prompt Engineering","level":"expert"},{"name":"RAG Systems","level":"proficient"}]},{"category":"DevOps & Tools","skills":[{"name":"Docker","level":"proficient"},{"name":"Linux / VPS","level":"expert"},{"name":"Git / GitHub","level":"expert"},{"name":"CI/CD","level":"proficient"}]}]', NOW());

-- Seed default experience
INSERT INTO "experiences" ("id", "role", "period", "description", "order", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'Full-Stack Developer & AI Engineer', '2024 — Present', 'Building AI-powered applications, agents, and tools. Specializing in LLM integration, prompt engineering, and production AI systems.', 0, NOW(), NOW()),
  (gen_random_uuid(), 'Frontend Developer', '2022 — 2024', 'Developed responsive web applications with React and Next.js. Focused on performance, accessibility, and user experience.', 1, NOW(), NOW());
