import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

const router = Router();

// GET /api/settings — public, returns all settings as flat object
router.get("/settings", async (_req, res) => {
  try {
    const rows = await prisma.siteSetting.findMany();
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.key.startsWith("internal_")) {
        continue;
      }
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    res.json(settings);
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// PUT /api/settings — admin, bulk update
router.put("/settings", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const updates = Object.fromEntries(
      Object.entries(req.body as Record<string, unknown>).filter(([key]) => !key.startsWith("internal_"))
    );
    const operations = Object.entries(updates).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        update: { value: typeof value === "string" ? value : JSON.stringify(value) },
        create: { key, value: typeof value === "string" ? value : JSON.stringify(value) },
      })
    );
    await prisma.$transaction(operations);
    await triggerFrontendRevalidation({ type: "settings" });
    res.json({ success: true });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

// GET /api/experience — public, ordered entries
router.get("/experience", async (_req, res) => {
  try {
    const experiences = await prisma.experience.findMany({
      orderBy: { order: "asc" },
    });
    res.json(experiences);
  } catch (err) {
    console.error("Get experience error:", err);
    res.status(500).json({ error: "Failed to fetch experience" });
  }
});

// POST /api/experience — admin, create
router.post("/experience", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { role, period, description, order } = req.body;
    if (!trimmedString(role)) {
      res.status(400).json({ error: "Role is required" });
      return;
    }
    const exp = await prisma.experience.create({
      data: {
        role: trimmedString(role),
        period: trimmedString(period),
        description: trimmedString(description),
        order: order || 0,
      },
    });
    await triggerFrontendRevalidation({ type: "experience" });
    res.status(201).json(exp);
  } catch (err) {
    console.error("Create experience error:", err);
    res.status(500).json({ error: "Failed to create experience" });
  }
});

// PUT /api/experience/:id — admin, update
router.put("/experience/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { role, period, description, order } = req.body;
    const exp = await prisma.experience.update({
      where: { id: param(req, "id") },
      data: {
        ...(role !== undefined && { role }),
        ...(period !== undefined && { period }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order }),
      },
    });
    await triggerFrontendRevalidation({ type: "experience" });
    res.json(exp);
  } catch (err) {
    console.error("Update experience error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Experience entry not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update experience" });
  }
});

// DELETE /api/experience/:id — admin, delete
router.delete("/experience/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.experience.delete({ where: { id: param(req, "id") } });
    await triggerFrontendRevalidation({ type: "experience" });
    res.status(204).send();
  } catch (err) {
    console.error("Delete experience error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Experience entry not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete experience" });
  }
});

export default router;
