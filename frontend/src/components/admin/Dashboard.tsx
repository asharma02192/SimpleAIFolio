"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";
import type { AiAlertSettings, AnalyticsDashboardData } from "@/types";

/* ── helpers ── */

function fmtCost(value: number) {
  return value < 0.01 && value > 0 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function fmtWindow(days: number) {
  return `${days}d`;
}

function fmtDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  } catch { return value; }
}

function fmtShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
  } catch { return value; }
}

function fmtCooldown(value: number) {
  return Math.max(0, Math.round(value / 60000));
}

type WindowDays = 7 | 30 | 90;
type TabId = "overview" | "ai-ops" | "alerts" | "details";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "ai-ops", label: "AI Ops" },
  { id: "alerts", label: "Alerts" },
  { id: "details", label: "Details" },
];

/* ── shared surfaces ── */

const surface = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 0 rgba(15, 23, 42, 0.04)",
} as const;

const inset = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
} as const;

/* ── section label ── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {children}
    </p>
  );
}

/* ── metric tile ── */

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <span
        className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.16em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </span>
      <span
        className="font-[family-name:var(--font-display)] text-[1.25rem] font-semibold leading-none tabular-nums"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[var(--text-xs)] leading-none" style={{ color: "var(--color-text-tertiary)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

/* ── alert badge ── */

