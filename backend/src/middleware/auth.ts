import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getRequestLogMeta, logWarn } from "../utils/logging";

export interface AuthRequest extends Request {
  userId?: string;
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
