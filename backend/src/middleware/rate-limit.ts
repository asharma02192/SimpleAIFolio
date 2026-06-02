import type { Request, Response, NextFunction } from "express";
import { getRequestLogMeta, logWarn } from "../utils/logging";

interface RateLimitOptions {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${options.keyPrefix}:${getClientKey(req)}`;
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    current.count += 1;
    if (current.count > options.maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", retryAfter.toString());
      logWarn("Rate limit exceeded", {
        ...getRequestLogMeta(req),
        limiter: options.keyPrefix,
        retryAfter,
      });
      res.status(429).json({ error: options.message });
      return;
    }

    next();
  };
}
