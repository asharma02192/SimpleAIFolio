import { logError, logInfo } from "../utils/logging";

type RevalidateType = "post" | "settings" | "project" | "experience" | "taxonomy";

type RevalidatePayload = {
  type: RevalidateType;
  slug?: string | null;
  previousSlug?: string | null;
};

function getFrontendRevalidateUrl() {
  const base =
    process.env.FRONTEND_INTERNAL_URL?.trim()
    || process.env.FRONTEND_URL?.trim()
    || null;

  if (!base) {
    return null;
  }

  return `${base.replace(/\/$/, "")}/api/revalidate`;
}

function getRevalidateSecret() {
  return process.env.REVALIDATE_SECRET?.trim() || null;
}

export function isRevalidationConfigured() {
  return Boolean(getFrontendRevalidateUrl() && getRevalidateSecret());
}

export async function triggerFrontendRevalidation(payload: RevalidatePayload) {
  const url = getFrontendRevalidateUrl();
  const secret = getRevalidateSecret();

  if (!url || !secret) {
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      logError("Frontend revalidation failed", {
        type: payload.type,
        slug: payload.slug,
        previousSlug: payload.previousSlug,
        status: response.status,
        body: body.slice(0, 300),
      });
      return false;
    }

    logInfo("Frontend revalidation triggered", {
      type: payload.type,
      slug: payload.slug,
      previousSlug: payload.previousSlug,
    });
    return true;
  } catch (error) {
    logError("Frontend revalidation request failed", {
      type: payload.type,
      slug: payload.slug,
      previousSlug: payload.previousSlug,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
