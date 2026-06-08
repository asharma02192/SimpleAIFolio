import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createTestApp } from "../test/test-app";
import { createCategoriesRouter } from "./categories";
import { createTagsRouter } from "./tags";
import { createProjectsRouter } from "./projects";

const originalJwtSecret = process.env.JWT_SECRET;
const originalRateLimitStore = process.env.RATE_LIMIT_STORE;

function createToken(userId = "user-1") {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

beforeEach(() => {
  process.env.JWT_SECRET = "phase6a-test-secret";
  process.env.RATE_LIMIT_STORE = "memory";
});

afterEach(() => {
  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }

  if (originalRateLimitStore === undefined) {
    delete process.env.RATE_LIMIT_STORE;
  } else {
    process.env.RATE_LIMIT_STORE = originalRateLimitStore;
  }
});

test("duplicate category create returns 409", async () => {
  const prismaClient = {
    category: {
      create: async () => {
        const error = new Error("duplicate");
        (error as Error & { code?: string }).code = "P2002";
        throw error;
      },
      findMany: async () => [],
      update: async () => ({}),
      delete: async () => ({}),
    },
  };

  const app = createTestApp("/api/categories", createCategoriesRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/categories")
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ name: "AI", slug: "ai" });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "Category with this name or slug already exists");
});

test("missing category delete returns 404", async () => {
  const prismaClient = {
    category: {
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => {
        const error = new Error("missing");
        (error as Error & { code?: string }).code = "P2025";
        throw error;
      },
    },
  };

  const app = createTestApp("/api/categories", createCategoriesRouter({ prismaClient }));
  const response = await request(app)
    .delete("/api/categories/missing-category")
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Category not found");
});

test("duplicate tag create returns 409", async () => {
  const prismaClient = {
    tag: {
      create: async () => {
        const error = new Error("duplicate");
        (error as Error & { code?: string }).code = "P2002";
        throw error;
      },
      findMany: async () => [],
      update: async () => ({}),
      delete: async () => ({}),
    },
  };

  const app = createTestApp("/api/tags", createTagsRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/tags")
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ name: "seo", slug: "seo" });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "Tag with this name or slug already exists");
});

test("missing tag delete returns 404", async () => {
  const prismaClient = {
    tag: {
      findMany: async () => [],
      create: async () => ({}),
      update: async () => ({}),
      delete: async () => {
        const error = new Error("missing");
        (error as Error & { code?: string }).code = "P2025";
        throw error;
      },
    },
  };

  const app = createTestApp("/api/tags", createTagsRouter({ prismaClient }));
  const response = await request(app)
    .delete("/api/tags/missing-tag")
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Tag not found");
});

test("missing project update returns 404", async () => {
  const prismaClient = {
    project: {
      findMany: async () => [],
      create: async () => ({}),
      update: async () => {
        const error = new Error("missing");
        (error as Error & { code?: string }).code = "P2025";
        throw error;
      },
      delete: async () => ({}),
    },
  };

  const app = createTestApp("/api/projects", createProjectsRouter({ prismaClient }));
  const response = await request(app)
    .put("/api/projects/missing-project")
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ title: "Missing project" });

  assert.equal(response.status, 404);
  assert.equal(response.body.error, "Project not found");
});

test("project create validates required fields", async () => {
  const prismaClient = {
    project: {
      findMany: async () => [],
      create: async () => {
        throw new Error("should not run");
      },
      update: async () => ({}),
      delete: async () => ({}),
    },
  };

  const app = createTestApp("/api/projects", createProjectsRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/projects")
    .set("Authorization", `Bearer ${createToken()}`)
    .send({ title: "", description: "" });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "Title and description are required");
});
