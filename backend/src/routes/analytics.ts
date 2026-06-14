import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest, requireRoleWithClient } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { getRequestLogMeta, logError, logWarn } from "../utils/logging";
import { sendAiOpsTestAlert } from "../services/ops-alerts";

type AnalyticsPrisma = Pick<typeof prisma, "pageView" | "post" | "project" | "aiUsageEvent" | "aiConversation" | "siteSetting" | "$transaction"> & { user: any };
const ALERT_SETTINGS_KEY = "internal_ops_alert_settings";

type AiUsageAnalyticsEvent = {
  provider: string;
  model: string | null;
  operation: string;
  success: boolean;
  latencyMs: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: Date;
};

type AiOpsAlert = {
  level: "info" | "warning" | "critical";
  code: string;
  title: string;
  message: string;
};

function parseWindowDays(value: unknown) {
  const days = Number.parseInt(String(value || "30"), 10);
  return [7, 30, 90].includes(days) ? days : 30;
}

function parseAlertLevel(value: unknown) {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  return normalized === "info" || normalized === "warning" || normalized === "critical" ? normalized : "warning";
}

function parseCooldownMs(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 5 * 60 * 1000;
}

function formatBucketDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function createAiAlerts({
  totalCalls,
  totalAiFailures,
  successRate,
  avgLatencyMs,
  estimatedCostUsd,
  previousPeriodCostUsd,
  providerBreakdown,
}: {
  totalCalls: number;
  totalAiFailures: number;
  successRate: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  previousPeriodCostUsd: number;
  providerBreakdown: Array<{ provider: string; calls: number; failures: number; estimatedCostUsd: number }>;
}): AiOpsAlert[] {
  const alerts: AiOpsAlert[] = [];

  if (totalAiFailures >= 3 && successRate < 80) {
    alerts.push({
      level: "critical",
      code: "failure_rate_high",
      title: "Failure rate is elevated",
      message: `${totalAiFailures} AI calls failed in the current window and success rate dropped to ${successRate}%.`,
    });
  } else if (totalAiFailures > 0 && successRate < 95) {
    alerts.push({
      level: "warning",
      code: "failure_rate_warning",
      title: "AI failures need review",
      message: `${totalAiFailures} AI calls failed in the current window. Review recent provider errors before they become a broader outage.`,
    });
  }

  if (avgLatencyMs >= 15000 && totalCalls >= 5) {
    alerts.push({
      level: "warning",
      code: "latency_high",
      title: "Average AI latency is high",
      message: `Average AI latency is ${avgLatencyMs} ms across ${totalCalls} calls in this window.`,
    });
  }

  if (previousPeriodCostUsd > 0 && estimatedCostUsd >= previousPeriodCostUsd * 1.5 && estimatedCostUsd - previousPeriodCostUsd >= 0.5) {
    alerts.push({
      level: "warning",
      code: "cost_spike",
      title: "AI spend is rising faster than the prior window",
      message: `Estimated AI cost is $${estimatedCostUsd.toFixed(4)} versus $${previousPeriodCostUsd.toFixed(4)} in the previous window.`,
    });
  }

  const topProvider = providerBreakdown[0];
  if (topProvider && totalCalls >= 10 && topProvider.calls / totalCalls >= 0.85) {
    alerts.push({
      level: "info",
      code: "provider_concentration",
      title: "AI traffic is concentrated on one provider",
      message: `${topProvider.provider} handled ${topProvider.calls} of ${totalCalls} AI calls in this window.`,
    });
  }

  return alerts;
}

