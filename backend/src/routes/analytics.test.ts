import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { createAnalyticsRouter } from "./analytics";
import { createTestApp } from "../test/test-app";

const originalJwtSecret = process.env.JWT_SECRET;

function createToken(userId = "user-1") {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "1h" });
}

test.afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

test("analytics dashboard includes AI ops summary", async () => {
  process.env.JWT_SECRET = "analytics-test-secret";
  let storedAlertSettings: string | null = null;

  const prismaClient = {
    pageView: {
      count: async ({ where }: any = {}) => (where?.createdAt ? 42 : 0),
      groupBy: async () => [{ path: "/blog/test", _count: { path: 12 } }],
      create: async () => ({ id: "page-1" }),
    },
    post: {
      count: async ({ where }: any = {}) => (where?.status === "PUBLISHED" ? 7 : 10),
    },
    project: {
      count: async () => 3,
    },
    aiUsageEvent: {
      count: async ({ where }: any = {}) => (where?.success === false ? 2 : 9),
      aggregate: async ({ where }: any = {}) =>
        where?.createdAt?.lt
          ? {
              _sum: { estimatedCostUsd: 0.456789 },
              _avg: { latencyMs: null },
            }
          : {
              _sum: { totalTokens: 12345, estimatedCostUsd: 1.234567 },
              _avg: { latencyMs: 812.4 },
            },
      groupBy: async ({ by }: any) => {
        if (by.includes("provider")) {
          if (by.includes("model")) {
            return [
              {
                provider: "openai-compatible",
                model: "gpt-5.4",
                _count: { model: 6 },
                _sum: { estimatedCostUsd: 1.02 },
              },
              {
                provider: "exa",
                model: "exa-search",
                _count: { model: 2 },
                _sum: { estimatedCostUsd: 0.134567 },
              },
            ];
          }
          return [
            { provider: "openai-compatible", _count: { provider: 7 }, _sum: { estimatedCostUsd: 1.1 } },
            { provider: "exa", _count: { provider: 2 }, _sum: { estimatedCostUsd: 0.134567 } },
          ];
        }
        return [
          { operation: "draft_generate", _count: { operation: 4 } },
          { operation: "research_synthesis", _count: { operation: 3 } },
        ];
      },
      findMany: async ({ where }: any = {}) =>
        where?.success === false
          ? [
              {
                id: "usage-1",
                operation: "research_synthesis",
                provider: "exa",
                errorMessage: "Research provider timeout",
                createdAt: new Date("2026-06-08T10:00:00.000Z"),
                conversation: { id: "conversation-1", title: "AI ops post", topic: "AI ops post" },
              },
            ]
          : [
              {
                provider: "openai-compatible",
                model: "gpt-5.4",
                operation: "draft_generate",
                success: true,
                latencyMs: 640,
                totalTokens: 5000,
                estimatedCostUsd: 0.65,
                createdAt: new Date("2026-06-08T10:00:00.000Z"),
              },
              {
                provider: "openai-compatible",
                model: "gpt-5.4",
                operation: "conversation_start",
                success: true,
                latencyMs: 710,
                totalTokens: 3200,
                estimatedCostUsd: 0.32,
                createdAt: new Date("2026-06-08T12:00:00.000Z"),
              },
              {
                provider: "exa",
                model: "exa-search",
                operation: "research_synthesis",
                success: false,
                latencyMs: 1100,
                totalTokens: 4145,
                estimatedCostUsd: 0.264567,
                createdAt: new Date("2026-06-09T09:00:00.000Z"),
              },
            ],
    },
    aiConversation: {
      count: async ({ where }: any = {}) => (where?.archivedAt ? 2 : 8),
    },
    siteSetting: {
      findUnique: async ({ where }: any = {}) =>
        where?.key === "internal_ops_alert_settings" && storedAlertSettings
          ? { key: "internal_ops_alert_settings", value: storedAlertSettings }
          : null,
      upsert: async ({ where, create, update }: any) => {
        storedAlertSettings = update?.value ?? create.value;
        return { key: where.key, value: storedAlertSettings };
      },
    },
  };

  const app = createTestApp("/api/analytics", createAnalyticsRouter({ prismaClient: prismaClient as any }));
  const response = await request(app)
    .get("/api/analytics/dashboard?windowDays=90")
    .set("Authorization", `Bearer ${createToken()}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.totalPosts, 10);
  assert.equal(response.body.publishedPosts, 7);
  assert.equal(response.body.aiOps.totalCalls, 9);
  assert.equal(response.body.aiOps.windowDays, 90);
  assert.equal(response.body.aiOps.failures, 2);
  assert.equal(response.body.aiOps.totalTokens, 12345);
  assert.equal(response.body.aiOps.avgLatencyMs, 812);
  assert.equal(response.body.aiOps.previousPeriodCostUsd, 0.456789);
  assert.equal(response.body.aiOps.topProviders[0].provider, "openai-compatible");
  assert.equal(response.body.aiOps.topModels[0].model, "gpt-5.4");
  assert.equal(response.body.aiOps.topOperations[0].operation, "draft_generate");
  assert.equal(response.body.aiOps.recentFailures[0].conversationLabel, "AI ops post");
  assert.equal(response.body.aiOps.dailyUsage.length, 2);
  assert.equal(response.body.aiOps.providerBreakdown[0].provider, "openai-compatible");
  assert.equal(response.body.aiOps.modelBreakdown[0].model, "gpt-5.4");
  assert.equal(response.body.aiOps.alerts.length > 0, true);
});

test("analytics alert settings default to disabled and can be updated", async () => {
  process.env.JWT_SECRET = "analytics-test-secret";
  let storedAlertSettings: string | null = null;

  const prismaClient = {
    pageView: { count: async () => 0, groupBy: async () => [], create: async () => ({ id: "page-1" }) },
    post: { count: async () => 0 },
    project: { count: async () => 0 },
    aiUsageEvent: {
      count: async () => 0,
      aggregate: async () => ({ _sum: { estimatedCostUsd: 0, totalTokens: 0 }, _avg: { latencyMs: 0 } }),
      groupBy: async () => [],
      findMany: async () => [],
    },
    aiConversation: { count: async () => 0 },
    siteSetting: {
      findUnique: async ({ where }: any = {}) =>
        where?.key === "internal_ops_alert_settings" && storedAlertSettings
          ? { key: "internal_ops_alert_settings", value: storedAlertSettings }
          : null,
      upsert: async ({ where, create, update }: any) => {
        storedAlertSettings = update?.value ?? create.value;
        return { key: where.key, value: storedAlertSettings };
      },
    },
  };

  const app = createTestApp("/api/analytics", createAnalyticsRouter({ prismaClient: prismaClient as any }));
  const authHeader = { Authorization: `Bearer ${createToken()}` };

  const initialResponse = await request(app).get("/api/analytics/alert-settings").set(authHeader);
  assert.equal(initialResponse.status, 200);
  assert.equal(initialResponse.body.webhookEnabled, false);
  assert.equal(initialResponse.body.telegramEnabled, false);
  assert.equal(initialResponse.body.minLevel, "warning");
  assert.equal(initialResponse.body.cooldownMs, 300000);
  assert.equal(initialResponse.body.dailyDigestEnabled, false);

  const updateResponse = await request(app)
    .put("/api/analytics/alert-settings")
    .set(authHeader)
    .send({ webhookEnabled: true, telegramEnabled: true, minLevel: "critical", cooldownMs: 600000, dailyDigestEnabled: true });

  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.webhookEnabled, true);
  assert.equal(updateResponse.body.telegramEnabled, true);
  assert.equal(updateResponse.body.minLevel, "critical");
  assert.equal(updateResponse.body.cooldownMs, 600000);
  assert.equal(updateResponse.body.dailyDigestEnabled, true);
  assert.match(storedAlertSettings || "", /"webhookEnabled":true/);
  assert.match(storedAlertSettings || "", /"telegramEnabled":true/);
  assert.match(storedAlertSettings || "", /"minLevel":"critical"/);
  assert.match(storedAlertSettings || "", /"cooldownMs":600000/);
  assert.match(storedAlertSettings || "", /"dailyDigestEnabled":true/);
});
