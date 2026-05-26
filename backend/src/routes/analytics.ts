import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// POST /api/analytics/track â€” public, record page view
router.post("/track", async (req, res) => {
  const { path, referrer } = req.body;
  if (!path) {
    res.status(400).json({ error: "Path required" });
    return;
  }

  await prisma.pageView.create({
    data: {
      path,
      referrer: referrer || null,
      userAgent: req.headers["user-agent"] || null,
    },
  });

  res.status(201).json({ tracked: true });
});

async function getAnalyticsSummary() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalViews, recentViews, topPages, totalPosts, publishedPosts, totalProjects] =
    await Promise.all([
      prisma.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.pageView.groupBy({
        by: ["path"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { path: true },
        orderBy: { _count: { path: "desc" } },
        take: 10,
      }),
      prisma.post.count(),
      prisma.post.count({ where: { status: "PUBLISHED" } }),
      prisma.project.count(),
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

// GET /api/analytics/pages â€” admin, compatibility endpoint
router.get("/pages", authMiddleware, async (_req: AuthRequest, res) => {
  const summary = await getAnalyticsSummary();
  res.json(summary.topPages);
});

// GET /api/analytics/dashboard â€” admin
router.get("/dashboard", authMiddleware, async (_req: AuthRequest, res) => {
  const summary = await getAnalyticsSummary();
  res.json(summary);
});

export default router;
