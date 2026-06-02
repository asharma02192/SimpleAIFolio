import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { createAuthRouter } from "./auth";
import { createTestApp } from "../test/test-app";

const originalInstallSecret = process.env.INSTALL_SECRET;
const originalJwtSecret = process.env.JWT_SECRET;

function getCookieHeader(response: SupertestResponse) {
  const header = response.headers["set-cookie"];
  return Array.isArray(header) ? header.join(";") : header || "";
}

beforeEach(() => {
  process.env.JWT_SECRET = "phase5-test-secret";
  delete process.env.INSTALL_SECRET;
});

afterEach(() => {
  if (originalInstallSecret === undefined) {
    delete process.env.INSTALL_SECRET;
  } else {
    process.env.INSTALL_SECRET = originalInstallSecret;
  }

  if (originalJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalJwtSecret;
  }
});

test("POST /api/auth/setup returns 503 when INSTALL_SECRET is missing", async () => {
  const prismaClient = {
    user: {
      count: async () => 0,
      create: async () => ({ id: "new-user", email: "admin@example.com", name: "Admin" }),
      findUnique: async () => null,
    },
  };

  const app = createTestApp("/api/auth", createAuthRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/auth/setup")
    .send({ email: "admin@example.com", password: "password", name: "Admin" });

  assert.equal(response.status, 503);
  assert.equal(response.body.error, "Initial setup is disabled");
});

test("POST /api/auth/setup returns 403 when an invalid install secret is provided", async () => {
  process.env.INSTALL_SECRET = "phase5-secret";
  const prismaClient = {
    user: {
      count: async () => 0,
      create: async () => ({ id: "new-user", email: "admin@example.com", name: "Admin" }),
      findUnique: async () => null,
    },
  };

  const app = createTestApp("/api/auth", createAuthRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/auth/setup")
    .set("x-install-secret", "wrong-secret")
    .send({ email: "admin@example.com", password: "password", name: "Admin" });

  assert.equal(response.status, 403);
  assert.equal(response.body.error, "Invalid install secret");
});

test("POST /api/auth/login succeeds with valid credentials and sets an auth cookie", async () => {
  const passwordHash = await bcrypt.hash("correct-horse-battery-staple", 10);
  const prismaClient = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        where.email === "admin@example.com"
          ? {
              id: "user-1",
              email: "admin@example.com",
              name: "Admin",
              password: passwordHash,
            }
          : null,
      count: async () => 1,
      create: async () => {
        throw new Error("not used");
      },
    },
  };

  const app = createTestApp("/api/auth", createAuthRouter({ prismaClient }));
  const response = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin@example.com", password: "correct-horse-battery-staple" });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, "admin@example.com");
  assert.match(response.body.token, /\S+/);
  assert.match(getCookieHeader(response), /admin_token=/);
});

test("GET /api/auth/me returns 401 without a session token", async () => {
  const prismaClient = {
    user: {
      findUnique: async () => null,
      count: async () => 0,
      create: async () => ({ id: "new-user", email: "admin@example.com", name: "Admin" }),
    },
  };

  const app = createTestApp("/api/auth", createAuthRouter({ prismaClient }));
  const response = await request(app).get("/api/auth/me");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "No token provided");
});

test("POST /api/auth/logout clears the auth cookie", async () => {
  const prismaClient = {
    user: {
      findUnique: async () => null,
      count: async () => 0,
      create: async () => ({ id: "new-user", email: "admin@example.com", name: "Admin" }),
    },
  };

  const app = createTestApp("/api/auth", createAuthRouter({ prismaClient }));
  const response = await request(app).post("/api/auth/logout");

  assert.equal(response.status, 204);
  assert.match(getCookieHeader(response), /admin_token=;/);
});
