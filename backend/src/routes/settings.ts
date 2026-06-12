import { Router } from "express";
import prisma from "../utils/db";
import { isPrismaErrorCode, param, trimmedString } from "../utils/express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { triggerFrontendRevalidation } from "../services/revalidate";

const router = Router();

// GET /api/admin/ai-config — admin-only, returns AI config with masked API key
router.get("/admin/ai-config", authMiddleware, async (_req: AuthRequest, res) => {
  try {
    const keys = [
      "internal_ai_provider",
      "internal_ai_api_key",
      "internal_ai_base_url",
      "internal_ai_model",
      "internal_ai_temperature",
      "internal_ai_max_tokens",
    ];
    const rows = await prisma.siteSetting.findMany({ where: { key: { in: keys } } });
    const record: Record<string, string | null> = {};
    for (const row of rows) {
      record[row.key] = row.value;
    }

    const apiKey = record.internal_ai_api_key || process.env.AI_API_KEY?.trim() || "";
    const maskedKey = apiKey.length > 8
      ? apiKey.slice(0, 4) + "••••••••" + apiKey.slice(-4)
      : apiKey ? "••••••••" : "";

    res.json({
      provider: record.internal_ai_provider || process.env.AI_PROVIDER?.trim() || "openai-compatible",
      apiKeyMasked: maskedKey,
      apiKeySet: Boolean(apiKey),
      baseUrl: record.internal_ai_base_url || process.env.AI_BASE_URL?.trim() || "",
      model: record.internal_ai_model || process.env.AI_MODEL?.trim() || "",
      temperature: Number(record.internal_ai_temperature || process.env.AI_TEMPERATURE || "0.7"),
      maxTokens: Number(record.internal_ai_max_tokens || process.env.AI_MAX_TOKENS || "6000"),
    });
  } catch (err) {
    console.error("Get AI config error:", err);
    res.status(500).json({ error: "Failed to fetch AI config" });
  }
});

// PUT /api/admin/ai-config — admin-only, saves AI config with internal_ prefix
router.put("/admin/ai-config", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { provider, apiKey, baseUrl, model, temperature, maxTokens } = req.body as Record<string, unknown>;
    const operations = [];

    if (typeof provider === "string") {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_provider" },
          update: { value: provider },
          create: { key: "internal_ai_provider", value: provider },
        })
      );
    }

    if (typeof apiKey === "string" && apiKey.trim() && apiKey !== "••••••••") {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_api_key" },
          update: { value: apiKey.trim() },
          create: { key: "internal_ai_api_key", value: apiKey.trim() },
        })
      );
    }

    if (typeof baseUrl === "string") {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_base_url" },
          update: { value: baseUrl.trim().replace(/\/$/, "") },
          create: { key: "internal_ai_base_url", value: baseUrl.trim().replace(/\/$/, "") },
        })
      );
    }

    if (typeof model === "string") {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_model" },
          update: { value: model.trim() },
          create: { key: "internal_ai_model", value: model.trim() },
        })
      );
    }

    if (typeof temperature === "number" && Number.isFinite(temperature)) {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_temperature" },
          update: { value: String(Math.max(0, Math.min(2, temperature))) },
          create: { key: "internal_ai_temperature", value: String(Math.max(0, Math.min(2, temperature))) },
        })
      );
    }

    if (typeof maxTokens === "number" && Number.isFinite(maxTokens) && maxTokens > 0) {
      operations.push(
        prisma.siteSetting.upsert({
          where: { key: "internal_ai_max_tokens" },
          update: { value: String(Math.round(maxTokens)) },
          create: { key: "internal_ai_max_tokens", value: String(Math.round(maxTokens)) },
        })
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Update AI config error:", err);
    res.status(500).json({ error: "Failed to update AI config" });
  }
});

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