export function createAnalyticsRouter({ prismaClient = prisma }: { prismaClient?: AnalyticsPrisma } = {}) {
  const router = Router();
  const analyticsRateLimit = createRateLimiter({
    keyPrefix: "analytics-track",
    maxRequests: 120,
    windowMs: 60 * 1000,
    message: "Too many analytics requests. Please try again later.",
  });

  // POST /api/analytics/track - public, record page view
  router.post("/track", analyticsRateLimit, async (req, res) => {
    const { path, referrer } = req.body;
    if (!path) {
      res.status(400).json({ error: "Path required" });
      return;
    }

    try {
      await prismaClient.pageView.create({
        data: {
          path,
          referrer: referrer || null,
          userAgent: req.headers["user-agent"] || null,
        },
      });

      res.status(201).json({ tracked: true });
    } catch (error) {
      logError("Analytics tracking failed", {
        ...getRequestLogMeta(req),
        path: typeof path === "string" ? path : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Analytics tracking failed" });
    }
  });

  async function getAnalyticsSummary(windowDays = 30) {
    const now = new Date();
    const periodStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousPeriodStart = new Date(periodStart.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const [
      totalViews,
      recentViews,
      topPages,
      totalPosts,
      publishedPosts,
      scheduledPosts,
      totalProjects,
      totalAiCalls,
      totalAiFailures,
      aiUsageAggregate,
      previousPeriodAggregate,
      providerGroups,
      modelGroups,
      operationGroups,
      usageTrendEvents,
      recentAiFailures,
      totalAiConversations,
      archivedAiConversations,
    ] =
      await Promise.all([
        prismaClient.pageView.count({ where: { createdAt: { gte: periodStart } } }),
        prismaClient.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prismaClient.pageView.groupBy({
          by: ["path"],
          where: { createdAt: { gte: periodStart } },
          _count: { path: true },
          orderBy: { _count: { path: "desc" } },
          take: 10,
        }),
        prismaClient.post.count(),
        prismaClient.post.count({ where: { status: "PUBLISHED" } }),
        prismaClient.post.count({ where: { status: "SCHEDULED" } }),
        prismaClient.project.count(),
        prismaClient.aiUsageEvent.count({ where: { createdAt: { gte: periodStart } } }),
        prismaClient.aiUsageEvent.count({ where: { createdAt: { gte: periodStart }, success: false } }),
        prismaClient.aiUsageEvent.aggregate({
          where: { createdAt: { gte: periodStart } },
          _sum: { totalTokens: true, estimatedCostUsd: true },
          _avg: { latencyMs: true },
        }),
        prismaClient.aiUsageEvent.aggregate({
          where: {
            createdAt: {
              gte: previousPeriodStart,
              lt: periodStart,
            },
          },
          _sum: { estimatedCostUsd: true },
        }),
        prismaClient.aiUsageEvent.groupBy({
          by: ["provider"],
          where: { createdAt: { gte: periodStart } },
          _count: { provider: true },
          _sum: { estimatedCostUsd: true },
          orderBy: { _count: { provider: "desc" } },
          take: 5,
        }),
        prismaClient.aiUsageEvent.groupBy({
          by: ["provider", "model"],
          where: { createdAt: { gte: periodStart } },
          _count: { model: true },
          _sum: { estimatedCostUsd: true },
          orderBy: { _count: { model: "desc" } },
          take: 6,
        }),
        prismaClient.aiUsageEvent.groupBy({
          by: ["operation"],
          where: { createdAt: { gte: periodStart } },
          _count: { operation: true },
          orderBy: { _count: { operation: "desc" } },
          take: 6,
        }),
        prismaClient.aiUsageEvent.findMany({
          where: { createdAt: { gte: periodStart } },
          select: {
            provider: true,
            model: true,
            operation: true,
            success: true,
            latencyMs: true,
            totalTokens: true,
            estimatedCostUsd: true,
            createdAt: true,
          },
        }),
        prismaClient.aiUsageEvent.findMany({
          where: { createdAt: { gte: periodStart }, success: false },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            operation: true,
            provider: true,
            errorMessage: true,
            createdAt: true,
            conversation: {
              select: {
                id: true,
                title: true,
                topic: true,
              },
            },
          },
        }),
        prismaClient.aiConversation.count(),
        prismaClient.aiConversation.count({ where: { archivedAt: { not: null } } }),
      ]);

    const avgLatencyMs = Math.round(aiUsageAggregate._avg.latencyMs || 0);
    const totalTokens = aiUsageAggregate._sum.totalTokens || 0;
    const estimatedCostUsd = Number(((aiUsageAggregate._sum.estimatedCostUsd || 0)).toFixed(6));
    const previousPeriodCostUsd = Number(((previousPeriodAggregate._sum.estimatedCostUsd || 0)).toFixed(6));
    const successRate = totalAiCalls > 0 ? Math.round(((totalAiCalls - totalAiFailures) / totalAiCalls) * 100) : 100;

    const dailyUsageMap = new Map<string, { date: string; calls: number; failures: number; totalTokens: number; estimatedCostUsd: number }>();
    const providerBreakdownMap = new Map<string, { provider: string; calls: number; failures: number; totalTokens: number; estimatedCostUsd: number; avgLatencyAccumulator: number; avgLatencyCount: number }>();
    const modelBreakdownMap = new Map<string, { provider: string; model: string; calls: number; failures: number; totalTokens: number; estimatedCostUsd: number; avgLatencyAccumulator: number; avgLatencyCount: number }>();

    for (const event of usageTrendEvents as AiUsageAnalyticsEvent[]) {
      const date = formatBucketDate(new Date(event.createdAt));
      const dailyEntry = dailyUsageMap.get(date) || { date, calls: 0, failures: 0, totalTokens: 0, estimatedCostUsd: 0 };
      dailyEntry.calls += 1;
      if (!event.success) dailyEntry.failures += 1;
      dailyEntry.totalTokens += event.totalTokens || 0;
      dailyEntry.estimatedCostUsd += event.estimatedCostUsd || 0;
      dailyUsageMap.set(date, dailyEntry);

      const providerEntry = providerBreakdownMap.get(event.provider) || {
        provider: event.provider,
        calls: 0,
        failures: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        avgLatencyAccumulator: 0,
        avgLatencyCount: 0,
      };
      providerEntry.calls += 1;
      if (!event.success) providerEntry.failures += 1;
      providerEntry.totalTokens += event.totalTokens || 0;
      providerEntry.estimatedCostUsd += event.estimatedCostUsd || 0;
      if (typeof event.latencyMs === "number") {
        providerEntry.avgLatencyAccumulator += event.latencyMs;
        providerEntry.avgLatencyCount += 1;
      }
      providerBreakdownMap.set(event.provider, providerEntry);

      const modelKey = `${event.provider}:${event.model || "unknown"}`;
      const modelEntry = modelBreakdownMap.get(modelKey) || {
        provider: event.provider,
        model: event.model || "unknown",
        calls: 0,
        failures: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        avgLatencyAccumulator: 0,
        avgLatencyCount: 0,
      };
      modelEntry.calls += 1;
      if (!event.success) modelEntry.failures += 1;
      modelEntry.totalTokens += event.totalTokens || 0;
      modelEntry.estimatedCostUsd += event.estimatedCostUsd || 0;
      if (typeof event.latencyMs === "number") {
        modelEntry.avgLatencyAccumulator += event.latencyMs;
        modelEntry.avgLatencyCount += 1;
      }
      modelBreakdownMap.set(modelKey, modelEntry);
    }

    const dailyUsage = Array.from(dailyUsageMap.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((entry) => ({
        ...entry,
        estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)),
      }));

    const providerBreakdown = Array.from(providerBreakdownMap.values())
      .sort((left, right) => right.calls - left.calls)
      .map((entry) => ({
        provider: entry.provider,
        calls: entry.calls,
        failures: entry.failures,
        totalTokens: entry.totalTokens,
        estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)),
        avgLatencyMs: entry.avgLatencyCount > 0 ? Math.round(entry.avgLatencyAccumulator / entry.avgLatencyCount) : 0,
      }));

    const modelBreakdown = Array.from(modelBreakdownMap.values())
      .sort((left, right) => right.calls - left.calls)
      .map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        calls: entry.calls,
        failures: entry.failures,
        totalTokens: entry.totalTokens,
        estimatedCostUsd: Number(entry.estimatedCostUsd.toFixed(6)),
        avgLatencyMs: entry.avgLatencyCount > 0 ? Math.round(entry.avgLatencyAccumulator / entry.avgLatencyCount) : 0,
      }));

    const alerts = createAiAlerts({
      totalCalls: totalAiCalls,
      totalAiFailures,
      successRate,
      avgLatencyMs,
      estimatedCostUsd,
      previousPeriodCostUsd,
      providerBreakdown,
    });

    return {
      totalViews,
      recentViews,
      topPages: topPages.map((p: { path: string; _count: { path: number } }) => ({
        path: p.path,
        views: p._count.path,
      })),
      totalPosts,
      publishedPosts,
      scheduledPosts,
      totalProjects,
      aiOps: {
        windowDays,
        totalCalls: totalAiCalls,
        failures: totalAiFailures,
        successRate,
        totalTokens,
        estimatedCostUsd,
        previousPeriodCostUsd,
        avgLatencyMs,
        totalConversations: totalAiConversations,
        archivedConversations: archivedAiConversations,
        alerts,
        dailyUsage,
        providerBreakdown,
        modelBreakdown,
        topProviders: providerGroups.map(
          (group: { provider: string; _count: { provider: number }; _sum: { estimatedCostUsd: number | null } }) => ({
            provider: group.provider,
            calls: group._count.provider,
            estimatedCostUsd: Number(((group._sum.estimatedCostUsd || 0)).toFixed(6)),
          })
        ),
        topModels: modelGroups.map(
          (group: { provider: string; model: string | null; _count: { model: number | null }; _sum: { estimatedCostUsd: number | null } }) => ({
            provider: group.provider,
            model: group.model || "unknown",
            calls: group._count.model || 0,
            estimatedCostUsd: Number(((group._sum.estimatedCostUsd || 0)).toFixed(6)),
          })
        ),
        topOperations: operationGroups.map(
          (group: { operation: string; _count: { operation: number } }) => ({
            operation: group.operation,
            calls: group._count.operation,
          })
        ),
        recentFailures: recentAiFailures.map(
          (event: {
            id: string;
            operation: string;
            provider: string;
            errorMessage: string | null;
            createdAt: Date;
            conversation: { id: string; title: string; topic: string } | null;
          }) => ({
            id: event.id,
            operation: event.operation,
            provider: event.provider,
            errorMessage: event.errorMessage || "Unknown AI failure",
            createdAt: event.createdAt,
            conversationId: event.conversation?.id || null,
            conversationLabel: event.conversation?.title || event.conversation?.topic || null,
          })
        ),
      },
    };
  }

  async function getAlertSettings() {
    const row = await prismaClient.siteSetting.findUnique({ where: { key: ALERT_SETTINGS_KEY } });
    let stored: {
      webhookEnabled?: boolean;
      telegramEnabled?: boolean;
      minLevel?: string;
      cooldownMs?: number;
      dailyDigestEnabled?: boolean;
    } = {};

    if (row?.value) {
      try {
        stored = JSON.parse(row.value) as typeof stored;
      } catch {
        stored = {};
      }
    }

    return {
      webhookEnabled: stored.webhookEnabled === true,
      telegramEnabled: stored.telegramEnabled === true,
      minLevel: parseAlertLevel(stored.minLevel),
      cooldownMs: parseCooldownMs(stored.cooldownMs),
      dailyDigestEnabled: stored.dailyDigestEnabled === true,
      webhookConfigured: Boolean(process.env.AI_ALERT_WEBHOOK_URL?.trim()),
      telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim() && process.env.TELEGRAM_CHAT_ID?.trim()),
    };
  }

  // GET /api/analytics/page-views - public, get view count for a path
  router.get("/page-views", async (req, res) => {
    const path = req.query.path as string;
    if (!path) {
      res.json({ views: 0 });
      return;
    }
    try {
      const count = await prismaClient.pageView.count({
        where: { path },
      });
      res.json({ views: count });
    } catch {
      res.json({ views: 0 });
    }
  });

  // GET /api/analytics/pages - admin, compatibility endpoint
  router.get("/pages", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    const summary = await getAnalyticsSummary(parseWindowDays(req.query.windowDays));
    res.json(summary.topPages);
  });

  // GET /api/analytics/dashboard - admin
  router.get("/dashboard", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    const summary = await getAnalyticsSummary(parseWindowDays(req.query.windowDays));
    res.json(summary);
  });

  router.get("/alert-settings", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (_req: AuthRequest, res) => {
    try {
      res.json(await getAlertSettings());
    } catch (error) {
      res.status(500).json({ error: "Failed to load alert settings" });
    }
  });

  router.put("/alert-settings", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    try {
      const webhookEnabled = req.body?.webhookEnabled === true;
      const telegramEnabled = req.body?.telegramEnabled === true;
      const minLevel = parseAlertLevel(req.body?.minLevel);
      const cooldownMs = parseCooldownMs(req.body?.cooldownMs);
      const dailyDigestEnabled = req.body?.dailyDigestEnabled === true;

      await prismaClient.siteSetting.upsert({
        where: { key: ALERT_SETTINGS_KEY },
        update: { value: JSON.stringify({ webhookEnabled, telegramEnabled, minLevel, cooldownMs, dailyDigestEnabled }) },
        create: {
          key: ALERT_SETTINGS_KEY,
          value: JSON.stringify({ webhookEnabled, telegramEnabled, minLevel, cooldownMs, dailyDigestEnabled }),
        },
      });

      res.json(await getAlertSettings());
    } catch (error) {
      res.status(500).json({ error: "Failed to update alert settings" });
    }
  });

  router.post("/alert-settings/test", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (_req: AuthRequest, res) => {
    try {
      const result = await sendAiOpsTestAlert({ prismaClient });
      if (!result.delivered) {
        res.status(400).json({ error: result.reason || "Failed to deliver test alert" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to send test alert" });
    }
  });

  return router;
}

export default createAnalyticsRouter();
