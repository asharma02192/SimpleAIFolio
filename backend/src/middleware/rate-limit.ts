import type { Request, Response, NextFunction } from "express";
import prisma from "../utils/db";
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

interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<Bucket>;
}

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

class MemoryRateLimitStore implements RateLimitStore {
  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      const next = {
        count: 1,
        resetAt: now + windowMs,
      };
      buckets.set(key, next);
      return next;
    }

    current.count += 1;
    return current;
  }
}

class DatabaseRateLimitStore implements RateLimitStore {
  private fallbackWarned = false;
  private readonly fallback = new MemoryRateLimitStore();

  async increment(key: string, windowMs: number) {
    const resetAtMs = Date.now() + windowMs;

    try {
      const rows = await prisma.$queryRawUnsafe<Array<{ count: number; resetAtMs: number }>>(
        `
          INSERT INTO "rate_limit_buckets" ("key", "count", "resetAt", "createdAt", "updatedAt")
          VALUES ($1, 1, to_timestamp($2 / 1000.0), NOW(), NOW())
          ON CONFLICT ("key")
          DO UPDATE SET
            "count" = CASE
              WHEN "rate_limit_buckets"."resetAt" <= NOW() THEN 1
              ELSE "rate_limit_buckets"."count" + 1
            END,
            "resetAt" = CASE
              WHEN "rate_limit_buckets"."resetAt" <= NOW() THEN to_timestamp($2 / 1000.0)
              ELSE "rate_limit_buckets"."resetAt"
            END,
            "updatedAt" = NOW()
          RETURNING "count", FLOOR(EXTRACT(EPOCH FROM "resetAt") * 1000)::bigint AS "resetAtMs"
        `,
        key,
        resetAtMs,
      );

      const row = rows[0];
      return {
        count: Number(row?.count ?? 1),
        resetAt: Number(row?.resetAtMs ?? resetAtMs),
      };
    } catch (error) {
      if (!this.fallbackWarned) {
        this.fallbackWarned = true;
        logWarn("Database rate limit store unavailable; falling back to memory store", {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      return this.fallback.increment(key, windowMs);
    }
  }
}

const defaultMemoryStore = new MemoryRateLimitStore();
const defaultDatabaseStore = new DatabaseRateLimitStore();

function getDefaultRateLimitStore(): RateLimitStore {
  if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL || process.env.RATE_LIMIT_STORE === "memory") {
    return defaultMemoryStore;
  }

  return defaultDatabaseStore;
}

export function createRateLimiter(options: RateLimitOptions, store: RateLimitStore = getDefaultRateLimitStore()) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await store.increment(`${options.keyPrefix}:${getClientKey(req)}`, options.windowMs);

      if (current.count > options.maxRequests) {
        const retryAfter = Math.max(1, Math.ceil((current.resetAt - Date.now()) / 1000));
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
    } catch (error) {
      logWarn("Rate limiter failed open", {
        ...getRequestLogMeta(req),
        limiter: options.keyPrefix,
        reason: error instanceof Error ? error.message : String(error),
      });
      next();
    }
  };
}
