ALTER TABLE "posts" ADD COLUMN "scheduledAt" TIMESTAMP(3);
CREATE INDEX "posts_status_scheduledAt_idx" ON "posts"("status", "scheduledAt");

CREATE TABLE "post_reactions" (
    "id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "post_reactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_reactions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "post_reactions_postId_fingerprint_emoji_key" ON "post_reactions"("postId", "fingerprint", "emoji");
CREATE INDEX "post_reactions_postId_idx" ON "post_reactions"("postId");

CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE INDEX "newsletter_subscribers_active_createdAt_idx" ON "newsletter_subscribers"("active", "createdAt");
