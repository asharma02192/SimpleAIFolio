import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { param } from "../utils/express";

const router = Router();

router.get("/posts/:postId/reactions", async (req, res) => {
  try {
    const postId = param(req, "postId");
    const fingerprint = (req.query.fingerprint as string) || "";

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const reactions = await prisma.postReaction.findMany({
      where: { postId },
    });

    const grouped = reactions.reduce(
      (acc, r) => {
        if (!acc[r.emoji]) {
          acc[r.emoji] = { emoji: r.emoji, count: 0, reacted: false };
        }
        acc[r.emoji].count += 1;
        if (fingerprint && r.fingerprint === fingerprint) {
          acc[r.emoji].reacted = true;
        }
        return acc;
      },
      {} as Record<string, { emoji: string; count: number; reacted: boolean }>,
    );

    res.json(Object.values(grouped));
  } catch (err) {
    console.error("Get reactions error:", err);
    res.status(500).json({ error: "Failed to fetch reactions" });
  }
});

router.post("/posts/:postId/reactions", async (req, res) => {
  try {
    const postId = param(req, "postId");
    const { emoji, fingerprint } = req.body;

    if (!emoji || !fingerprint) {
      res.status(400).json({ error: "Emoji and fingerprint are required" });
      return;
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const existing = await prisma.postReaction.findUnique({
      where: { postId_fingerprint_emoji: { postId, fingerprint, emoji } },
    });

    if (existing) {
      await prisma.postReaction.delete({ where: { id: existing.id } });
      res.json({ removed: true });
    } else {
      const reaction = await prisma.postReaction.create({
        data: { postId, fingerprint, emoji },
      });
      res.status(201).json(reaction);
    }
  } catch (err) {
    console.error("Toggle reaction error:", err);
    res.status(500).json({ error: "Failed to toggle reaction" });
  }
});

router.delete("/admin/reactions/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    await prisma.postReaction.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete reaction error:", err);
    res.status(500).json({ error: "Failed to delete reaction" });
  }
});

export default router;