function AlertBadge({ level }: { level: "info" | "warning" | "critical" }) {
  const bg = level === "critical" ? "var(--color-error)" : level === "warning" ? "var(--color-warning)" : "var(--color-accent)";
  return (
    <span
      className="inline-flex h-[18px] items-center rounded-[var(--radius-sm)] px-[6px] text-[0.6rem] font-semibold uppercase tracking-[0.08em]"
      style={{ background: bg, color: "var(--color-bg-elevated)" }}
    >
      {level}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [alertSettings, setAlertSettings] = useState<AiAlertSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);
  const [alertNotice, setAlertNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [dashRes, alertRes] = await Promise.all([
          apiFetch(`/api/analytics/dashboard?windowDays=${windowDays}`),
          apiFetch("/api/analytics/alert-settings"),
        ]);
        const [payload, settings] = (await Promise.all([dashRes.json(), alertRes.json()])) as [AnalyticsDashboardData, AiAlertSettings];
        if (active) { setData(payload); setAlertSettings(settings); }
      } catch (err) {
        console.error(err);
        if (active) { setData(null); setAlertSettings(null); }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [windowDays]);

  async function saveAlertSettings() {
    if (!alertSettings) return;
    setSavingAlerts(true);
    setAlertNotice(null);
    try {
      const res = await apiFetch("/api/analytics/alert-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(alertSettings),
      });
      const payload = (await res.json()) as AiAlertSettings;
      setAlertSettings(payload);
      setAlertNotice({ type: "success", message: payload.webhookEnabled || payload.telegramEnabled ? "Notification settings saved. Enabled channels can now receive alerts." : "Notification settings saved. All channels are off." });
    } catch { setAlertNotice({ type: "error", message: "Could not save settings." }); }
    finally { setSavingAlerts(false); }
  }

  async function sendTestAlert() {
    setSendingTestAlert(true);
    setAlertNotice(null);
    try {
      const res = await apiFetch("/api/analytics/alert-settings/test", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed");
      setAlertNotice({ type: "success", message: "Test alert sent. Check enabled destinations." });
    } catch { setAlertNotice({ type: "error", message: "Failed to send test alert." }); }
    finally { setSendingTestAlert(false); }
  }

  /* ── loading ── */
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[var(--radius-lg)]" style={surface}>
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
          Loading dashboard…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
        <p style={{ color: "var(--color-text-secondary)" }}>Could not load dashboard data. Make sure the backend is running.</p>
      </div>
    );
  }

  const ai = data.aiOps;

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* ──────────────── HEADER ──────────────── */}
      <div
        className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)] lg:flex-row lg:items-center lg:justify-between lg:gap-0"
        style={surface}
      >
        <div>
          <Label>Dashboard</Label>
          <h1
            className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[1.5rem] font-semibold leading-tight lg:text-[1.75rem]"
            style={{ color: "var(--color-text)" }}
          >
            Content &amp; AI Operations
          </h1>
        </div>

        <div className="flex items-center gap-[var(--space-3)] flex-wrap">
          <select
            value={windowDays}
            onChange={(e) => { setLoading(true); setWindowDays(Number(e.target.value) as WindowDays); }}
            className="min-h-[36px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1)] text-[var(--text-sm)] outline-none"
            style={inset}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Link
            href="/admin/posts/new"
            className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[0.65rem] uppercase tracking-[0.14em] transition-opacity hover:opacity-90"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
          >
            New Post
          </Link>
          <Link
            href="/admin/ai-writer"
            className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] font-medium transition-opacity hover:opacity-90"
            style={inset}
          >
            AI Writer
          </Link>
        </div>
      </div>

      {/* ──────────────── STATS STRIP ──────────────── */}
      <div
        className="grid grid-cols-2 gap-x-[var(--space-6)] gap-y-[var(--space-5)] rounded-[var(--radius-lg)] p-[var(--space-6)] md:grid-cols-3 lg:grid-cols-6"
        style={surface}
      >
        <Metric label="Posts" value={data.publishedPosts.toLocaleString()} sub={`${data.totalPosts} total`} />
        <Metric label="Projects" value={data.totalProjects.toLocaleString()} />
        <Metric label={`Views (${fmtWindow(ai.windowDays)})`} value={data.totalViews.toLocaleString()} sub={`${data.recentViews} in last 7d`} />
        <Metric label="AI Calls" value={ai.totalCalls.toLocaleString()} sub={`${ai.failures} failures`} />
        <Metric label="Est. Cost" value={fmtCost(ai.estimatedCostUsd)} sub={`${ai.totalTokens.toLocaleString()} tokens`} />
        <Metric label="Avg Latency" value={`${ai.avgLatencyMs}ms`} sub={`${ai.totalConversations} conversations`} />
      </div>

      {/* ──────────────── TAB BAR ──────────────── */}
      <div
        className="flex gap-[2px] rounded-[var(--radius-lg)] p-[var(--space-1)]"
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          boxShadow: surface.boxShadow,
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="min-w-0 flex-1 cursor-pointer whitespace-nowrap rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2.5)] text-[var(--text-sm)] font-semibold transition-all duration-200"
              style={{
                color: active ? "var(--color-bg-elevated)" : "var(--color-text-secondary)",
                background: active ? "var(--color-accent)" : "transparent",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════ TAB: OVERVIEW ══════════════ */}
      {activeTab === "overview" && (
        <div className="grid gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          {/* Top Pages */}
          <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
            <div>
              <Label>Top Pages</Label>
              <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                Most visited routes
              </h2>
            </div>
            {data.topPages.length === 0 ? (
              <p className="py-[var(--space-4)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No page views yet.</p>
            ) : (
              <ol className="flex flex-col gap-[var(--space-2)]">
                {data.topPages.map((p, i) => {
                  const maxViews = data.topPages[0]?.views ?? 1;
                  const barWidth = Math.max(4, (p.views / maxViews) * 100);
                  return (
                    <li key={p.path} className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]" style={inset}>
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-xs)] font-semibold"
                        style={{ background: i === 0 ? "var(--color-accent)" : "var(--color-bg-muted)", color: i === 0 ? "var(--color-accent-on)" : "var(--color-text-tertiary)" }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <Link href={p.path} className="truncate font-medium hover:underline" style={{ color: "var(--color-accent)" }}>{p.path}</Link>
                        <div className="h-[3px] rounded-full" style={{ width: `${barWidth}%`, background: i === 0 ? "var(--color-accent)" : "var(--color-border-strong)", maxWidth: "100%" }} />
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>{p.views.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Daily Usage */}
          <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
            <div>
              <Label>Daily Usage</Label>
              <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                AI calls per day
              </h2>
            </div>
            {ai.dailyUsage.length === 0 ? (
              <p className="py-[var(--space-4)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No usage in this period.</p>
            ) : (
              <div className="space-y-[var(--space-2)]">
                {ai.dailyUsage.map((entry) => {
                  const failPct = entry.calls ? Math.round((entry.failures / entry.calls) * 100) : 0;
                  return (
                    <div
                      key={entry.date}
                      className="flex items-center gap-[var(--space-4)] rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]"
                      style={inset}
                    >
                      <span className="w-16 shrink-0 font-medium" style={{ color: "var(--color-text)" }}>{fmtShortDate(entry.date)}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <span className="text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>{entry.calls} calls</span>
                          {entry.failures > 0 && <span className="text-[var(--text-xs)] font-medium" style={{ color: "var(--color-error)" }}>{entry.failures} failed</span>}
                        </div>
                        <div className="h-[3px] rounded-full" style={{
                          width: `${Math.max(4, (entry.calls / Math.max(...ai.dailyUsage.map((d) => d.calls), 1)) * 100)}%`,
                          background: entry.failures > 0 ? "var(--color-error)" : "var(--color-accent)",
                          opacity: entry.failures > 0 ? 0.8 : 0.6,
                          maxWidth: "100%",
                        }} />
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>{fmtCost(entry.estimatedCostUsd)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════ TAB: AI OPS ══════════════ */}
      {activeTab === "ai-ops" && (
        <div className="flex flex-col gap-[var(--space-6)]">
          {/* AI health summary */}
          <div
            className="flex items-center gap-[var(--space-5)] rounded-[var(--radius-lg)] p-[var(--space-5)]"
            style={{
              background: ai.successRate >= 95 ? "oklch(96% 0.02 145)" : ai.successRate >= 80 ? "oklch(96% 0.03 85)" : "oklch(96% 0.03 25)",
              border: `1px solid ${ai.successRate >= 95 ? "oklch(88% 0.08 145)" : ai.successRate >= 80 ? "oklch(88% 0.08 85)" : "oklch(88% 0.08 25)"}`,
            }}
          >
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{
                background: ai.successRate >= 95 ? "var(--color-success)" : ai.successRate >= 80 ? "var(--color-warning)" : "var(--color-error)",
                color: "white",
                boxShadow: `0 0 0 3px ${ai.successRate >= 95 ? "oklch(90% 0.06 145)" : ai.successRate >= 80 ? "oklch(90% 0.06 85)" : "oklch(90% 0.06 25)"}`,
              }}
            >
              {ai.successRate}%
            </div>
            <div className="flex flex-col gap-[var(--space-1)]">
              <span className="text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>
                {ai.successRate >= 95 ? "All systems healthy" : ai.successRate >= 80 ? "Degraded performance" : "Service issues detected"}
              </span>
              <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
                {fmtCost(ai.estimatedCostUsd)} est. cost · {fmtCost(ai.previousPeriodCostUsd)} prior period · {ai.avgLatencyMs}ms avg latency
              </span>
            </div>
          </div>

          {/* Alerts & Failures */}
          <div className="grid gap-[var(--space-6)] lg:grid-cols-2">
            <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
              <div>
                <Label>Alerts</Label>
                <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                  Active alerts
                </h2>
              </div>
              {ai.alerts.length === 0 ? (
                <div className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ background: "oklch(96% 0.01 145 / 0.5)" }}>
                  <span style={{ color: "var(--color-success)" }}>✓</span>
                  <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>No alerts in this window.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-[var(--space-2)]">
                  {ai.alerts.map((a) => (
                    <div key={a.code} className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)] text-[var(--text-sm)]" style={inset}>
                      <AlertBadge level={a.level} />
                      <div className="flex flex-col gap-[2px]">
                        <span className="font-medium" style={{ color: "var(--color-text)" }}>{a.title}</span>
                        <span style={{ color: "var(--color-text-secondary)" }}>{a.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
              <div>
                <Label>Recent Failures</Label>
                <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                  Error log
                </h2>
              </div>
              {ai.recentFailures.length === 0 ? (
                <div className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ background: "oklch(96% 0.02 145)" }}>
                  <span className="text-[var(--text-sm)] font-medium" style={{ color: "var(--color-success)" }}>✓</span>
                  <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>No failures in the last {windowDays} days.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-[var(--space-2)]">
                  {ai.recentFailures.slice(0, 5).map((f) => (
                    <div key={f.id} className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] p-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(96% 0.02 25 / 0.5)", border: "1px solid oklch(80% 0.04 25)" }}>
                      <div className="flex items-center justify-between gap-[var(--space-2)]">
                        <span className="font-medium truncate" style={{ color: "var(--color-text)" }}>{f.operation}</span>
                        <span className="shrink-0 text-[var(--text-xs)] tabular-nums" style={{ color: "var(--color-text-tertiary)" }}>{f.provider}</span>
                      </div>
                      <p className="text-[var(--text-xs)] truncate" style={{ color: "var(--color-text-tertiary)" }}>{f.errorMessage}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Providers, Operations, Models */}
          <div className="grid gap-[var(--space-6)] lg:grid-cols-3">
            {ai.topProviders.length > 0 && (
              <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
                <div>
                  <Label>Top Providers</Label>
                </div>
                <div className="flex flex-col">
                  {ai.topProviders.map((p, i) => (
                    <div key={p.provider} className="flex items-center justify-between gap-[var(--space-3)] text-[var(--text-sm)] py-[var(--space-3)]" style={{ borderBottom: i < ai.topProviders.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                      <span className="font-medium" style={{ color: "var(--color-text)" }}>{p.provider}</span>
                      <span className="tabular-nums text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{p.calls} · {fmtCost(p.estimatedCostUsd)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {ai.topOperations.length > 0 && (
              <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
                <div>
                  <Label>Top Operations</Label>
                </div>
                <div className="flex flex-col">
                  {ai.topOperations.map((op, i) => {
                    const maxCalls = ai.topOperations[0]?.calls ?? 1;
                    const barWidth = Math.max(8, (op.calls / maxCalls) * 100);
                    return (
                      <div key={op.operation} className="flex flex-col gap-[var(--space-1)] py-[var(--space-3)]" style={{ borderBottom: i < ai.topOperations.length - 1 ? "1px solid var(--color-border)" : "none" }}>
                        <div className="flex items-center justify-between gap-[var(--space-3)]">
                          <span className="text-[var(--text-sm)] font-medium" style={{ color: "var(--color-text)" }}>{op.operation}</span>
                          <span className="tabular-nums text-[var(--text-xs)] font-semibold" style={{ color: "var(--color-accent)" }}>{op.calls}</span>
                        </div>
                        <div className="h-[3px] rounded-full" style={{ width: `${barWidth}%`, background: "var(--color-accent)", opacity: 0.5, maxWidth: "100%" }} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {ai.topModels.length > 0 && (
              <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
                <div>
                  <Label>Top Models</Label>
                </div>
                <div className="flex flex-col gap-[var(--space-3)]">
                  {ai.topModels.map((m) => (
                    <div key={`${m.provider}:${m.model}`} className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)]" style={inset}>
                      <span className="text-[var(--text-sm)] font-medium" style={{ color: "var(--color-text)" }}>{m.provider} / {m.model}</span>
                      <span className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{m.calls} calls · {fmtCost(m.estimatedCostUsd)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ TAB: ALERTS ══════════════ */}
      {activeTab === "alerts" && alertSettings && (
        <div className="flex flex-col gap-[var(--space-6)]">
          <section className="flex flex-col gap-[var(--space-6)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
            {/* Section header */}
            <div className="flex flex-col gap-[var(--space-1)] lg:flex-row lg:items-center lg:justify-between lg:gap-0">
              <div>
                <Label>Alert Settings</Label>
                <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                  Notification destinations
                </h2>
                <p className="mt-[var(--space-1)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
                  Configure where and how alerts are delivered.
                </p>
              </div>
              <div className="flex gap-[var(--space-2)] shrink-0 mt-[var(--space-3)] lg:mt-0">
                <button
                  type="button"
                  onClick={() => void sendTestAlert()}
                  disabled={sendingTestAlert}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={inset}
                >
                  {sendingTestAlert ? "Sending…" : "Send Test"}
                </button>
                <button
                  type="button"
                  onClick={() => void saveAlertSettings()}
                  disabled={savingAlerts}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-5)] py-[var(--space-2)] text-[var(--text-sm)] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                >
                  {savingAlerts ? "Saving…" : "Save Settings"}
                </button>
              </div>
            </div>

            {/* Notification channels */}
            <div className="grid gap-[var(--space-4)] lg:grid-cols-2">
              {([
                { key: "webhookEnabled" as const, label: "Webhook alerts", desc: "Send alerts to the configured webhook URL.", configured: alertSettings.webhookConfigured },
                { key: "telegramEnabled" as const, label: "Telegram alerts", desc: "Send compact alerts to the configured Telegram bot.", configured: alertSettings.telegramConfigured },
              ]).map((dest) => (
                <label key={dest.key} className="flex cursor-pointer items-start gap-[var(--space-4)] rounded-[var(--radius-md)] p-[var(--space-5)] transition-colors" style={{ ...inset, background: alertSettings[dest.key] ? "color-mix(in oklch, var(--color-bg) 92%, var(--color-accent) 8%)" : inset.background }}>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] transition-colors" style={{ background: alertSettings[dest.key] ? "var(--color-accent)" : "var(--color-bg-elevated)", border: alertSettings[dest.key] ? "none" : "1.5px solid var(--color-border-strong)" }}>
                    <input
                      type="checkbox"
                      checked={alertSettings[dest.key]}
                      onChange={(e) => setAlertSettings((s) => s ? { ...s, [dest.key]: e.target.checked } : s)}
                      className="sr-only"
                    />
                    {alertSettings[dest.key] && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--color-bg-elevated)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                  <span className="flex flex-col gap-[var(--space-1)]">
                    <span className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{dest.label}</span>
                    <span className="text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{dest.desc}</span>
                    <span
                      className="mt-[var(--space-1)] inline-flex w-fit rounded-full px-2 py-[3px] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]"
                      style={{
                        background: dest.configured ? "oklch(96% 0.02 145)" : "oklch(94% 0.01 75)",
                        color: dest.configured ? "oklch(40% 0.12 145)" : "var(--color-text-tertiary)",
                      }}
                    >
                      {dest.configured ? "Configured" : "Not configured"}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {/* Severity & cooldown */}
            <div className="grid gap-[var(--space-4)] md:grid-cols-2">
              <label className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={inset}>
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]" style={{ color: "var(--color-text-tertiary)" }}>Minimum Severity</span>
                <select
                  value={alertSettings.minLevel}
                  onChange={(e) => setAlertSettings((s) => s ? { ...s, minLevel: e.target.value as AiAlertSettings["minLevel"] } : s)}
                  className="min-h-[40px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none"
                  style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>
              <label className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={inset}>
                <span className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]" style={{ color: "var(--color-text-tertiary)" }}>Cooldown (minutes)</span>
                <input
                  type="number"
                  min={0}
                  value={fmtCooldown(alertSettings.cooldownMs)}
                  onChange={(e) => setAlertSettings((s) => s ? { ...s, cooldownMs: Math.max(0, Number(e.target.value || 0)) * 60_000 } : s)}
                  className="min-h-[40px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none tabular-nums"
                  style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
                />
              </label>
            </div>

            {/* Daily digest */}
            <label className="flex items-start gap-[var(--space-4)] rounded-[var(--radius-md)] p-[var(--space-5)]" style={{
              background: "color-mix(in oklch, var(--color-bg) 90%, var(--color-accent-lightest) 10%)",
              border: "1px solid color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)",
            }}>
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] transition-colors" style={{ background: alertSettings.dailyDigestEnabled ? "var(--color-accent)" : "var(--color-bg-elevated)", border: alertSettings.dailyDigestEnabled ? "none" : "1.5px solid var(--color-border-strong)" }}>
                <input
                  type="checkbox"
                  checked={alertSettings.dailyDigestEnabled}
                  onChange={(e) => setAlertSettings((s) => s ? { ...s, dailyDigestEnabled: e.target.checked } : s)}
                  className="sr-only"
                />
                {alertSettings.dailyDigestEnabled && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="var(--color-bg-elevated)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </div>
              <span className="flex flex-col gap-[var(--space-1)]">
                <span className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>Daily Digest</span>
                <span className="text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  Send one summary per day with call volume, failures, latency, and cost.
                </span>
              </span>
            </label>

            {/* Notice */}
            {alertNotice && (
              <div
                className="rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] font-medium"
                style={{
                  background: alertNotice.type === "success" ? "oklch(96% 0.02 145)" : "oklch(96% 0.03 25)",
                  border: `1px solid ${alertNotice.type === "success" ? "oklch(80% 0.06 145)" : "oklch(80% 0.06 25)"}`,
                  color: "var(--color-text)",
                }}
              >
                {alertNotice.message}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══════════════ TAB: DETAILS ══════════════ */}
      {activeTab === "details" && (
        <div className="flex flex-col gap-[var(--space-6)]">
          <div className="grid gap-[var(--space-6)] lg:grid-cols-2">
            {/* Provider breakdown */}
            <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
              <div>
                <Label>Provider Breakdown</Label>
                <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                  By provider
                </h2>
              </div>
              {ai.providerBreakdown.length === 0 ? (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No provider data.</p>
              ) : (
                <div className="overflow-hidden rounded-[var(--radius-md)]" style={{ border: "1px solid var(--color-border)" }}>
                  <table className="w-full text-[var(--text-sm)]">
                    <thead>
                      <tr style={{ background: "var(--color-bg)" }}>
                        <th className="text-left font-semibold text-[var(--text-xs)] py-[var(--space-3)] px-[var(--space-4)]">Provider</th>
                        <th className="text-right font-semibold text-[var(--text-xs)] py-[var(--space-3)] px-[var(--space-4)]">Calls</th>
                        <th className="text-right font-semibold text-[var(--text-xs)] py-[var(--space-3)] px-[var(--space-4)]">Failed</th>
                        <th className="text-right font-semibold text-[var(--text-xs)] py-[var(--space-3)] px-[var(--space-4)]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ai.providerBreakdown.map((p) => (
                        <tr key={p.provider} style={{ borderTop: "1px solid var(--color-border)" }}>
                          <td className="py-[var(--space-3)] px-[var(--space-4)] font-medium" style={{ color: "var(--color-text)" }}>{p.provider}</td>
                          <td className="py-[var(--space-3)] px-[var(--space-4)] text-right tabular-nums font-semibold" style={{ color: "var(--color-text)" }}>{p.calls.toLocaleString()}</td>
                          <td className="py-[var(--space-3)] px-[var(--space-4)] text-right tabular-nums" style={{ color: p.failures > 0 ? "var(--color-error)" : "var(--color-text-secondary)" }}>{p.failures}</td>
                          <td className="py-[var(--space-3)] px-[var(--space-4)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtCost(p.estimatedCostUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Model breakdown */}
            <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
              <div>
                <Label>Model Breakdown</Label>
                <h2 className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold" style={{ color: "var(--color-text)" }}>
                  By model
                </h2>
              </div>
              {ai.modelBreakdown.length === 0 ? (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No model data.</p>
              ) : (
                <div className="flex flex-col gap-[var(--space-3)]">
                  {ai.modelBreakdown.map((m) => {
                    const maxCalls = ai.modelBreakdown[0]?.calls ?? 1;
                    const barWidth = Math.max(8, (m.calls / maxCalls) * 100);
                    return (
                      <div key={`${m.provider}-${m.model}`} className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-md)] p-[var(--space-4)]" style={inset}>
                        <div className="flex items-center justify-between gap-[var(--space-2)]">
                          <div className="flex flex-col gap-[2px]">
                            <span className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>{m.model}</span>
                            <span className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{m.provider}</span>
                          </div>
                          <span className="text-[var(--text-lg)] font-semibold tabular-nums" style={{ color: "var(--color-accent)" }}>{m.calls.toLocaleString()}</span>
                        </div>
                        <div className="h-[3px] rounded-full" style={{ width: `${barWidth}%`, background: "var(--color-accent)", opacity: 0.4, maxWidth: "100%" }} />
                        <div className="flex gap-[var(--space-4)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                          <span>{m.totalTokens.toLocaleString()} tokens</span>
                          <span>{m.avgLatencyMs}ms</span>
                          <span>{fmtCost(m.estimatedCostUsd)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
