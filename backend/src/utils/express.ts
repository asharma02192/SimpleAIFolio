import { Request } from "express";

/** Safely get a string param from Express 5 req.params (string | string[]) */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  return typeof val === "string" ? val : Array.isArray(val) ? val[0] : "";
}

export function trimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
