import { logError, logInfo, logWarn } from "../utils/logging";

type AlertLevel = "info" | "warning" | "critical";

type AlertConfig = {
  webhookUrl: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  minLevel: AlertLevel;
  cooldownMs: number;
  timeoutMs: number;
  failureThreshold: number;
  highLatencyMs: number;
  latencyThreshold: number;
  lookbackMs: number;
  costLookbackMs: number;
  costSpikeMultiplier: number;
  costSpikeMinimumUsd: number;
  costSpikeMinimumDeltaUsd: number;
};

type AlertEventRecord = {
  id?: string;
  conversationId?: string | null;
  provider: string;
  model?: string | null;
  operation: string;
  success: boolean;
  latencyMs?: number | null;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
  createdAt?: string | Date | null;
};

type AlertPrisma = {
  aiUsageEvent: {
    findMany?: (args: any) => Promise<any[]>;
    count?: (args: any) => Promise<number>;
    aggregate?: (args: any) => Promise<{ _sum?: { estimatedCostUsd?: number | null } }>;
  };
  siteSetting?: {
    findUnique?: (args: any) => Promise<{ key: string; value: string } | null>;
    upsert?: (args: any) => Promise<{ key: string; value: string }>;
  };
};

type AlertPayload = {
  level: AlertLevel;
  code: string;
  title: string;
  message: string;
  provider: string;
  model: string | null;
  operation: string;
  conversationId: string | null;
  occurredAt: string;
  metrics?: Record<string, number | string | null> | null;
};

const ALERT_LEVEL_RANK: Record<AlertLevel, number> = {
  info: 1,
  warning: 2,
  critical: 3,
};

const alertCooldowns = new Map<string, number>();
const ALERT_SETTINGS_KEY = "internal_ops_alert_settings";
const ALERT_DIGEST_STATE_KEY = "internal_ops_alert_digest_state";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type StoredAlertPreferences = {
  webhookEnabled: boolean;
  telegramEnabled: boolean;
  minLevel: AlertLevel;
  cooldownMs: number;
  dailyDigestEnabled: boolean;
};

