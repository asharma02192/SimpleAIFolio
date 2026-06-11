ALTER TABLE "ai_conversations"
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "ai_conversations_userId_archivedAt_updatedAt_idx"
ON "ai_conversations"("userId", "archivedAt", "updatedAt");

ALTER TABLE "ai_draft_outputs"
ADD COLUMN "referencesEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ai_usage_events" (
  "id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "latencyMs" INTEGER,
  "promptTokens" INTEGER,
  "completionTokens" INTEGER,
  "totalTokens" INTEGER,
  "estimatedCostUsd" DOUBLE PRECISION,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "metadataJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conversationId" TEXT,

  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_events_conversationId_createdAt_idx"
ON "ai_usage_events"("conversationId", "createdAt");

CREATE INDEX "ai_usage_events_provider_operation_createdAt_idx"
ON "ai_usage_events"("provider", "operation", "createdAt");

ALTER TABLE "ai_usage_events"
ADD CONSTRAINT "ai_usage_events_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
