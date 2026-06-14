import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { param, trimmedString } from "../utils/express";
import { createRateLimiter } from "../middleware/rate-limit";

const router = Router();

const subscribeLimiter = createRateLimiter({
  keyPrefix: "newsletter:subscribe",
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  message: "Too many subscribe attempts, please try again later",
});

router.post("/newsletter/subscribe", subscribeLimiter, async (req, res) => {
  try {
    const email = trimmedString(req.body.email);
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    const subscriber = await prisma.newsletterSubscriber.upsert({
      where: { email },
      update: { active: true },
      create: { email },
    });

    res.json({ subscribed: true, id: subscriber.id });
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

router.post("/newsletter/unsubscribe", async (req, res) => {
  try {
    const email = trimmedString(req.body.email);
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (!subscriber) {
      res.json({ unsubscribed: true });
      return;
    }

    await prisma.newsletterSubscriber.update({
      where: { email },
      data: { active: false },
    });

    res.json({ unsubscribed: true });
  } catch (err) {
    console.error("Newsletter unsubscribe error:", err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

router.get("/admin/newsletter", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(subscribers);
  } catch (err) {
    console.error("List newsletter subscribers error:", err);
    res.status(500).json({ error: "Failed to fetch subscribers" });
  }
});

router.delete("/admin/newsletter/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    await prisma.newsletterSubscriber.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete newsletter subscriber error:", err);
    res.status(500).json({ error: "Failed to delete subscriber" });
  }
});

export default router;
