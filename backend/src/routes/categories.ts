import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/categories — public
router.get("/", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: { _count: { select: { posts: true } } },
      orderBy: { name: "asc" },
    });
    res.json(categories.map((c: { _count: { posts: number }; [k: string]: unknown }) => ({ ...c, postCount: c._count.posts })));
  } catch (err) {
    console.error("Get categories error:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// POST /api/categories — admin
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { description } = req.body;
    const name = trimmedString(req.body.name);
    const slug = trimmedString(req.body.slug);
    if (!name || !slug) {
      res.status(400).json({ error: "Name and slug are required" });
      return;
    }
    const category = await prisma.category.create({
      data: { name, slug, description: description || null },
    });
    res.status(201).json(category);
  } catch (err) {
    console.error("Create category error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Category with this name or slug already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create category" });
  }
});

// PUT /api/categories/:id — admin
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, slug, description } = req.body;
    const category = await prisma.category.update({
      where: { id: param(req, "id") },
      data: { ...(name && { name }), ...(slug && { slug }), ...(description !== undefined && { description }) },
    });
    res.json(category);
  } catch (err) {
    console.error("Update category error:", err);
    if (isPrismaErrorCode(err, "P2002")) {
      res.status(409).json({ error: "Category with this name or slug already exists" });
      return;
    }
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update category" });
  }
});

// DELETE /api/categories/:id — admin
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.category.delete({ where: { id: param(req, "id") } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete category error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Category not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
