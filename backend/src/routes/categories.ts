import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

type CategoriesPrisma = {
  category: any;
};

export function createCategoriesRouter({ prismaClient = prisma }: { prismaClient?: CategoriesPrisma } = {}) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const categories = await prismaClient.category.findMany({
        include: { _count: { select: { posts: true } } },
        orderBy: { name: "asc" },
      });
      res.json(
        categories.map((category: { _count: { posts: number }; [key: string]: unknown }) => ({
          ...category,
          postCount: category._count.posts,
        })),
      );
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  router.post("/", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { description } = req.body;
      const name = trimmedString(req.body.name);
      const slug = trimmedString(req.body.slug);

      if (!name || !slug) {
        res.status(400).json({ error: "Name and slug are required" });
        return;
      }

      const category = await prismaClient.category.create({
        data: { name, slug, description: description || null },
      });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      if (isPrismaErrorCode(error, "P2002")) {
        res.status(409).json({ error: "Category with this name or slug already exists" });
        return;
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { name, slug, description } = req.body;
      const category = await prismaClient.category.update({
        where: { id: param(req, "id") },
        data: {
          ...(name && { name }),
          ...(slug && { slug }),
          ...(description !== undefined && { description }),
        },
      });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      if (isPrismaErrorCode(error, "P2002")) {
        res.status(409).json({ error: "Category with this name or slug already exists" });
        return;
      }
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      await prismaClient.category.delete({ where: { id: param(req, "id") } });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.status(204).send();
    } catch (error) {
      console.error("Delete category error:", error);
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Category not found" });
        return;
      }
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  return router;
}

export default createCategoriesRouter();
