import { Router } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/db";
import { authMiddleware, requireRole, AuthRequest } from "../middleware/auth";
import { param, trimmedString } from "../utils/express";

const router = Router();

router.use(authMiddleware, requireRole("admin"));

// GET /api/admin/users — list all users
router.get("/", async (_req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    res.json({ users });
  } catch (err) {
    console.error("List users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/users — create new user
router.post("/", async (req: AuthRequest, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!trimmedString(name) || !trimmedString(email) || !trimmedString(password)) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    if (typeof password !== "string" || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const validRoles = ["admin", "editor", "author"];
    const userRole = validRoles.includes(role) ? role : "author";

    const existing = await prisma.user.findUnique({ where: { email: email.trim() } });
    if (existing) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name: trimmedString(name), email: trimmedString(email), password: hashed, role: userRole },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.status(201).json(user);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/admin/users/:id — update user (name, email, role)
router.put("/:id", async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    const { name, email, role } = req.body;

    const data: Record<string, string> = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof email === "string" && email.trim()) {
      if (!email.includes("@")) {
        res.status(400).json({ error: "Invalid email" });
        return;
      }
      const existing = await prisma.user.findFirst({ where: { email: email.trim(), NOT: { id } } });
      if (existing) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      data.email = email.trim();
    }
    if (typeof role === "string") {
      const validRoles = ["admin", "editor", "author"];
      if (!validRoles.includes(role)) {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      data.role = role;
    }

    // Prevent self-demotion (admin removing their own admin role)
    if (id === req.userId && data.role && data.role !== "admin") {
      res.status(400).json({ error: "You cannot remove your own admin role" });
      return;
    }

    // Prevent removing the last admin
    if (data.role && data.role !== "admin") {
      const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (targetUser?.role === "admin") {
        const adminCount = await prisma.user.count({ where: { role: "admin" } });
        if (adminCount <= 1) {
          res.status(400).json({ error: "At least one administrator must remain" });
          return;
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    res.json(user);
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id — delete user (requires replacement author)
router.delete("/:id", async (req: AuthRequest, res) => {
  try {
    const id = param(req, "id");
    const { replacementUserId } = req.body || {};

    if (id === req.userId) {
      res.status(400).json({ error: "You cannot delete your own account" });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent deleting the last admin
    if (targetUser.role === "admin") {
      const adminCount = await prisma.user.count({ where: { role: "admin" } });
      if (adminCount <= 1) {
        res.status(400).json({ error: "At least one administrator must remain" });
        return;
      }
    }

    // Check if user owns posts
    const postCount = await prisma.post.count({ where: { authorId: id } });

    if (postCount > 0) {
      if (!replacementUserId) {
        res.status(400).json({ error: "User owns posts. Provide a replacementUserId to reassign posts." });
        return;
      }

      if (replacementUserId === id) {
        res.status(400).json({ error: "Replacement user cannot be the user being deleted" });
        return;
      }

      const replacement = await prisma.user.findUnique({ where: { id: replacementUserId }, select: { id: true } });
      if (!replacement) {
        res.status(404).json({ error: "Replacement user not found" });
        return;
      }

      await prisma.$transaction([
        prisma.post.updateMany({ where: { authorId: id }, data: { authorId: replacementUserId } }),
        prisma.user.delete({ where: { id } }),
      ]);
    } else {
      await prisma.user.delete({ where: { id } });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
