import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/tags — public
router.get("/", async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: "asc" },
    });
    res.json(tags.map((t: { _count: { posts: number }; [k: string]: unknown }) => ({ ...t, postCount: t._count.posts })));
  } catch (err) {
    console.error("Get tags error:", err);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// POST /api/tags — admin
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const name = trimmedString(req.body.name);
    const slug = trimmedString(req.body.slug);
    if (!name || !slug) {
      res.status(400).json({ error: "Name and slug are required" });
      return;
    }
    const tag = await prisma.tag.create({ data: { name, slug } });
    res.status(201).json(tag);
  } catch (err) {
    console.error("Create tag error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Tag with this name or slug already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create tag" });
  }
});

// PUT /api/tags/:id — admin
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, slug } = req.body;
    const tag = await prisma.tag.update({
      where: { id: param(req, "id") },
      data: { ...(name && { name }), ...(slug && { slug }) },
    });
    res.json(tag);
  } catch (err) {
    console.error("Update tag error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Tag with this name or slug already exists" });
      return;
    }
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/tags/:id — admin
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.tag.delete({ where: { id: param(req, "id") } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete tag error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Tag not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
