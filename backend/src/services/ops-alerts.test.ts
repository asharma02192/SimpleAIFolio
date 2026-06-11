import test from "node:test";
import assert from "node:assert/strict";
import { notifyAiOpsForUsageEvent, resetAiOpsAlertStateForTests } from "./ops-alerts";

const originalEnv = {
  webhookUrl: process.env.AI_ALERT_WEBHOOK_URL,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  minLevel: process.env.AI_ALERT_MIN_LEVEL,
  failureThreshold: process.env.AI_ALERT_FAILURE_THRESHOLD,
  highLatencyMs: process.env.AI_ALERT_HIGH_LATENCY_MS,
  latencyThreshold: process.env.AI_ALERT_LATENCY_THRESHOLD,
  lookbackMs: process.env.AI_ALERT_LOOKBACK_MS,
  costLookbackMs: process.env.AI_ALERT_COST_LOOKBACK_MS,
  costSpikeMinUsd: process.env.AI_ALERT_COST_SPIKE_MIN_USD,
  costSpikeMinDeltaUsd: process.env.AI_ALERT_COST_SPIKE_MIN_DELTA_USD,
  costSpikeMultiplier: process.env.AI_ALERT_COST_SPIKE_MULTIPLIER,
  cooldownMs: process.env.AI_ALERT_COOLDOWN_MS,
};

test.afterEach(() => {
  process.env.AI_ALERT_WEBHOOK_URL = originalEnv.webhookUrl;
  process.env.TELEGRAM_BOT_TOKEN = originalEnv.telegramBotToken;
  process.env.TELEGRAM_CHAT_ID = originalEnv.telegramChatId;
  process.env.AI_ALERT_MIN_LEVEL = originalEnv.minLevel;
  process.env.AI_ALERT_FAILURE_THRESHOLD = originalEnv.failureThreshold;
  process.env.AI_ALERT_HIGH_LATENCY_MS = originalEnv.highLatencyMs;
  process.env.AI_ALERT_LATENCY_THRESHOLD = originalEnv.latencyThreshold;
  process.env.AI_ALERT_LOOKBACK_MS = originalEnv.lookbackMs;
  process.env.AI_ALERT_COST_LOOKBACK_MS = originalEnv.costLookbackMs;
  process.env.AI_ALERT_COST_SPIKE_MIN_USD = originalEnv.costSpikeMinUsd;
  process.env.AI_ALERT_COST_SPIKE_MIN_DELTA_USD = originalEnv.costSpikeMinDeltaUsd;
  process.env.AI_ALERT_COST_SPIKE_MULTIPLIER = originalEnv.costSpikeMultiplier;
  process.env.AI_ALERT_COOLDOWN_MS = originalEnv.cooldownMs;
  resetAiOpsAlertStateForTests();
});

test("repeated provider failures trigger a webhook alert", async () => {
  process.env.AI_ALERT_WEBHOOK_URL = "https://alerts.example.test/hooks/ai";
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  process.env.AI_ALERT_FAILURE_THRESHOLD = "3";

  const fetchCalls: Array<{ url: string; body: unknown }> = [];
  const prismaClient = {
    aiUsageEvent: {
      count: async ({ where }: any) => (where?.success === false ? 3 : 0),
      aggregate: async () => ({ _sum: { estimatedCostUsd: 0 } }),
    },
    siteSetting: {
      findUnique: async () => ({
        key: "internal_ops_alert_settings",
        value: JSON.stringify({ webhookEnabled: true, telegramEnabled: false }),
      }),
    },
  };

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: prismaClient as any,
    event: {
      conversationId: "conversation-1",
      provider: "openai-compatible",
      model: "gpt-5.4",
      operation: "draft_generate",
      success: false,
      errorMessage: "Upstream 502",
      createdAt: "2026-06-09T10:00:00.000Z",
    },
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(alerts.length, 1);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://alerts.example.test/hooks/ai");
  assert.equal((fetchCalls[0].body as any).code, "ai_provider_failure_burst");
});

