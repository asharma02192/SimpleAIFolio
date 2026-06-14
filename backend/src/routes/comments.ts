import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { trimmedString } from "../utils/express";

const router = Router();

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = (req.params as Record<string, string>).postId;
    const comments = await prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
    });
    res.json(comments);
  } catch (err) {
    console.error("Get comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = (req.params as Record<string, string>).postId;
    const { author, content, parentId } = req.body;
    if (!trimmedString(author) || !trimmedString(content)) {
      res.status(400).json({ error: "Name and comment are required" });
      return;
    }
    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    const comment = await prisma.comment.create({
      data: {
        author: trimmedString(author).slice(0, 100),
        content: trimmedString(content).slice(0, 2000),
        postId,
        parentId: trimmedString(parentId) || null,
      },
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

router.delete("/admin/comments/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = (req.params as Record<string, string>).id;
    await prisma.comment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
