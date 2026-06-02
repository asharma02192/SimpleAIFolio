import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { getRequestLogMeta, logError, logWarn } from "../utils/logging";

type AnalyticsPrisma = Pick<typeof prisma, "pageView" | "post" | "project">;

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

  async function getAnalyticsSummary() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalViews, recentViews, topPages, totalPosts, publishedPosts, totalProjects] =
      await Promise.all([
        prismaClient.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prismaClient.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prismaClient.pageView.groupBy({
          by: ["path"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _count: { path: true },
          orderBy: { _count: { path: "desc" } },
          take: 10,
        }),
        prismaClient.post.count(),
        prismaClient.post.count({ where: { status: "PUBLISHED" } }),
        prismaClient.project.count(),
      ]);

    return {
      totalViews,
      recentViews,
      topPages: topPages.map((p: { path: string; _count: { path: number } }) => ({
        path: p.path,
        views: p._count.path,
      })),
      totalPosts,
      publishedPosts,
      totalProjects,
    };
  }

  // GET /api/analytics/pages - admin, compatibility endpoint
  router.get("/pages", authMiddleware, async (_req: AuthRequest, res) => {
    const summary = await getAnalyticsSummary();
    res.json(summary.topPages);
  });

  // GET /api/analytics/dashboard - admin
  router.get("/dashboard", authMiddleware, async (_req: AuthRequest, res) => {
    const summary = await getAnalyticsSummary();
    res.json(summary);
  });

  return router;
}

export default createAnalyticsRouter();
