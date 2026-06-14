import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

const router = Router();

const VALID_LOCATIONS = ["head", "body_end"];

router.get("/snippets", async (_req, res) => {
  try {
    const snippets = await prisma.scriptSnippet.findMany({
      where: { enabled: true },
      orderBy: { order: "asc" },
      select: { id: true, name: true, location: true, code: true, order: true },
    });
    res.json(snippets);
  } catch (err) {
    console.error("Get snippets error:", err);
    res.status(500).json({ error: "Failed to fetch snippets" });
  }
});

router.get("/admin/snippets", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const snippets = await prisma.scriptSnippet.findMany({
      orderBy: { order: "asc" },
    });
    res.json(snippets);
  } catch (err) {
    console.error("Get admin snippets error:", err);
    res.status(500).json({ error: "Failed to fetch snippets" });
  }
});

router.post("/admin/snippets", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, location, code, enabled, order } = req.body;
    if (!trimmedString(name)) {
      res.status(400).json({ error: "Name is required" });
      return;
    }
    if (!trimmedString(code)) {
      res.status(400).json({ error: "Code is required" });
      return;
    }
    const loc = trimmedString(location) || "head";
    if (!VALID_LOCATIONS.includes(loc)) {
      res.status(400).json({ error: "Invalid location. Use 'head' or 'body_end'" });
      return;
    }
    const snippet = await prisma.scriptSnippet.create({
      data: {
        name: trimmedString(name),
        location: loc,
        code: trimmedString(code),
        enabled: enabled !== false,
        order: typeof order === "number" ? order : 0,
      },
    });
    await triggerFrontendRevalidation({ type: "settings" });
    res.status(201).json(snippet);
  } catch (err) {
    console.error("Create snippet error:", err);
    res.status(500).json({ error: "Failed to create snippet" });
  }
});

router.put("/admin/snippets/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, location, code, enabled, order } = req.body;
    const loc = trimmedString(location);
    if (loc && !VALID_LOCATIONS.includes(loc)) {
      res.status(400).json({ error: "Invalid location. Use 'head' or 'body_end'" });
      return;
    }
    const snippet = await prisma.scriptSnippet.update({
      where: { id: param(req, "id") },
      data: {
        ...(name !== undefined && { name: trimmedString(name) }),
        ...(location !== undefined && { location: trimmedString(location) }),
        ...(code !== undefined && { code }),
        ...(enabled !== undefined && { enabled: Boolean(enabled) }),
        ...(order !== undefined && { order }),
      },
    });
    await triggerFrontendRevalidation({ type: "settings" });
    res.json(snippet);
  } catch (err) {
    console.error("Update snippet error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }
    res.status(500).json({ error: "Failed to update snippet" });
  }
});

router.delete("/admin/snippets/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    await prisma.scriptSnippet.delete({ where: { id: param(req, "id") } });
    await triggerFrontendRevalidation({ type: "settings" });
    res.status(204).send();
  } catch (err) {
    console.error("Delete snippet error:", err);
    if (isPrismaErrorCode(err, "P2025")) {
      res.status(404).json({ error: "Snippet not found" });
      return;
    }
    res.status(500).json({ error: "Failed to delete snippet" });
  }
});

export default router;
