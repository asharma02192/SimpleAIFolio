"use client";

import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function PageViewTracker({ slug }: { slug?: string }) {
  useEffect(() => {
    const body: Record<string, string> = {
      path: window.location.pathname,
      referrer: document.referrer,
    };
    if (slug) body.slug = slug;

    fetch(`${API_URL}/api/analytics/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [slug]);

  return null;
}
