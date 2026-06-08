-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_content_briefs" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "audience" TEXT,
    "goal" TEXT,
    "tone" TEXT,
    "primaryKeyword" TEXT,
    "secondaryKeywordsJson" TEXT,
    "wordCount" INTEGER,
    "contentType" TEXT,
    "cta" TEXT,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT NOT NULL,

    CONSTRAINT "ai_content_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_draft_outputs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "contentHtml" TEXT NOT NULL,
    "categorySuggestion" TEXT,
    "tagsJson" TEXT,
    "outlineJson" TEXT,
    "faqJson" TEXT,
    "ogImagePrompt" TEXT,
    "seoScore" INTEGER,
    "engagementScore" INTEGER,
    "readabilityScore" INTEGER,
    "recommendationsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversationId" TEXT NOT NULL,
    "postId" TEXT,

    CONSTRAINT "ai_draft_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_userId_status_idx" ON "ai_conversations"("userId", "status");
CREATE INDEX "ai_conversations_updatedAt_idx" ON "ai_conversations"("updatedAt");
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");
CREATE UNIQUE INDEX "ai_content_briefs_conversationId_key" ON "ai_content_briefs"("conversationId");
CREATE UNIQUE INDEX "ai_draft_outputs_conversationId_key" ON "ai_draft_outputs"("conversationId");
CREATE INDEX "ai_draft_outputs_postId_idx" ON "ai_draft_outputs"("postId");

-- AddForeignKeys
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_content_briefs" ADD CONSTRAINT "ai_content_briefs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_draft_outputs" ADD CONSTRAINT "ai_draft_outputs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_draft_outputs" ADD CONSTRAINT "ai_draft_outputs_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