test("sustained latency and cost spikes are evaluated separately", async () => {
  process.env.AI_ALERT_WEBHOOK_URL = "https://alerts.example.test/hooks/ai";
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
  process.env.AI_ALERT_HIGH_LATENCY_MS = "1000";
  process.env.AI_ALERT_LATENCY_THRESHOLD = "2";
  process.env.AI_ALERT_COST_LOOKBACK_MS = "3600000";
  process.env.AI_ALERT_COST_SPIKE_MIN_USD = "1";
  process.env.AI_ALERT_COST_SPIKE_MIN_DELTA_USD = "0.5";
  process.env.AI_ALERT_COST_SPIKE_MULTIPLIER = "1.5";

  const fetchCalls: Array<{ code: string }> = [];
  const prismaClient = {
    aiUsageEvent: {
      count: async ({ where }: any) => (where?.latencyMs?.gte ? 2 : 0),
      aggregate: async ({ where }: any) =>
        where?.createdAt?.lt
          ? { _sum: { estimatedCostUsd: 0.5 } }
          : { _sum: { estimatedCostUsd: 2.25 } },
    },
    siteSetting: {
      findUnique: async () => ({
        key: "internal_ops_alert_settings",
        value: JSON.stringify({ webhookEnabled: true, telegramEnabled: false }),
      }),
    },
  };

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: prismaClient as any,
    event: {
      conversationId: "conversation-2",
      provider: "openai-compatible",
      model: "gpt-5.4",
      operation: "draft_generate",
      success: true,
      latencyMs: 1800,
      estimatedCostUsd: 0.9,
      createdAt: "2026-06-09T10:00:00.000Z",
    },
    fetchImpl: async (_url, init) => {
      const payload = init?.body ? JSON.parse(String(init.body)) : null;
      fetchCalls.push({ code: payload.code });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(alerts.length, 2);
  assert.deepEqual(
    fetchCalls.map((entry) => entry.code).sort(),
    ["ai_cost_spike", "ai_latency_sustained"]
  );
});

test("alert delivery is skipped cleanly when webhook config is absent", async () => {
  delete process.env.AI_ALERT_WEBHOOK_URL;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: {
      aiUsageEvent: {},
      siteSetting: {
        findUnique: async () => ({
          key: "internal_ops_alert_settings",
          value: JSON.stringify({ webhookEnabled: false, telegramEnabled: false }),
        }),
      },
    } as any,
    event: {
      provider: "openai-compatible",
      operation: "conversation_start",
      success: false,
    },
    fetchImpl: async () => {
      throw new Error("Should not be called");
    },
  });

  assert.equal(alerts.length, 0);
});

test("telegram delivery works when bot credentials are configured", async () => {
  delete process.env.AI_ALERT_WEBHOOK_URL;
  process.env.TELEGRAM_BOT_TOKEN = "telegram-bot-token";
  process.env.TELEGRAM_CHAT_ID = "123456789";
  process.env.AI_ALERT_FAILURE_THRESHOLD = "2";

  const fetchCalls: Array<{ url: string; body: unknown }> = [];
  const prismaClient = {
    aiUsageEvent: {
      count: async ({ where }: any) => (where?.success === false ? 2 : 0),
      aggregate: async () => ({ _sum: { estimatedCostUsd: 0 } }),
    },
    siteSetting: {
      findUnique: async () => ({
        key: "internal_ops_alert_settings",
        value: JSON.stringify({ webhookEnabled: false, telegramEnabled: true }),
      }),
    },
  };

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: prismaClient as any,
    event: {
      conversationId: "conversation-telegram",
      provider: "openai-compatible",
      model: "gpt-5.4",
      operation: "conversation_reply",
      success: false,
      errorMessage: "Provider timeout",
      createdAt: "2026-06-09T11:00:00.000Z",
    },
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(alerts.length, 1);
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://api.telegram.org/bottelegram-bot-token/sendMessage");
  assert.equal((fetchCalls[0].body as any).chat_id, "123456789");
  assert.equal(String((fetchCalls[0].body as any).text).includes("MyPLWeb AI Ops Alert"), true);
});

