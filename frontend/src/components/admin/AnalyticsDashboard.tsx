"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";
import type { AnalyticsDashboardData } from "@/types";

function formatWindowLabel(days: number) {
  return `${days}d`;
}

type WindowDays = 7 | 30 | 90;

const surfaceStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(15, 23, 42, 0.04)",
};

const insetSurfaceStyle = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "posts", label: "Posts" },
  { id: "traffic", label: "Traffic" },
  { id: "referrers", label: "Referrers" },
] as const;

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [activeTab, setActiveTab] = useState<string>("overview");

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const response = await apiFetch(`/api/analytics/dashboard?windowDays=${windowDays}`);
        const payload = (await response.json()) as AnalyticsDashboardData;
        if (active) setData(payload);
      } catch (error) {
        console.error(error);
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => { active = false; };
  }, [windowDays]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[calc(var(--radius-lg)+2px)]" style={surfaceStyle}>
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
          Loading analytics…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Could not load analytics data. Make sure the backend is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-8)]">
      {/* Page Header */}
      <section className="rounded-[calc(var(--radius-lg)+4px)] p-[var(--space-6)] lg:p-[var(--space-7)]" style={surfaceStyle}>
        <div className="grid gap-[var(--space-6)] xl:grid-cols-[minmax(0,1.35fr),minmax(18rem,0.65fr)]">
          <div>
            <p
              className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.24em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Analytics
            </p>
            <h1
              className="mt-[var(--space-3)] max-w-[24ch] font-[family-name:var(--font-display)] text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-[1.05]"
              style={{ color: "var(--color-text)" }}
            >
              Traffic and content performance
            </h1>
            <p
              className="mt-[var(--space-4)] max-w-[72ch] text-[var(--text-sm)] leading-relaxed"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Track page views, top content, and visitor trends across your site.
            </p>
          </div>
          <div className="grid gap-[var(--space-4)] self-start">
            <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={{
              background: "color-mix(in oklch, var(--color-bg) 90%, var(--color-accent-lightest) 10%)",
              border: "1px solid color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)",
            }}>
              <p
                className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Date Range
              </p>
              <div className="mt-[var(--space-3)]">
                <select
                  value={windowDays}
                  onChange={(e) => { setLoading(true); setWindowDays(Number(e.target.value) as WindowDays); }}
                  className="min-h-[42px] w-full rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none"
                  style={insetSurfaceStyle}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Bar */}
      <div className="-mb-[1px] overflow-x-auto rounded-[calc(var(--radius-lg)+2px)]" style={{ ...surfaceStyle, WebkitOverflowScrolling: "touch" }}>
        <div className="flex flex-nowrap gap-0 border-b" style={{ borderColor: "var(--color-border)" }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="whitespace-nowrap px-[var(--space-5)] py-[var(--space-4)] text-[var(--text-sm)] font-medium transition-colors"
              style={{
                color: activeTab === tab.id ? "var(--color-text)" : "var(--color-text-tertiary)",
                borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-[var(--space-8)]">
          <div className="grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-2 2xl:grid-cols-4">
            {[
              { label: "Total Views", value: data.totalViews.toLocaleString(), sub: `${data.recentViews} in last 7 days` },
              { label: "Total Posts", value: data.totalPosts.toLocaleString(), sub: `${data.publishedPosts} published` },
              { label: "Top Page", value: data.topPages[0]?.path || "—", sub: data.topPages[0] ? `${data.topPages[0].views} views` : "No data yet" },
              { label: "Projects", value: data.totalProjects.toLocaleString(), sub: "Public project inventory" },
            ].map((m) => (
              <div key={m.label} className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-5)]" style={insetSurfaceStyle}>
                <p
                  className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  {m.label}
                </p>
                <p
                  className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[clamp(1.2rem,1.8vw,1.8rem)] font-semibold leading-none truncate"
                  style={{ color: "var(--color-text)" }}
                >
                  {m.value}
                </p>
                <p className="mt-[var(--space-2)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                  {m.sub}
                </p>
              </div>
            ))}
          </div>
          {/* Top pages in overview */}
          <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
              Top Pages ({formatWindowLabel(windowDays)})
            </h2>
            <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
              Public routes with the strongest view count.
            </p>
            {data.topPages.length ? (
              <div className="mt-[var(--space-5)] space-y-[var(--space-3)]">
                {data.topPages.map((p, i) => (
                  <div
                    key={p.path}
                    className="flex items-center justify-between gap-[var(--space-4)] rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]"
                    style={insetSurfaceStyle}
                  >
                    <div className="flex min-w-0 items-center gap-[var(--space-3)]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-xs)] font-semibold" style={{ background: i === 0 ? "var(--color-accent)" : "var(--color-bg-elevated)", color: i === 0 ? "var(--color-accent-on)" : "var(--color-text-tertiary)" }}>
                        {i + 1}
                      </span>
                      <Link href={p.path} className="truncate hover:underline" style={{ color: "var(--color-accent)" }}>{p.path}</Link>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>{p.views.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-[var(--space-5)]" style={{ color: "var(--color-text-tertiary)" }}>No page view data yet.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "posts" && (
        <div className="space-y-[var(--space-8)]">
          <div className="grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-3">
            {[
              { label: "Total Posts", value: data.totalPosts.toLocaleString() },
              { label: "Published", value: data.publishedPosts.toLocaleString() },
              { label: "Drafts", value: (data.totalPosts - data.publishedPosts).toLocaleString() },
            ].map((m) => (
              <div key={m.label} className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-5)]" style={insetSurfaceStyle}>
                <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]" style={{ color: "var(--color-text-tertiary)" }}>{m.label}</p>
                <p className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[1.5rem] font-semibold leading-none" style={{ color: "var(--color-text)" }}>{m.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
              Post Performance
            </h2>
            <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
              View counts by published post. More detailed per-post analytics coming soon.
            </p>
            <div className="mt-[var(--space-5)] rounded-[calc(var(--radius-md)+2px)] p-[var(--space-8)]" style={insetSurfaceStyle}>
              <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-4)]">
                <span className="text-3xl">📊</span>
                <p className="max-w-[36ch] text-center text-[var(--text-sm)] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Per-post analytics will appear here as your site collects more traffic data.
                </p>
                <Link
                  href="/admin/posts"
                  className="mt-[var(--space-2)] inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-xs)] font-medium"
                  style={insetSurfaceStyle}
                >
                  Manage Posts →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "traffic" && (
        <div className="space-y-[var(--space-8)]">
          <div className="grid grid-cols-1 gap-[var(--space-5)] md:grid-cols-2">
            {[
              { label: `Views (${formatWindowLabel(windowDays)})`, value: data.totalViews.toLocaleString() },
              { label: "Recent (7d)", value: data.recentViews.toLocaleString() },
            ].map((m) => (
              <div key={m.label} className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-5)]" style={insetSurfaceStyle}>
                <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]" style={{ color: "var(--color-text-tertiary)" }}>{m.label}</p>
                <p className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[1.5rem] font-semibold leading-none" style={{ color: "var(--color-text)" }}>{m.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
              Daily Trends
            </h2>
            <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
              Page views by day. Charts will be added as more data is collected.
            </p>
            <div className="mt-[var(--space-5)] rounded-[calc(var(--radius-md)+2px)] p-[var(--space-8)]" style={insetSurfaceStyle}>
              <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-4)]">
                <span className="text-3xl">📈</span>
                <p className="max-w-[36ch] text-center text-[var(--text-sm)] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                  Daily traffic charts will appear as your site collects more visitor data.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "referrers" && (
        <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
          <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
            Referrer Sources
          </h2>
          <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
            Where your visitors come from. Referrer tracking will be enabled as traffic grows.
          </p>
          <div className="mt-[var(--space-5)] rounded-[calc(var(--radius-md)+2px)] p-[var(--space-8)]" style={insetSurfaceStyle}>
            <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-4)]">
              <span className="text-3xl">🔗</span>
              <p className="max-w-[36ch] text-center text-[var(--text-sm)] font-medium" style={{ color: "var(--color-text-secondary)" }}>
                Referrer data will appear here once your site starts receiving traffic from external sources.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
