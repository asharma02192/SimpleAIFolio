CREATE TABLE "ai_research_runs" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "topicSummary" TEXT,
  "searchIntent" TEXT,
  "keywordIdeasJson" TEXT,
  "relatedQuestionsJson" TEXT,
  "competitorNotesJson" TEXT,
  "contentGapsJson" TEXT,
  "sourceNotesJson" TEXT,
  "internalLinkOpportunitiesJson" TEXT,
  "riskFlagsJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conversationId" TEXT NOT NULL,

  CONSTRAINT "ai_research_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_research_runs_conversationId_key" ON "ai_research_runs"("conversationId");

ALTER TABLE "ai_draft_outputs"
  ADD COLUMN "verificationNotesJson" TEXT,
  ADD COLUMN "engagementInsightsJson" TEXT,
  ADD COLUMN "researchUsed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ai_research_runs"
  ADD CONSTRAINT "ai_research_runs_conversationId_fkey"
  FOREIGN KEY ("conversationId")
  REFERENCES "ai_conversations"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
