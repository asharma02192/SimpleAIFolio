import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

router.post("/publish-due", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await prisma.post.updateMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: { not: null, lte: new Date() },
      },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    res.json({ published: result.count });
  } catch (err) {
    console.error("Publish scheduled posts error:", err);
    res.status(500).json({ error: "Failed to publish scheduled posts" });
  }
});

export default router;