test("stored minimum severity can suppress lower-level alert delivery", async () => {
  process.env.AI_ALERT_WEBHOOK_URL = "https://alerts.example.test/hooks/ai";
  process.env.AI_ALERT_FAILURE_THRESHOLD = "2";

  const fetchCalls: Array<{ url: string }> = [];
  const prismaClient = {
    aiUsageEvent: {
      count: async ({ where }: any) => (where?.success === false ? 2 : 0),
      aggregate: async () => ({ _sum: { estimatedCostUsd: 0 } }),
    },
    siteSetting: {
      findUnique: async () => ({
        key: "internal_ops_alert_settings",
        value: JSON.stringify({
          webhookEnabled: true,
          telegramEnabled: false,
          minLevel: "critical",
          cooldownMs: 300000,
          dailyDigestEnabled: false,
        }),
      }),
    },
  };

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: prismaClient as any,
    event: {
      provider: "openai-compatible",
      model: "gpt-5.4",
      operation: "draft_generate",
      success: false,
      createdAt: "2026-06-09T10:00:00.000Z",
    },
    fetchImpl: async (url) => {
      fetchCalls.push({ url: String(url) });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(alerts.length, 1);
  assert.equal(fetchCalls.length, 0);
});

test("daily digest is delivered once when enabled", async () => {
  process.env.AI_ALERT_WEBHOOK_URL = "https://alerts.example.test/hooks/ai";

  const fetchCalls: Array<{ code: string }> = [];
  let digestState: string | null = null;
  const prismaClient = {
    aiUsageEvent: {
      count: async () => 0,
      aggregate: async () => ({ _sum: { estimatedCostUsd: 0 } }),
      findMany: async () => [
        {
          provider: "openai-compatible",
          success: true,
          estimatedCostUsd: 0.55,
          latencyMs: 900,
          createdAt: new Date("2026-06-09T08:00:00.000Z"),
        },
        {
          provider: "openai-compatible",
          success: false,
          estimatedCostUsd: 0.35,
          latencyMs: 1100,
          createdAt: new Date("2026-06-09T09:00:00.000Z"),
        },
      ],
    },
    siteSetting: {
      findUnique: async ({ where }: any) => {
        if (where?.key === "internal_ops_alert_settings") {
          return {
            key: "internal_ops_alert_settings",
            value: JSON.stringify({
              webhookEnabled: true,
              telegramEnabled: false,
              minLevel: "warning",
              cooldownMs: 300000,
              dailyDigestEnabled: true,
            }),
          };
        }

        if (where?.key === "internal_ops_alert_digest_state" && digestState) {
          return { key: "internal_ops_alert_digest_state", value: digestState };
        }

        return null;
      },
      upsert: async ({ create, update }: any) => {
        digestState = update?.value ?? create.value;
        return { key: "internal_ops_alert_digest_state", value: digestState };
      },
    },
  };

  const alerts = await notifyAiOpsForUsageEvent({
    prismaClient: prismaClient as any,
    event: {
      provider: "openai-compatible",
      model: "gpt-5.4",
      operation: "conversation_start",
      success: true,
      createdAt: "2026-06-09T10:00:00.000Z",
    },
    fetchImpl: async (_url, init) => {
      const payload = init?.body ? JSON.parse(String(init.body)) : null;
      fetchCalls.push({ code: payload.code });
      return new Response("ok", { status: 200 });
    },
  });

  assert.equal(alerts.length, 0);
  assert.deepEqual(fetchCalls.map((entry) => entry.code), ["ai_daily_digest"]);
  assert.match(digestState || "", /lastSentAt/);
});