function parseNumber(value: string | undefined, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function readAlertConfig(): AlertConfig {
  const webhookUrl = process.env.AI_ALERT_WEBHOOK_URL?.trim() || null;
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID?.trim() || null;
  const minLevel = (process.env.AI_ALERT_MIN_LEVEL?.trim().toLowerCase() || "warning") as AlertLevel;

  return {
    webhookUrl,
    telegramBotToken,
    telegramChatId,
    minLevel: minLevel === "info" || minLevel === "warning" || minLevel === "critical" ? minLevel : "warning",
    cooldownMs: parseNumber(process.env.AI_ALERT_COOLDOWN_MS, 5 * 60 * 1000),
    timeoutMs: parseNumber(process.env.AI_ALERT_TIMEOUT_MS, 5000),
    failureThreshold: parseNumber(process.env.AI_ALERT_FAILURE_THRESHOLD, 3),
    highLatencyMs: parseNumber(process.env.AI_ALERT_HIGH_LATENCY_MS, 15000),
    latencyThreshold: parseNumber(process.env.AI_ALERT_LATENCY_THRESHOLD, 3),
    lookbackMs: parseNumber(process.env.AI_ALERT_LOOKBACK_MS, 15 * 60 * 1000),
    costLookbackMs: parseNumber(process.env.AI_ALERT_COST_LOOKBACK_MS, 60 * 60 * 1000),
    costSpikeMultiplier: parseNumber(process.env.AI_ALERT_COST_SPIKE_MULTIPLIER, 1.5),
    costSpikeMinimumUsd: parseNumber(process.env.AI_ALERT_COST_SPIKE_MIN_USD, 1),
    costSpikeMinimumDeltaUsd: parseNumber(process.env.AI_ALERT_COST_SPIKE_MIN_DELTA_USD, 0.5),
  };
}

function shouldSendLevel(level: AlertLevel, minLevel: AlertLevel) {
  return ALERT_LEVEL_RANK[level] >= ALERT_LEVEL_RANK[minLevel];
}

function parseOccurredAt(value: string | Date | null | undefined) {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

function safeParseDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStoredAlertPreferences(value: unknown): StoredAlertPreferences {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const minLevel = typeof record.minLevel === "string" ? record.minLevel.toLowerCase() : "";
  const storedCooldownMs = Number(record.cooldownMs);
  return {
    webhookEnabled: record.webhookEnabled === true,
    telegramEnabled: record.telegramEnabled === true,
    minLevel: minLevel === "info" || minLevel === "warning" || minLevel === "critical" ? (minLevel as AlertLevel) : "warning",
    cooldownMs: Number.isFinite(storedCooldownMs) && storedCooldownMs >= 0 ? storedCooldownMs : 5 * 60 * 1000,
    dailyDigestEnabled: record.dailyDigestEnabled === true,
  };
}

async function loadStoredAlertPreferences(prismaClient: AlertPrisma): Promise<StoredAlertPreferences> {
  if (!prismaClient.siteSetting?.findUnique) {
    return {
      webhookEnabled: false,
      telegramEnabled: false,
      minLevel: "warning",
      cooldownMs: 5 * 60 * 1000,
      dailyDigestEnabled: false,
    };
  }

  try {
    const row = await prismaClient.siteSetting.findUnique({ where: { key: ALERT_SETTINGS_KEY } });
    if (!row?.value) {
      return {
        webhookEnabled: false,
        telegramEnabled: false,
        minLevel: "warning",
        cooldownMs: 5 * 60 * 1000,
        dailyDigestEnabled: false,
      };
    }

    try {
      return normalizeStoredAlertPreferences(JSON.parse(row.value));
    } catch {
      return {
        webhookEnabled: false,
        telegramEnabled: false,
        minLevel: "warning",
        cooldownMs: 5 * 60 * 1000,
        dailyDigestEnabled: false,
      };
    }
  } catch {
    return {
      webhookEnabled: false,
      telegramEnabled: false,
      minLevel: "warning",
      cooldownMs: 5 * 60 * 1000,
      dailyDigestEnabled: false,
    };
  }
}

async function postAlert(
  config: AlertConfig,
  preferences: StoredAlertPreferences,
  payload: AlertPayload,
  fetchImpl: typeof fetch
) {
  if (!shouldSendLevel(payload.level, preferences.minLevel)) {
    return false;
  }

  const dedupeKey = `${payload.code}:${payload.provider}:${payload.model || "unknown"}:${payload.operation}`;
  const now = Date.now();
  const previousSentAt = alertCooldowns.get(dedupeKey) || 0;
  if (now - previousSentAt < preferences.cooldownMs) {
    return false;
  }

  alertCooldowns.set(dedupeKey, now);

  try {
    let delivered = false;

    if (preferences.webhookEnabled && config.webhookUrl) {
      const response = await fetchImpl(config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "SimpleAIFolio-ai-ops",
          ...payload,
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });

      if (!response.ok) {
        logWarn("AI ops alert webhook rejected payload", {
          level: payload.level,
          code: payload.code,
          provider: payload.provider,
          status: response.status,
        });
      } else {
        delivered = true;
      }
    }

    if (preferences.telegramEnabled && config.telegramBotToken && config.telegramChatId) {
      const telegramText = [
        `SimpleAIFolio AI Ops Alert`,
        `${payload.level.toUpperCase()} · ${payload.title}`,
        payload.message,
        `Provider: ${payload.provider}`,
        `Operation: ${payload.operation}`,
        payload.model ? `Model: ${payload.model}` : null,
        payload.conversationId ? `Conversation: ${payload.conversationId}` : null,
        `Occurred: ${payload.occurredAt}`,
      ]
        .filter(Boolean)
        .join("\n");

      const telegramResponse = await fetchImpl(
        `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: telegramText,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(config.timeoutMs),
        }
      );

      if (!telegramResponse.ok) {
        logWarn("AI ops alert telegram delivery failed", {
          level: payload.level,
          code: payload.code,
          provider: payload.provider,
          status: telegramResponse.status,
        });
      } else {
        delivered = true;
      }
    }

    if (delivered) {
      logInfo("AI ops alert delivered", {
        level: payload.level,
        code: payload.code,
        provider: payload.provider,
        operation: payload.operation,
      });
    }

    return delivered;
  } catch (error) {
    logWarn("AI ops alert delivery failed", {
      level: payload.level,
      code: payload.code,
      provider: payload.provider,
      operation: payload.operation,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function maybeSendDailyDigest({
  prismaClient,
  config,
  preferences,
  fetchImpl,
  occurredAt,
}: {
  prismaClient: AlertPrisma;
  config: AlertConfig;
  preferences: StoredAlertPreferences;
  fetchImpl: typeof fetch;
  occurredAt: Date;
}) {
  if (!preferences.dailyDigestEnabled) {
    return false;
  }

  if (!prismaClient.siteSetting?.findUnique || !prismaClient.siteSetting?.upsert || !prismaClient.aiUsageEvent.findMany) {
    return false;
  }

  try {
    const digestState = await prismaClient.siteSetting.findUnique({ where: { key: ALERT_DIGEST_STATE_KEY } });
    const lastSentAt = digestState?.value ? safeParseDate(JSON.parse(digestState.value)?.lastSentAt) : null;
    if (lastSentAt && occurredAt.getTime() - lastSentAt.getTime() < ONE_DAY_MS) {
      return false;
    }

    const windowStart = new Date(occurredAt.getTime() - ONE_DAY_MS);
    const events = await prismaClient.aiUsageEvent.findMany({
      where: { createdAt: { gte: windowStart, lte: occurredAt } },
      select: {
        provider: true,
        success: true,
        estimatedCostUsd: true,
        latencyMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!events.length) {
      return false;
    }

    const totalCalls = events.length;
    const failures = events.filter((event) => event.success === false).length;
    const estimatedCostUsd = Number(
      events.reduce((sum, event) => sum + Number(event.estimatedCostUsd || 0), 0).toFixed(6)
    );
    const avgLatencyMs = Math.round(
      events.reduce((sum, event) => sum + Number(event.latencyMs || 0), 0) / Math.max(totalCalls, 1)
    );
    const providerCounts = new Map<string, number>();
    for (const event of events) {
      providerCounts.set(event.provider, (providerCounts.get(event.provider) || 0) + 1);
    }
    const topProvider = [...providerCounts.entries()].sort((left, right) => right[1] - left[1])[0];

    const delivered = await postAlert(
      config,
      { ...preferences, minLevel: "info", cooldownMs: 0 },
      {
        level: "info",
        code: "ai_daily_digest",
        title: "Daily AI ops digest",
        message: `${totalCalls} AI calls were recorded in the last 24 hours with ${failures} failures and $${estimatedCostUsd.toFixed(4)} estimated cost.`,
        provider: topProvider?.[0] || "system",
        model: null,
        operation: "daily_digest",
        conversationId: null,
        occurredAt: occurredAt.toISOString(),
        metrics: {
          totalCalls,
          failures,
          estimatedCostUsd,
          avgLatencyMs,
        },
      },
      fetchImpl
    );

    if (delivered) {
      await prismaClient.siteSetting.upsert({
        where: { key: ALERT_DIGEST_STATE_KEY },
        update: { value: JSON.stringify({ lastSentAt: occurredAt.toISOString() }) },
        create: { key: ALERT_DIGEST_STATE_KEY, value: JSON.stringify({ lastSentAt: occurredAt.toISOString() }) },
      });
    }

    return delivered;
  } catch (error) {
    logWarn("AI ops daily digest evaluation failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function notifyAiOpsForUsageEvent({
  prismaClient,
  event,
  fetchImpl = fetch,
}: {
  prismaClient: AlertPrisma;
  event: AlertEventRecord;
  fetchImpl?: typeof fetch;
}) {
  const config = readAlertConfig();
  const preferences = await loadStoredAlertPreferences(prismaClient);

  if (
    (!preferences.webhookEnabled || !config.webhookUrl) &&
    (!preferences.telegramEnabled || !(config.telegramBotToken && config.telegramChatId))
  ) {
    return [];
  }

  const occurredAt = parseOccurredAt(event.createdAt);
  const payloads: AlertPayload[] = [];

  try {
    if (!event.success && prismaClient.aiUsageEvent.count) {
      const failureCount = await prismaClient.aiUsageEvent.count({
        where: {
          provider: event.provider,
          success: false,
          createdAt: {
            gte: new Date(occurredAt.getTime() - config.lookbackMs),
          },
        },
      });

      if (failureCount >= config.failureThreshold) {
        payloads.push({
          level: failureCount >= config.failureThreshold * 2 ? "critical" : "warning",
          code: "ai_provider_failure_burst",
          title: "Repeated AI provider failures",
          message: `${failureCount} failed AI calls were recorded for ${event.provider} in the recent alert window.`,
          provider: event.provider,
          model: event.model || null,
          operation: event.operation,
          conversationId: event.conversationId || null,
          occurredAt: occurredAt.toISOString(),
          metrics: { failures: failureCount, lookbackMs: config.lookbackMs },
        });
      }
    }

    if (typeof event.latencyMs === "number" && event.latencyMs >= config.highLatencyMs && prismaClient.aiUsageEvent.count) {
      const highLatencyCount = await prismaClient.aiUsageEvent.count({
        where: {
          provider: event.provider,
          latencyMs: { gte: config.highLatencyMs },
          createdAt: {
            gte: new Date(occurredAt.getTime() - config.lookbackMs),
          },
        },
      });

      if (highLatencyCount >= config.latencyThreshold) {
        payloads.push({
          level: "warning",
          code: "ai_latency_sustained",
          title: "Sustained AI latency detected",
          message: `${highLatencyCount} high-latency AI calls were recorded for ${event.provider}.`,
          provider: event.provider,
          model: event.model || null,
          operation: event.operation,
          conversationId: event.conversationId || null,
          occurredAt: occurredAt.toISOString(),
          metrics: { latencyMs: event.latencyMs, highLatencyCount },
        });
      }
    }

    if (typeof event.estimatedCostUsd === "number" && event.estimatedCostUsd > 0 && prismaClient.aiUsageEvent.aggregate) {
      const currentWindowStart = new Date(occurredAt.getTime() - config.costLookbackMs);
      const previousWindowStart = new Date(currentWindowStart.getTime() - config.costLookbackMs);
      const [currentAggregate, previousAggregate] = await Promise.all([
        prismaClient.aiUsageEvent.aggregate({
          where: {
            provider: event.provider,
            createdAt: {
              gte: currentWindowStart,
              lte: occurredAt,
            },
          },
          _sum: { estimatedCostUsd: true },
        }),
        prismaClient.aiUsageEvent.aggregate({
          where: {
            provider: event.provider,
            createdAt: {
              gte: previousWindowStart,
              lt: currentWindowStart,
            },
          },
          _sum: { estimatedCostUsd: true },
        }),
      ]);

      const currentCost = Number(currentAggregate?._sum?.estimatedCostUsd || 0);
      const previousCost = Number(previousAggregate?._sum?.estimatedCostUsd || 0);

      if (
        currentCost >= config.costSpikeMinimumUsd &&
        currentCost - previousCost >= config.costSpikeMinimumDeltaUsd &&
        (previousCost === 0 || currentCost >= previousCost * config.costSpikeMultiplier)
      ) {
        payloads.push({
          level: "warning",
          code: "ai_cost_spike",
          title: "AI cost spike detected",
          message: `${event.provider} reached an estimated $${currentCost.toFixed(4)} in the current cost window versus $${previousCost.toFixed(4)} previously.`,
          provider: event.provider,
          model: event.model || null,
          operation: event.operation,
          conversationId: event.conversationId || null,
          occurredAt: occurredAt.toISOString(),
          metrics: {
            currentCostUsd: Number(currentCost.toFixed(6)),
            previousCostUsd: Number(previousCost.toFixed(6)),
            latestCallCostUsd: Number((event.estimatedCostUsd || 0).toFixed(6)),
          },
        });
      }
    }

    for (const payload of payloads) {
      await postAlert(config, preferences, payload, fetchImpl);
    }
  } catch (error) {
    logError("AI ops alert evaluation failed", {
      provider: event.provider,
      operation: event.operation,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await maybeSendDailyDigest({
    prismaClient,
    config,
    preferences,
    fetchImpl,
    occurredAt,
  });

  return payloads;
}

export function isAiOpsAlertingConfigured() {
  const config = readAlertConfig();
  return Boolean(config.webhookUrl || (config.telegramBotToken && config.telegramChatId));
}

export async function sendAiOpsTestAlert({
  prismaClient,
  fetchImpl = fetch,
}: {
  prismaClient: AlertPrisma;
  fetchImpl?: typeof fetch;
}) {
  const config = readAlertConfig();
  const preferences = await loadStoredAlertPreferences(prismaClient);

  if (
    (!preferences.webhookEnabled || !config.webhookUrl) &&
    (!preferences.telegramEnabled || !(config.telegramBotToken && config.telegramChatId))
  ) {
    return { delivered: false, reason: "Notifications are disabled or not configured." };
  }

  const delivered = await postAlert(
    config,
    { ...preferences, minLevel: "info", cooldownMs: 0 },
    {
      level: "warning",
      code: "ai_test_alert",
      title: "Test alert",
      message: "This is a manual AI ops notification test from the SimpleAIFolio admin dashboard.",
      provider: "system",
      model: null,
      operation: "manual_test",
      conversationId: null,
      occurredAt: new Date().toISOString(),
      metrics: null,
    },
    fetchImpl
  );

  return { delivered, reason: delivered ? null : "No alert destination accepted the test message." };
}

export function resetAiOpsAlertStateForTests() {
  alertCooldowns.clear();
}
