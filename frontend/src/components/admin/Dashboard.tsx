"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";

interface DashboardData {
  totalViews: number;
  recentViews: number;
  topPages: { path: string; views: number }[];
  totalPosts: number;
  publishedPosts: number;
  totalProjects: number;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/analytics/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Could not load dashboard data. Make sure the backend is running.
        </p>
      </div>
    );
  }

  const metrics = [
    { label: "Total Posts", value: data.totalPosts, sub: `${data.publishedPosts} published` },
    { label: "Projects", value: data.totalProjects },
    { label: "Views (30d)", value: data.totalViews, sub: `${data.recentViews} in last 7d` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-[var(--space-8)]">
        <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
          Dashboard
        </h1>
        <Link
          href="/admin/posts/new"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-4)] py-[var(--space-2)] transition-opacity hover:opacity-90"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-on)",
            borderRadius: "var(--radius-md)",
          }}
        >
          New Post
        </Link>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-6)] mb-[var(--space-12)]">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-[var(--space-6)]"
            style={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
            }}
          >
            <p
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {m.label}
            </p>
            <p
              className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              {m.value}
            </p>
            {m.sub && (
              <p
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mt-[var(--space-1)]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {m.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Top pages */}
      {data.topPages.length > 0 && (
        <div>
          <h2
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Top Pages (30d)
          </h2>
          <div className="flex flex-col">
            {data.topPages.map((page) => (
              <div
                key={page.path}
                className="flex justify-between py-[var(--space-3)]"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>
                  {page.path}
                </span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                  {page.views} views
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
