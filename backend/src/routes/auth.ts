import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../utils/db";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { createRateLimiter } from "../middleware/rate-limit";
import { getRequestLogMeta, logError, logInfo, logWarn, sanitizeEmailForLog } from "../utils/logging";

type AuthPrisma = { user: any };

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie("admin_token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function createAuthRouter({ prismaClient = prisma }: { prismaClient?: AuthPrisma } = {}) {
  const router = Router();
  const loginRateLimit = createRateLimiter({
    keyPrefix: "auth-login",
    maxRequests: 30,
    windowMs: 15 * 60 * 1000,
    message: "Too many login attempts. Please try again later.",
  });
  const setupRateLimit = createRateLimiter({
    keyPrefix: "auth-setup",
    maxRequests: 5,
    windowMs: 15 * 60 * 1000,
    message: "Too many setup attempts. Please try again later.",
  });

  // POST /api/auth/login
  router.post("/login", loginRateLimit, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      logWarn("Login rejected: missing credentials", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(email),
      });
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    try {
      const user = await prismaClient.user.findUnique({ where: { email } });
      if (!user) {
        logWarn("Login rejected: unknown email", {
          ...getRequestLogMeta(req),
          email: sanitizeEmailForLog(email),
        });
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        logWarn("Login rejected: invalid password", {
          ...getRequestLogMeta(req),
          email: sanitizeEmailForLog(email),
        });
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }

      const token = signToken(user.id);
      setAuthCookie(res, token);
      logInfo("Login succeeded", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(email),
        userId: user.id,
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      logError("Login failed unexpectedly", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(email),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Login failed" });
    }
  });

  // POST /api/auth/setup - one-time admin account creation
  router.post("/setup", setupRateLimit, async (req, res) => {
    const installSecret = process.env.INSTALL_SECRET;
    const providedSecret = req.header("x-install-secret") || req.body?.installSecret;

    if (!installSecret) {
      logWarn("Setup attempt rejected: install secret not configured", getRequestLogMeta(req));
      res.status(503).json({ error: "Initial setup is disabled" });
      return;
    }

    if (providedSecret !== installSecret) {
      logWarn("Setup attempt rejected: invalid install secret", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(req.body?.email),
      });
      res.status(403).json({ error: "Invalid install secret" });
      return;
    }

    try {
      const userCount = await prismaClient.user.count();
      if (userCount > 0) {
        logWarn("Setup attempt rejected: admin already exists", {
          ...getRequestLogMeta(req),
          email: sanitizeEmailForLog(req.body?.email),
        });
        res.status(403).json({ error: "Admin account already exists" });
        return;
      }

      const { email, password, name } = req.body;
      if (!email || !password || !name) {
        logWarn("Setup rejected: missing required fields", {
          ...getRequestLogMeta(req),
          email: sanitizeEmailForLog(email),
        });
        res.status(400).json({ error: "All fields required" });
        return;
      }

      const hashed = await bcrypt.hash(password, 12);
      const user = await prismaClient.user.create({
        data: { email, password: hashed, name },
      });

      const token = signToken(user.id);
      setAuthCookie(res, token);
      logInfo("Setup succeeded", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(email),
        userId: user.id,
      });

      res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      logError("Setup failed unexpectedly", {
        ...getRequestLogMeta(req),
        email: sanitizeEmailForLog(req.body?.email),
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Initial setup failed" });
    }
  });

  router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await prismaClient.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true, name: true },
      });

      if (!user) {
        clearAuthCookie(res);
        logWarn("Session check failed: user not found", {
          ...getRequestLogMeta(req),
          userId: req.userId,
        });
        res.status(401).json({ error: "User not found" });
        return;
      }

      res.json({ user });
    } catch (error) {
      logError("Session check failed unexpectedly", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to verify session" });
    }
  });

  router.post("/logout", (req, res) => {
    clearAuthCookie(res);
    logInfo("Logout completed", getRequestLogMeta(req));
    res.status(204).send();
  });

  // PUT /api/auth/change-password — change admin password
  router.put("/change-password", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "Current password and new password are required" });
        return;
      }

      if (typeof newPassword !== "string" || newPassword.length < 8) {
        res.status(400).json({ error: "New password must be at least 8 characters" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: req.userId! } });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) {
        res.status(401).json({ error: "Current password is incorrect" });
        return;
      }

      const hashed = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.userId! },
        data: { password: hashed },
      });

      logInfo("Password changed successfully", { ...getRequestLogMeta(req), userId: req.userId });
      res.json({ success: true });
    } catch (error) {
      logError("Password change failed", {
        ...getRequestLogMeta(req),
        userId: req.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  return router;
}

export default createAuthRouter();
