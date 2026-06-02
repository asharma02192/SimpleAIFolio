import type { Request } from "express";

type LogMeta = Record<string, unknown>;

function trimValue(value: string | undefined, maxLength = 160) {
  if (!value) return undefined;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

export function getRequestLogMeta(req: Request): LogMeta {
  return {
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
    userAgent: trimValue(req.get("user-agent")),
  };
}

export function sanitizeEmailForLog(email: unknown) {
  if (typeof email !== "string") return undefined;
  return trimValue(email.trim().toLowerCase(), 120);
}

function write(level: "info" | "warn" | "error", message: string, meta?: LogMeta) {
  const logger = level === "info" ? console.info : level === "warn" ? console.warn : console.error;
  logger(message, meta || {});
}

export function logInfo(message: string, meta?: LogMeta) {
  write("info", message, meta);
}

export function logWarn(message: string, meta?: LogMeta) {
  write("warn", message, meta);
}

export function logError(message: string, meta?: LogMeta) {
  write("error", message, meta);
}
