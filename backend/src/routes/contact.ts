import { Router } from "express";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest, requireRole } from "../middleware/auth";
import { trimmedString } from "../utils/express";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!trimmedString(name) || !trimmedString(email) || !trimmedString(message)) {
      res.status(400).json({ error: "Name, email, and message are required" });
      return;
    }
    const msg = await prisma.contactMessage.create({
      data: {
        name: trimmedString(name),
        email: trimmedString(email),
        subject: trimmedString(subject) || null,
        message: trimmedString(message),
      },
    });
    res.status(201).json({ success: true, id: msg.id });
  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.get("/admin/contact", authMiddleware, requireRole("admin", "editor"), async (_req: AuthRequest, res) => {
  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(messages);
  } catch (err) {
    console.error("Get contact messages error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.put("/admin/contact/:id/read", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
  try {
    const id = (req.params as Record<string, string>).id;
    const msg = await prisma.contactMessage.update({
      where: { id },
      data: { read: true },
    });
    res.json(msg);
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to update message" });
  }
});

router.delete("/admin/contact/:id", authMiddleware, requireRole("admin", "editor"), async (req: AuthRequest, res) => {
  try {
    const id = (req.params as Record<string, string>).id;
    await prisma.contactMessage.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("Delete contact message error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
