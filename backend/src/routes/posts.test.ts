import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createPostsRouter } from "./posts";
import { createTestApp } from "../test/test-app";

const originalJwtSecret = process.env.JWT_SECRET;

type PostRecord = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
  status: "PUBLISHED" | "DRAFT";
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingTime: number;
  metaDescription: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
};

const publishedPost: PostRecord = {
  id: "published-1",
  title: "Published Post",
  slug: "published-post",
  excerpt: "published",
  featuredImage: null,
  status: "PUBLISHED",
  publishedAt: "2026-05-01T00:00:00.000Z",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  readingTime: 4,
  metaDescription: null,
  category: null,
  tags: [],
};

const draftPost: PostRecord = {
  ...publishedPost,
  id: "draft-1",
  title: "Draft Post",
  slug: "draft-post",
  status: "DRAFT",
  publishedAt: null,
};

beforeEach(() => {
  process.env.JWT_SECRET = "phase5-test-secret";
});

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

function createPrismaClient() {
  const dataset = [publishedPost, draftPost];
  const calls: Array<Record<string, unknown>> = [];

  return {
    calls,
    client: {
      post: {
        findMany: async ({ where }: { where?: Record<string, unknown> }) => {
          calls.push({ where });
          if (where?.status === "PUBLISHED") {
            return dataset.filter((post) => post.status === "PUBLISHED" && post.publishedAt);
          }
          return dataset;
        },
        count: async ({ where }: { where?: Record<string, unknown> }) => {
          if (where?.status === "PUBLISHED") {
            return dataset.filter((post) => post.status === "PUBLISHED" && post.publishedAt).length;
          }
          return dataset.length;
        },
        findUnique: async () => null,
        create: async () => draftPost,
        update: async () => draftPost,
        delete: async () => draftPost,
      },
    },
  };
}

test("GET /api/posts?status=all returns 401 without a token", async () => {
  const { client } = createPrismaClient();
  const app = createTestApp("/api/posts", createPostsRouter({ prismaClient: client }));

  const response = await request(app).get("/api/posts?status=all");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Authentication required");
});

test("GET /api/posts?status=all returns 401 with an invalid token", async () => {
  const { client } = createPrismaClient();
  const app = createTestApp("/api/posts", createPostsRouter({ prismaClient: client }));

  const response = await request(app)
    .get("/api/posts?status=all")
    .set("Authorization", "Bearer definitely-invalid");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Invalid token");
});

test("GET /api/posts returns published posts only for public requests", async () => {
  const { client, calls } = createPrismaClient();
  const app = createTestApp("/api/posts", createPostsRouter({ prismaClient: client }));

  const response = await request(app).get("/api/posts");

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].slug, "published-post");
  assert.ok(!response.body.data.some((post: { slug: string }) => post.slug === "draft-post"));
  assert.deepEqual(calls[0]?.where, { status: "PUBLISHED", publishedAt: { not: null } });
});

test("GET /api/posts?status=all returns draft posts for valid authenticated requests", async () => {
  const { client } = createPrismaClient();
  const app = createTestApp("/api/posts", createPostsRouter({ prismaClient: client }));
  const token = jwt.sign({ userId: "user-1" }, process.env.JWT_SECRET!, { expiresIn: "1h" });

  const response = await request(app)
    .get("/api/posts?status=all")
    .set("Authorization", `Bearer ${token}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 2);
  assert.ok(response.body.data.some((post: { slug: string }) => post.slug === "draft-post"));
});
