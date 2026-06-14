import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

type TagsPrisma = {
  tag: any;
};

export function createTagsRouter({ prismaClient = prisma }: { prismaClient?: TagsPrisma } = {}) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const tags = await prismaClient.tag.findMany({
        include: { _count: { select: { posts: true } } },
        orderBy: { name: "asc" },
      });
      res.json(
        tags.map((tag: { _count: { posts: number }; [key: string]: unknown }) => ({
          ...tag,
          postCount: tag._count.posts,
        })),
      );
    } catch (error) {
      console.error("Get tags error:", error);
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  router.post("/", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
    try {
      const name = trimmedString(req.body.name);
      const slug = trimmedString(req.body.slug);

      if (!name || !slug) {
        res.status(400).json({ error: "Name and slug are required" });
        return;
      }

      const tag = await prismaClient.tag.create({ data: { name, slug } });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.status(201).json(tag);
    } catch (error) {
      console.error("Create tag error:", error);
      if (isPrismaErrorCode(error, "P2002")) {
        res.status(409).json({ error: "Tag with this name or slug already exists" });
        return;
      }
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  router.put("/:id", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
    try {
      const { name, slug } = req.body;
      const tag = await prismaClient.tag.update({
        where: { id: param(req, "id") },
        data: { ...(name && { name }), ...(slug && { slug }) },
      });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.json(tag);
    } catch (error) {
      console.error("Update tag error:", error);
      if (isPrismaErrorCode(error, "P2002")) {
        res.status(409).json({ error: "Tag with this name or slug already exists" });
        return;
      }
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Tag not found" });
        return;
      }
      res.status(500).json({ error: "Failed to update tag" });
    }
  });

  router.delete("/:id", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
    try {
      await prismaClient.tag.delete({ where: { id: param(req, "id") } });
      await triggerFrontendRevalidation({ type: "taxonomy" });
      res.status(204).send();
    } catch (error) {
      console.error("Delete tag error:", error);
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Tag not found" });
        return;
      }
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  return router;
}

export default createTagsRouter();
