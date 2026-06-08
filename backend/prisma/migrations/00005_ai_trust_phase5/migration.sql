ALTER TABLE "ai_draft_outputs"
ADD COLUMN "verificationFlagsJson" TEXT,
ADD COLUMN "internalLinkSuggestionsJson" TEXT;

CREATE TABLE "ai_rewrite_proposals" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "summary" TEXT,
  "targetSection" TEXT NOT NULL,
  "originalText" TEXT NOT NULL,
  "proposedText" TEXT NOT NULL,
  "draftPatchJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'proposed',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "conversationId" TEXT NOT NULL,
  "draftOutputId" TEXT NOT NULL,

  CONSTRAINT "ai_rewrite_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_rewrite_proposals_conversationId_status_idx"
ON "ai_rewrite_proposals"("conversationId", "status");

CREATE INDEX "ai_rewrite_proposals_draftOutputId_idx"
ON "ai_rewrite_proposals"("draftOutputId");

ALTER TABLE "ai_rewrite_proposals"
ADD CONSTRAINT "ai_rewrite_proposals_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_rewrite_proposals"
ADD CONSTRAINT "ai_rewrite_proposals_draftOutputId_fkey"
FOREIGN KEY ("draftOutputId") REFERENCES "ai_draft_outputs"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
