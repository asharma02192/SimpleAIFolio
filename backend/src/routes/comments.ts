import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { param, trimmedString } from "../utils/express";

const router = Router();

// Public: get approved comments for a post
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = param(req, "postId");
    const comments = await prisma.comment.findMany({
      where: { postId, status: "approved" },
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
    const postId = param(req, "postId");
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
        status: "approved",
      },
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error("Create comment error:", err);
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// Admin: list all comments with filters
router.get("/admin/comments", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
  try {
    const rawStatus = (req.query.status as string) || "all";
    const validStatuses = ["all", "approved", "pending", "spam"];
    if (!validStatuses.includes(rawStatus)) {
      res.status(400).json({ error: "Invalid comment status" });
      return;
    }
    const status = rawStatus;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.perPage as string) || 20));

    const where = status !== "all" ? { status } : {};
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          post: { select: { id: true, title: true, slug: true } },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    res.json({
      data: comments,
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    });
  } catch (err) {
    console.error("List comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Admin: update comment status (approve/pending/spam)
router.put("/admin/comments/:id/status", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    const { status } = req.body;
    if (!["approved", "pending", "spam"].includes(status)) {
      res.status(400).json({ error: "Status must be approved, pending, or spam" });
      return;
    }
    const comment = await prisma.comment.update({
      where: { id },
      data: { status },
    });
    res.json(comment);
  } catch (err) {
    console.error("Update comment status error:", err);
    res.status(500).json({ error: "Failed to update comment" });
  }
});

router.delete("/admin/comments/:id", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    await prisma.comment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
