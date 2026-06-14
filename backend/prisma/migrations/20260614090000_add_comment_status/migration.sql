-- AlterTable
ALTER TABLE "comments" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'approved';

-- CreateIndex
CREATE INDEX "comments_status_idx" ON "comments"("status");
