"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function PostViewCount({ path }: { path: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/analytics/page-views?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.count != null) setViews(data.count); })
      .catch(() => {});
  }, [path]);

  if (views === null) return null;

  return (
    <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
      {views} view{views !== 1 ? "s" : ""}
    </span>
  );
}
