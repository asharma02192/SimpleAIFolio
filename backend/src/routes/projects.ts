import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest, requireRoleWithClient } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

type ProjectsPrisma = {
  project: any;
  user: any;
};

export function createProjectsRouter({ prismaClient = prisma }: { prismaClient?: ProjectsPrisma } = {}) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const projects = await prismaClient.project.findMany({
        orderBy: [{ featured: "desc" }, { order: "asc" }],
      });
      res.json(projects);
    } catch (error) {
      console.error("Get projects error:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  router.post("/", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    try {
      const { techStack, liveUrl, githubUrl, featured, order, thumbnail } = req.body;
      const title = trimmedString(req.body.title);
      const description = trimmedString(req.body.description);

      if (!title || !description) {
        res.status(400).json({ error: "Title and description are required" });
        return;
      }

      const project = await prismaClient.project.create({
        data: {
          title,
          description,
          techStack: techStack || [],
          liveUrl: liveUrl || null,
          githubUrl: githubUrl || null,
          thumbnail: thumbnail || null,
          featured: featured || false,
          order: order || 0,
        },
      });
      await triggerFrontendRevalidation({ type: "project" });
      res.status(201).json(project);
    } catch (error) {
      console.error("Create project error:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  router.put("/:id", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    try {
      const { title, description, techStack, liveUrl, githubUrl, featured, order, thumbnail } = req.body;
      const project = await prismaClient.project.update({
        where: { id: param(req, "id") },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(techStack !== undefined && { techStack }),
          ...(liveUrl !== undefined && { liveUrl: liveUrl || null }),
          ...(githubUrl !== undefined && { githubUrl: githubUrl || null }),
          ...(featured !== undefined && { featured }),
          ...(order !== undefined && { order }),
          ...(thumbnail !== undefined && { thumbnail: thumbnail || null }),
        },
      });
      await triggerFrontendRevalidation({ type: "project" });
      res.json(project);
    } catch (error) {
      console.error("Update project error:", error);
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.status(500).json({ error: "Failed to update project" });
    }
  });

  router.delete("/:id", authMiddleware, requireRoleWithClient(prismaClient, "admin", "editor"), async (req: AuthRequest, res) => {
    try {
      await prismaClient.project.delete({ where: { id: param(req, "id") } });
      await triggerFrontendRevalidation({ type: "project" });
      res.status(204).send();
    } catch (error) {
      console.error("Delete project error:", error);
      if (isPrismaErrorCode(error, "P2025")) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  return router;
}

export default createProjectsRouter();
