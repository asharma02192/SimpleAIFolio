ALTER TABLE posts ADD COLUMN IF NOT EXISTS "previewToken" TEXT;

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT contact_messages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS contact_messages_read_createdAt_idx ON contact_messages(read, "createdAt");

CREATE TABLE IF NOT EXISTS comments (
  id TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comments_pkey PRIMARY KEY (id),
  CONSTRAINT comments_postId_fkey FOREIGN KEY ("postId") REFERENCES posts(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT comments_parentId_fkey FOREIGN KEY ("parentId") REFERENCES comments(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS comments_postId_createdAt_idx ON comments("postId", "createdAt");
