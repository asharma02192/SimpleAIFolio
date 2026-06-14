import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../utils/db";
import { getRequestLogMeta, logWarn } from "../utils/logging";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  userName?: string;
}

function readCookieToken(req: Request) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "admin_token") {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function getAuthToken(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }

  return readCookieToken(req);
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = getAuthToken(req);
  if (!token) {
    logWarn("Authentication failed: no token provided", getRequestLogMeta(req));
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const decoded = verifyAuthToken(token);
    req.userId = decoded.userId;
    next();
  } catch {
    logWarn("Authentication failed: invalid token", getRequestLogMeta(req));
    res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true, name: true },
      });

      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      req.userRole = user.role;
      req.userName = user.name;

      if (!roles.includes(user.role)) {
        logWarn("Authorization failed: insufficient role", {
          ...getRequestLogMeta(req),
          userId: req.userId,
          userRole: user.role,
          required: roles,
        });
        res.status(403).json({ error: "Insufficient permissions" });
        return;
      }

      next();
    } catch {
      res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}

export function requireOwnershipOrRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true, name: true },
      });

      if (!user) {
        res.status(401).json({ error: "User not found" });
        return;
      }

      req.userRole = user.role;
      req.userName = user.name;

      if (roles.includes(user.role)) {
        next();
        return;
      }

      const resourceId = (req.params as Record<string, string>).id;
      if (resourceId) {
        const post = await prisma.post.findUnique({
          where: { id: resourceId },
          select: { authorId: true },
        });
        if (post && post.authorId === req.userId) {
          next();
          return;
        }
      }

      res.status(403).json({ error: "Insufficient permissions" });
    } catch {
      res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}
