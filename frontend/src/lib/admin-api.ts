"use client";

import { apiFetch } from "@/lib/auth";

type JsonRecord = Record<string, unknown>;

export class AdminApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.data = data;
  }
}

function defaultMessageForStatus(status: number) {
  switch (status) {
    case 400:
      return "Please check the form and try again.";
    case 401:
      return "Your session expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "This item was not found.";
    case 409:
      return "This item already exists.";
    default:
      return status >= 500
        ? "The server could not complete the request. Please try again."
        : `Request failed (${status}).`;
  }
}

async function parseResponseBody(res: Response) {
  const text = await res.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonRecord | JsonRecord[];
  } catch {
    return text;
  }
}

function extractErrorMessage(data: unknown, status: number) {
  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data && typeof data === "object") {
    const record = data as JsonRecord;
    const message = record.error ?? record.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return defaultMessageForStatus(status);
}

export function getAdminErrorMessage(error: unknown, fallback = "Request failed.") {
  if (error instanceof AdminApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    if (error.message === "Unauthorized") {
      return defaultMessageForStatus(401);
    }
    return error.message;
  }

  return fallback;
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export async function adminApiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  const data = await parseResponseBody(res);

  if (!res.ok) {
    throw new AdminApiError(res.status, extractErrorMessage(data, res.status), data);
  }

  return data as T;
}
