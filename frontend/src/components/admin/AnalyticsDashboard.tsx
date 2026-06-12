"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";
import type { AnalyticsDashboardData } from "@/types";

type WindowDays = 7 | 30 | 90;

/* ── tiny helpers ── */

function fmtNum(n: number) {
  return n.toLocaleString();
}

function fmtCost(n: number) {
  return n < 0.01 && n > 0 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function fmtMs(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${n}ms`;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/* ── shared surface tokens ── */

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]"
      style={{ color: "var(--color-text-tertiary)" }}
    >
      {children}
    </p>
  );
}

/* ── single metric row item (used in the stats strip) ── */

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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
      {hint && (
        <span
          className="text-[var(--text-xs)] leading-none"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

/* ── vertical divider between stats ── */

function Divider() {
  return (
    <div
      className="hidden md:block self-stretch"
      style={{ width: 1, background: "var(--color-border)" }}
    />
  );
}

/* ── alert badge ── */

function AlertBadge({ level }: { level: "info" | "warning" | "critical" }) {
  const bg =
    level === "critical"
      ? "var(--color-error)"
      : level === "warning"
        ? "var(--color-warning)"
        : "var(--color-accent)";
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

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState<WindowDays>(30);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await apiFetch(
          `/api/analytics/dashboard?windowDays=${windowDays}`,
        );
        const payload = (await res.json()) as AnalyticsDashboardData;
        if (active) setData(payload);
      } catch (err) {
        console.error(err);
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [windowDays]);

  /* ── loading ── */
  if (loading) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-[var(--radius-lg)]"
        style={surface}
      >
        <p
          className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Loading analytics…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="rounded-[var(--radius-lg)] p-[var(--space-8)]"
        style={surface}
      >
        <p style={{ color: "var(--color-text-secondary)" }}>
          Could not load analytics data. Make sure the backend is running.
        </p>
      </div>
    );
  }

  const ai = data.aiOps;
  const maxPageViews = data.topPages[0]?.views ?? 1;
  const costDelta = pctChange(ai.estimatedCostUsd, ai.previousPeriodCostUsd);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      {/* ──────────────── HEADER ──────────────── */}
      <div
        className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)] lg:flex-row lg:items-center lg:justify-between lg:gap-0"
        style={surface}
      >
        <div>
          <SectionLabel>Analytics</SectionLabel>
          <h1
            className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[1.5rem] font-semibold leading-tight lg:text-[1.75rem]"
            style={{ color: "var(--color-text)" }}
          >
            Site &amp; AI Operations
          </h1>
        </div>

        <div className="flex items-center gap-[var(--space-3)]">
          <span
            className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.16em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Period
          </span>
          <select
            value={windowDays}
            onChange={(e) => {
              setLoading(true);
              setWindowDays(Number(e.target.value) as WindowDays);
            }}
            className="min-h-[36px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-1)] text-[var(--text-sm)] outline-none"
            style={inset}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* ──────────────── STATS STRIP ──────────────── */}
      <div
        className="grid grid-cols-2 gap-x-[var(--space-6)] gap-y-[var(--space-5)] rounded-[var(--radius-lg)] p-[var(--space-6)] md:grid-cols-3 lg:grid-cols-6"
        style={surface}
      >
        <Stat label="Page Views" value={fmtNum(data.totalViews)} hint={`${fmtNum(data.recentViews)} in last 7d`} />
        <Stat label="Posts" value={fmtNum(data.publishedPosts)} hint={`${fmtNum(data.totalPosts)} total`} />
        <Stat label="Projects" value={fmtNum(data.totalProjects)} />
        <Stat label="AI Calls" value={fmtNum(ai.totalCalls)} hint={`${ai.failures} failures`} />
        <Stat label="Est. Cost" value={fmtCost(ai.estimatedCostUsd)} hint={costDelta !== 0 ? `${costDelta > 0 ? "+" : ""}${costDelta}%` : undefined} />
        <Stat label="Avg Latency" value={fmtMs(ai.avgLatencyMs)} />
      </div>

      {/* ──────────────── TWO-COLUMN BODY ──────────────── */}
      <div className="grid gap-[var(--space-6)] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ── LEFT: Top Pages ── */}
        <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
          <div>
            <SectionLabel>Top Pages</SectionLabel>
            <h2
              className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              Most visited routes
            </h2>
          </div>

          {data.topPages.length === 0 ? (
            <p
              className="py-[var(--space-6)] text-[var(--text-sm)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              No page view data collected yet. Traffic will appear here as visitors browse your site.
            </p>
          ) : (
            <ol className="flex flex-col gap-[var(--space-2)]">
              {data.topPages.map((p, i) => {
                const barWidth = Math.max(4, (p.views / maxPageViews) * 100);
                return (
                  <li
                    key={p.path}
                    className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)]"
                    style={inset}
                  >
                    {/* rank */}
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--text-xs)] font-semibold"
                      style={{
                        background: i === 0 ? "var(--color-accent)" : "var(--color-bg-muted)",
                        color: i === 0 ? "var(--color-accent-on)" : "var(--color-text-tertiary)",
                      }}
                    >
                      {i + 1}
                    </span>

                    {/* path + bar */}
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <Link
                        href={p.path}
                        className="truncate font-medium hover:underline"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {p.path}
                      </Link>
                      <div
                        className="h-[3px] rounded-full"
                        style={{
                          width: `${barWidth}%`,
                          background: i === 0
                            ? "var(--color-accent)"
                            : "var(--color-border-strong)",
                          maxWidth: "100%",
                        }}
                      />
                    </div>

                    {/* views */}
                    <span
                      className="shrink-0 font-semibold tabular-nums"
                      style={{ color: "var(--color-text)" }}
                    >
                      {fmtNum(p.views)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {/* ── RIGHT: AI Health ── */}
        <section className="flex flex-col gap-[var(--space-5)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
          <div>
            <SectionLabel>AI Operations</SectionLabel>
            <h2
              className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              Service health
            </h2>
          </div>

          {/* Success rate dial */}
          <div
            className="flex items-center gap-[var(--space-4)] rounded-[var(--radius-md)] p-[var(--space-4)]"
            style={{
              background: ai.successRate >= 95
                ? "oklch(96% 0.02 145)"
                : ai.successRate >= 80
                  ? "oklch(96% 0.03 85)"
                  : "oklch(96% 0.03 25)",
            }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[var(--text-sm)] font-bold"
              style={{
                background: ai.successRate >= 95
                  ? "var(--color-success)"
                  : ai.successRate >= 80
                    ? "var(--color-warning)"
                    : "var(--color-error)",
                color: "var(--color-bg-elevated)",
              }}
            >
              {ai.successRate}%
            </div>
            <div className="flex flex-col gap-[2px]">
              <span className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                {ai.successRate >= 95 ? "Healthy" : ai.successRate >= 80 ? "Degraded" : "Unhealthy"}
              </span>
              <span className="text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                {fmtNum(ai.totalCalls - ai.failures)} of {fmtNum(ai.totalCalls)} calls succeeded
              </span>
            </div>
          </div>

          {/* Conversations */}
          <div className="flex items-baseline justify-between">
            <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>Conversations</span>
            <span className="font-[family-name:var(--font-display)] text-[1.1rem] font-semibold tabular-nums" style={{ color: "var(--color-text)" }}>
              {fmtNum(ai.totalConversations)}
              <span className="ml-1 text-[var(--text-xs)] font-normal" style={{ color: "var(--color-text-tertiary)" }}>
                ({fmtNum(ai.archivedConversations)} archived)
              </span>
            </span>
          </div>

          {/* Alerts */}
          {ai.alerts.length > 0 && (
            <div className="flex flex-col gap-[var(--space-2)]">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--color-text-tertiary)" }}>
                Alerts
              </span>
              {ai.alerts.map((a) => (
                <div
                  key={a.code}
                  className="flex items-start gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-3)] text-[var(--text-sm)]"
                  style={inset}
                >
                  <AlertBadge level={a.level} />
                  <div className="flex flex-col gap-[2px]">
                    <span className="font-medium" style={{ color: "var(--color-text)" }}>{a.title}</span>
                    <span style={{ color: "var(--color-text-secondary)" }}>{a.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Providers table */}
          {ai.providerBreakdown.length > 0 && (
            <div className="flex flex-col gap-[var(--space-2)]">
              <span className="text-[var(--text-xs)] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--color-text-tertiary)" }}>
                Providers
              </span>
              <table className="w-full text-[var(--text-sm)]">
                <thead>
                  <tr style={{ color: "var(--color-text-tertiary)" }}>
                    <th className="text-left font-medium text-[var(--text-xs)] pb-[var(--space-3)]">Provider</th>
                    <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)]">Calls</th>
                    <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)]">Cost</th>
                    <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)]">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {ai.providerBreakdown.map((p) => (
                    <tr key={p.provider} style={{ borderTop: "1px solid var(--color-border)" }}>
                      <td className="py-[var(--space-3)] font-medium" style={{ color: "var(--color-text)" }}>{p.provider}</td>
                      <td className="py-[var(--space-3)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtNum(p.calls)}</td>
                      <td className="py-[var(--space-3)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtCost(p.estimatedCostUsd)}</td>
                      <td className="py-[var(--space-3)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtMs(p.avgLatencyMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ──────────────── AI USAGE DETAIL ──────────────── */}
      <div className="grid gap-[var(--space-6)] lg:grid-cols-2">
        {/* Daily usage bars */}
        <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
          <div>
            <SectionLabel>Daily Usage</SectionLabel>
            <h2
              className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              AI calls per day
            </h2>
          </div>

          {ai.dailyUsage.length === 0 ? (
            <p className="py-[var(--space-4)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
              No AI usage recorded in this period.
            </p>
          ) : (
            <div className="flex items-end gap-[3px] h-32">
              {ai.dailyUsage.map((d) => {
                const maxCalls = Math.max(...ai.dailyUsage.map((x) => x.calls), 1);
                const height = Math.max(4, (d.calls / maxCalls) * 100);
                const hasFailures = d.failures > 0;
                return (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-[3px] min-w-0" title={`${d.date}: ${d.calls} calls, ${d.failures} failures`}>
                    <span className="text-[0.55rem] tabular-nums truncate w-full text-center" style={{ color: "var(--color-text-tertiary)" }}>
                      {d.calls}
                    </span>
                    <div
                      className="w-full rounded-t-[2px]"
                      style={{
                        height: `${height}%`,
                        background: hasFailures ? "var(--color-error)" : "var(--color-accent)",
                        opacity: hasFailures ? 0.8 : 0.65,
                        minHeight: 3,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent failures */}
        <section className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
          <div>
            <SectionLabel>Failures</SectionLabel>
            <h2
              className="mt-[var(--space-2)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              Recent errors
            </h2>
          </div>

          {ai.recentFailures.length === 0 ? (
            <div
              className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-4)]"
              style={{ background: "oklch(96% 0.02 145)" }}
            >
              <span className="text-[var(--text-sm)] font-medium" style={{ color: "var(--color-success)" }}>✓</span>
              <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
                No failures in the last {windowDays} days.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-[var(--space-2)]">
              {ai.recentFailures.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex flex-col gap-[var(--space-1)] rounded-[var(--radius-md)] p-[var(--space-3)] text-[var(--text-sm)]"
                  style={inset}
                >
                  <div className="flex items-center justify-between gap-[var(--space-2)]">
                    <span className="font-medium truncate" style={{ color: "var(--color-text)" }}>
                      {f.operation}
                    </span>
                    <span
                      className="shrink-0 text-[var(--text-xs)] tabular-nums"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {f.provider}
                    </span>
                  </div>
                  <p className="text-[var(--text-xs)] truncate" style={{ color: "var(--color-text-tertiary)" }}>
                    {f.errorMessage}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ──────────────── MODELS & OPERATIONS ──────────────── */}
      {ai.modelBreakdown.length > 0 && (
        <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={surface}>
          <SectionLabel>Model Breakdown</SectionLabel>
          <div className="mt-[var(--space-3)] overflow-x-auto">
            <table className="w-full text-[var(--text-sm)]">
              <thead>
                <tr style={{ color: "var(--color-text-tertiary)" }}>
                  <th className="text-left font-medium text-[var(--text-xs)] pb-[var(--space-3)] pr-[var(--space-4)]">Model</th>
                  <th className="text-left font-medium text-[var(--text-xs)] pb-[var(--space-3)] pr-[var(--space-4)]">Provider</th>
                  <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)] pr-[var(--space-4)]">Calls</th>
                  <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)] pr-[var(--space-4)]">Tokens</th>
                  <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)] pr-[var(--space-4)]">Cost</th>
                  <th className="text-right font-medium text-[var(--text-xs)] pb-[var(--space-3)]">Latency</th>
                </tr>
              </thead>
              <tbody>
                {ai.modelBreakdown.map((m) => (
                  <tr key={`${m.provider}-${m.model}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                    <td className="py-[var(--space-3)] pr-[var(--space-4)] font-medium" style={{ color: "var(--color-text)" }}>{m.model}</td>
                    <td className="py-[var(--space-3)] pr-[var(--space-4)]" style={{ color: "var(--color-text-secondary)" }}>{m.provider}</td>
                    <td className="py-[var(--space-3)] pr-[var(--space-4)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtNum(m.calls)}</td>
                    <td className="py-[var(--space-3)] pr-[var(--space-4)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtNum(m.totalTokens)}</td>
                    <td className="py-[var(--space-3)] pr-[var(--space-4)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtCost(m.estimatedCostUsd)}</td>
                    <td className="py-[var(--space-3)] text-right tabular-nums" style={{ color: "var(--color-text-secondary)" }}>{fmtMs(m.avgLatencyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
