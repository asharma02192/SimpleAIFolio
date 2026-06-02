import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/projects — public
router.get("/", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: [{ featured: "desc" }, { order: "asc" }],
    });
    res.json(projects);
  } catch (err) {
    console.error("Get projects error:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects — admin
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { techStack, liveUrl, githubUrl, featured, order, thumbnail } = req.body;
    const title = trimmedString(req.body.title);
    const description = trimmedString(req.body.description);
    if (!title || !description) {
      res.status(400).json({ error: "Title and description are required" });
      return;
    }
    const project = await prisma.project.create({
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
    res.status(201).json(project);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// PUT /api/projects/:id — admin
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { title, description, techStack, liveUrl, githubUrl, featured, order, thumbnail } = req.body;
    const project = await prisma.project.update({
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
    res.json(project);
  } catch (err) {
    console.error("Update project error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id — admin
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.project.delete({ where: { id: param(req, "id") } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete project error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
