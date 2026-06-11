"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth";
import type { AiAlertSettings, AnalyticsDashboardData } from "@/types";

function formatCurrency(value: number) {
  return `$${value.toFixed(4)}`;
}

function formatWindowLabel(days: number) {
  return `${days}d`;
}

function formatCooldownMinutes(value: number) {
  return Math.max(0, Math.round(value / 60000));
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

type WindowDays = 7 | 30 | 90;
type TabId = "overview" | "ai-ops" | "alerts" | "details";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "ai-ops", label: "AI Ops" },
  { id: "alerts", label: "Alerts" },
  { id: "details", label: "Details" },
];

const ALERT_STYLES = {
  info: {
    background: "rgba(79, 70, 229, 0.08)",
    border: "rgba(79, 70, 229, 0.18)",
    text: "var(--color-text)",
  },
  warning: {
    background: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.24)",
    text: "var(--color-text)",
  },
  critical: {
    background: "rgba(220, 38, 38, 0.1)",
    border: "rgba(220, 38, 38, 0.22)",
    text: "var(--color-text)",
  },
} as const;

const surfaceStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
};

const insetSurfaceStyle = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
};

const softSurfaceStyle = {
  background: "color-mix(in oklch, var(--color-bg) 90%, var(--color-accent-lightest) 10%)",
  border: "1px solid color-mix(in oklch, var(--color-border) 78%, var(--color-accent) 22%)",
};

function SurfaceSection({
  title,
  description,
  action,
  label,
  children,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  label?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-[calc(var(--radius-lg)+2px)] ${compact ? "p-[var(--space-5)]" : "p-[var(--space-6)]"}`}
      style={surfaceStyle}
    >
      <div className="mb-[var(--space-5)] flex flex-col gap-[var(--space-3)] lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[52rem]">
          {label ? (
            <p
              className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {label}
            </p>
          ) : null}
          <h2
            className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
            style={{ color: "var(--color-text)" }}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-[var(--space-2)] max-w-[68ch] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={insetSurfaceStyle}>
      <p
        className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        {label}
      </p>
      <p
        className="mt-[var(--space-3)] font-[family-name:var(--font-display)] text-[clamp(1.4rem,2vw,2rem)] font-semibold leading-none"
        style={{ color: "var(--color-text)" }}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-[var(--space-2)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function ListCard({
  title,
  children,
  description,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={insetSurfaceStyle}>
      <div className="mb-[var(--space-3)]">
        <h3 className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
          {title}
        </h3>
        {description ? (
          <p className="mt-[var(--space-1)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

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

    async function loadDashboard() {
      try {
        const [dashboardResponse, alertSettingsResponse] = await Promise.all([
          apiFetch(`/api/analytics/dashboard?windowDays=${windowDays}`),
          apiFetch("/api/analytics/alert-settings"),
        ]);
        const [payload, settingsPayload] = (await Promise.all([
          dashboardResponse.json(),
          alertSettingsResponse.json(),
        ])) as [AnalyticsDashboardData, AiAlertSettings];
        if (active) {
          setData(payload);
          setAlertSettings(settingsPayload);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setData(null);
          setAlertSettings(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, [windowDays]);

  async function saveAlertSettings() {
    if (!alertSettings) return;

    setSavingAlerts(true);
    setAlertNotice(null);

    try {
      const response = await apiFetch("/api/analytics/alert-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookEnabled: alertSettings.webhookEnabled,
          telegramEnabled: alertSettings.telegramEnabled,
          minLevel: alertSettings.minLevel,
          cooldownMs: alertSettings.cooldownMs,
          dailyDigestEnabled: alertSettings.dailyDigestEnabled,
        }),
      });
      const payload = (await response.json()) as AiAlertSettings;
      setAlertSettings(payload);
      setAlertNotice({
        type: "success",
        message:
          payload.webhookEnabled || payload.telegramEnabled
            ? "Notification preferences updated. Enabled destinations can now receive alerts."
            : "Notification preferences updated. All notification destinations are currently off.",
      });
    } catch (error) {
      console.error(error);
      setAlertNotice({ type: "error", message: "Could not update notification preferences." });
    } finally {
      setSavingAlerts(false);
    }
  }

  async function sendTestAlert() {
    setSendingTestAlert(true);
    setAlertNotice(null);

    try {
      const response = await apiFetch("/api/analytics/alert-settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const payload = (await response.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send test alert.");
      }

      setAlertNotice({
        type: "success",
        message: "Test alert sent successfully. Check the enabled destination for delivery.",
      });
    } catch (error) {
      console.error(error);
      setAlertNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to send test alert.",
      });
    } finally {
      setSendingTestAlert(false);
    }
  }

  const metrics = data
    ? [
        { label: "Total Posts", value: data.totalPosts.toLocaleString(), sub: `${data.publishedPosts} published posts` },
        { label: "Projects", value: data.totalProjects.toLocaleString(), sub: "Public project inventory" },
        {
          label: `Views (${formatWindowLabel(data.aiOps.windowDays)})`,
          value: data.totalViews.toLocaleString(),
          sub: `${data.recentViews} views in the last 7 days`,
        },
        {
          label: `AI Calls (${formatWindowLabel(data.aiOps.windowDays)})`,
          value: data.aiOps.totalCalls.toLocaleString(),
          sub: `${data.aiOps.failures} failed · ${data.aiOps.successRate}% success`,
        },
      ]
    : [];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-[calc(var(--radius-lg)+2px)]" style={surfaceStyle}>
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
          Loading dashboard…
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[calc(var(--radius-lg)+2px)] p-[var(--space-6)]" style={surfaceStyle}>
        <p style={{ color: "var(--color-text-secondary)" }}>
          Could not load dashboard data. Make sure the backend is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-[var(--space-8)]">
      {/* Page header - always visible */}
      <section className="rounded-[calc(var(--radius-lg)+4px)] p-[var(--space-6)] lg:p-[var(--space-7)]" style={surfaceStyle}>
        <div className="grid gap-[var(--space-6)] xl:grid-cols-[minmax(0,1.35fr),minmax(18rem,0.65fr)]">
          <div>
            <p
              className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.24em]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Dashboard
            </p>
            <h1
              className="mt-[var(--space-3)] max-w-[18ch] font-[family-name:var(--font-display)] text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[0.96]"
              style={{ color: "var(--color-text)" }}
            >
              Operational visibility for content and AI publishing.
            </h1>
            <p
              className="mt-[var(--space-4)] max-w-[72ch] text-[var(--text-sm)] leading-relaxed sm:text-[var(--text-base)]"
              style={{ color: "var(--color-text-secondary)" }}
            >
              Review content volume, public traffic, AI cost patterns, failure signals, and notification posture from one place without leaving the admin workspace.
            </p>
          </div>

          <div className="grid gap-[var(--space-4)] self-start">
            <div className="rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={softSurfaceStyle}>
              <p
                className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Active Window
              </p>
              <div className="mt-[var(--space-3)] flex flex-wrap items-center gap-[var(--space-3)]">
                <select
                  value={windowDays}
                  onChange={(event) => {
                    setLoading(true);
                    setWindowDays(Number(event.target.value) as WindowDays);
                  }}
                  className="min-h-[42px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none"
                  style={insetSurfaceStyle}
                >
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
                <Link
                  href="/admin/posts/new"
                  className="inline-flex min-h-[42px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[0.7rem] uppercase tracking-[0.18em] transition-opacity hover:opacity-90"
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                >
                  New Post
                </Link>
              </div>
              <div className="mt-[var(--space-3)]">
                <Link
                  href="/admin/ai-writer"
                  className="inline-flex min-h-[42px] w-full items-center justify-center rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-[var(--text-sm)] font-medium transition-opacity hover:opacity-90"
                  style={insetSurfaceStyle}
                >
                  Open AI Writer
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tab bar */}
      <div
        className="flex overflow-x-auto"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className="whitespace-nowrap py-[var(--space-3)] px-[var(--space-4)] text-[var(--text-sm)] transition-colors"
            style={{
              borderBottom: activeTab === tab.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--color-text)" : "var(--color-text-tertiary)",
              fontWeight: activeTab === tab.id ? 500 : 400,
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "var(--color-text)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) {
                e.currentTarget.style.color = "var(--color-text-tertiary)";
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-[var(--space-6)]">
          <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 2xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricTile key={metric.label} label={metric.label} value={metric.value} sub={metric.sub} />
            ))}
          </div>

          <div className="grid gap-[var(--space-6)] xl:grid-cols-3">
            <div>
              <ListCard title={`Top pages (${formatWindowLabel(data.aiOps.windowDays)})`} description="Public routes with the strongest view count.">
                {data.topPages.length ? (
                  <div className="space-y-[var(--space-2)]">
                    {data.topPages.map((pageEntry) => (
                      <div
                        key={pageEntry.path}
                        className="flex items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]"
                        style={insetSurfaceStyle}
                      >
                        <span className="truncate pr-[var(--space-4)]" style={{ color: "var(--color-text-secondary)" }}>
                          {pageEntry.path}
                        </span>
                        <span style={{ color: "var(--color-text)", fontWeight: 600 }}>{pageEntry.views}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--color-text-tertiary)" }}>No page view data yet.</p>
                )}
              </ListCard>
            </div>

            <div className="xl:col-span-2">
              <ListCard title="Daily usage" description="Calls, failures, and estimated spend by day.">
                {data.aiOps.dailyUsage.length ? (
                  <div className="space-y-[var(--space-2)]">
                    {data.aiOps.dailyUsage.map((entry) => (
                      <div
                        key={entry.date}
                        className="grid grid-cols-[minmax(0,1fr),auto,auto] gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]"
                        style={{
                          background: "color-mix(in oklch, var(--color-bg) 94%, var(--color-accent-lightest) 6%)",
                          border: "1px solid var(--color-border)",
                        }}
                      >
                        <div>
                          <p style={{ color: "var(--color-text)" }}>{formatShortDate(entry.date)}</p>
                          <p className="mt-[2px] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            {entry.calls} calls · {entry.failures} failed
                          </p>
                        </div>
                        <span className="self-center text-[var(--text-xs)]" style={{ color: "var(--color-text-secondary)" }}>
                          {entry.calls ? `${Math.round((entry.failures / entry.calls) * 100)}% fail` : "0% fail"}
                        </span>
                        <span className="self-center text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                          {formatCurrency(entry.estimatedCostUsd)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--color-text-tertiary)" }}>No AI usage events in this window.</p>
                )}
              </ListCard>
            </div>
          </div>
        </div>
      )}

      {/* Tab: AI Ops */}
      {activeTab === "ai-ops" && (
        <div className="space-y-[var(--space-6)]">
          <SurfaceSection
            title="AI Ops overview"
            label="AI Blog Studio"
            description="Usage, latency, provider mix, and cost signals for AI Blog Studio across the selected time window."
          >
            <div className="mb-[var(--space-5)] grid grid-cols-2 gap-[var(--space-4)] lg:grid-cols-4">
              <MetricTile label="Tokens" value={data.aiOps.totalTokens.toLocaleString()} />
              <MetricTile label="Avg Latency" value={`${data.aiOps.avgLatencyMs} ms`} />
              <MetricTile label="Estimated Cost" value={formatCurrency(data.aiOps.estimatedCostUsd)} />
              <MetricTile
                label="Previous Window"
                value={formatCurrency(data.aiOps.previousPeriodCostUsd)}
                sub={`${data.aiOps.totalConversations} conversations`}
              />
            </div>
            <div className="grid gap-[var(--space-5)] xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
              <ListCard title="Ops alerts" description="Server-side signals surfaced for delivery and review.">
                {data.aiOps.alerts.length ? (
                  <div className="space-y-[var(--space-3)]">
                    {data.aiOps.alerts.map((alert) => {
                      const palette = ALERT_STYLES[alert.level];
                      return (
                        <div
                          key={alert.code}
                          className="rounded-[var(--radius-md)] border p-[var(--space-4)]"
                          style={{ background: palette.background, borderColor: palette.border, color: palette.text }}
                        >
                          <div className="flex items-center justify-between gap-[var(--space-3)]">
                            <p className="text-[var(--text-sm)] font-semibold">{alert.title}</p>
                            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--color-text-tertiary)" }}>
                              {alert.level}
                            </span>
                          </div>
                          <p className="mt-[var(--space-2)] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                            {alert.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: "var(--color-text-tertiary)" }}>No active AI ops alerts in this window.</p>
                )}
              </ListCard>

              <ListCard title="Recent failures" description="Latest provider failures captured in the selected window.">
                {data.aiOps.recentFailures.length ? (
                  <div className="space-y-[var(--space-3)]">
                    {data.aiOps.recentFailures.map((failure) => (
                      <div
                        key={failure.id}
                        className="rounded-[var(--radius-md)] p-[var(--space-4)]"
                        style={{
                          background: "rgba(220, 38, 38, 0.04)",
                          border: "1px solid rgba(220, 38, 38, 0.12)",
                        }}
                      >
                        <div className="flex flex-col gap-[var(--space-1)] sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                            {failure.operation} · {failure.provider}
                          </p>
                          <p className="text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            {formatDate(failure.createdAt)}
                          </p>
                        </div>
                        <p className="mt-[var(--space-2)] text-[var(--text-sm)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                          {failure.errorMessage}
                        </p>
                        {failure.conversationLabel ? (
                          <p className="mt-[var(--space-2)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            Conversation: {failure.conversationLabel}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--color-text-tertiary)" }}>No recent AI failures in this window.</p>
                )}
              </ListCard>
            </div>
          </SurfaceSection>

          <div className="grid gap-[var(--space-6)] xl:grid-cols-3">
            <ListCard title="Top providers" description="Volume and estimated spend by provider.">
              <div className="space-y-[var(--space-3)]">
                <div className="grid grid-cols-[1fr,auto] gap-[var(--space-3)] pb-[var(--space-2)] mb-[var(--space-2)] border-b text-[var(--text-xs)] font-semibold uppercase tracking-wider" style={{ borderColor: "var(--color-border)", color: "var(--color-text-tertiary)" }}>
                  <span>Provider</span>
                  <span>Calls · Cost</span>
                </div>
              </div>
              {data.aiOps.topProviders.length ? (
                <div className="space-y-[var(--space-3)]">
                  {data.aiOps.topProviders.map((provider) => (
                    <div key={provider.provider} className="flex items-center justify-between gap-[var(--space-3)] text-[var(--text-sm)]">
                      <span style={{ color: "var(--color-text-secondary)" }}>{provider.provider}</span>
                      <span style={{ color: "var(--color-text)" }}>
                        {provider.calls} · {formatCurrency(provider.estimatedCostUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-text-tertiary)" }}>No provider activity yet.</p>
              )}
            </ListCard>

            <ListCard title="Top operations" description="Where AI generation effort is being spent.">
              {data.aiOps.topOperations.length ? (
                <div className="space-y-[var(--space-3)]">
                  {data.aiOps.topOperations.map((operation) => (
                    <div key={operation.operation} className="flex items-center justify-between gap-[var(--space-3)] text-[var(--text-sm)]">
                      <span style={{ color: "var(--color-text-secondary)" }}>{operation.operation}</span>
                      <span style={{ color: "var(--color-text)" }}>{operation.calls}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-text-tertiary)" }}>No operation data yet.</p>
              )}
            </ListCard>

            <ListCard title="Provider / model" description="Most active provider and model combinations.">
              {data.aiOps.topModels.length ? (
                <div className="space-y-[var(--space-3)]">
                  {data.aiOps.topModels.map((model) => (
                    <div key={`${model.provider}:${model.model}`} className="space-y-[2px] text-[var(--text-sm)]">
                      <p style={{ color: "var(--color-text)" }}>
                        {model.provider} / {model.model}
                      </p>
                      <p style={{ color: "var(--color-text-tertiary)" }}>
                        {model.calls} calls · {formatCurrency(model.estimatedCostUsd)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-text-tertiary)" }}>No model data yet.</p>
              )}
            </ListCard>
          </div>
        </div>
      )}

      {/* Tab: Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-[var(--space-6)]">
          <SurfaceSection
            title="Notification destinations"
            label="Alerts"
            description="Alert delivery stays off by default. Turn on each channel only after the backend destination is configured."
            action={
              <div className="flex flex-wrap gap-[var(--space-2)]">
                <button
                  type="button"
                  onClick={() => void saveAlertSettings()}
                  disabled={!alertSettings || savingAlerts}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                >
                  {savingAlerts ? "Saving…" : "Save Settings"}
                </button>
                <button
                  type="button"
                  onClick={() => void sendTestAlert()}
                  disabled={!alertSettings || sendingTestAlert}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-xs)] font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  style={insetSurfaceStyle}
                >
                  {sendingTestAlert ? "Sending…" : "Send Test Alert"}
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-[var(--space-4)] xl:grid-cols-2">
              {[
                {
                  key: "webhookEnabled" as const,
                  label: "Webhook alerts",
                  description: "Use the backend webhook URL for AI failure, latency, and cost alerts.",
                  configured: alertSettings?.webhookConfigured ?? false,
                },
                {
                  key: "telegramEnabled" as const,
                  label: "Telegram alerts",
                  description: "Send compact AI ops alerts to the configured Telegram bot and chat.",
                  configured: alertSettings?.telegramConfigured ?? false,
                },
              ].map((destination) => (
                <label
                  key={destination.key}
                  className="flex cursor-pointer items-start gap-[var(--space-3)] rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]"
                  style={insetSurfaceStyle}
                >
                  <input
                    type="checkbox"
                    checked={alertSettings?.[destination.key] ?? false}
                    onChange={(event) => {
                      setAlertSettings((current) =>
                        current
                          ? {
                              ...current,
                              [destination.key]: event.target.checked,
                            }
                          : current
                      );
                    }}
                    className="mt-[2px]"
                  />
                  <span>
                    <span className="block text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                      {destination.label}
                    </span>
                    <span className="mt-[4px] block text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                      {destination.description}
                    </span>
                    <span
                      className="mt-[var(--space-3)] inline-flex rounded-full px-2 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.18em]"
                      style={{
                        background: destination.configured ? "rgba(16, 185, 129, 0.08)" : "rgba(148, 163, 184, 0.12)",
                        color: destination.configured ? "rgb(4, 120, 87)" : "var(--color-text-tertiary)",
                      }}
                    >
                      {destination.configured ? "Configured" : "Not configured"}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-[var(--space-4)] grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
              <label className="flex flex-col gap-[var(--space-1)]">
                <span
                  className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Minimum Severity
                </span>
                <select
                  value={alertSettings?.minLevel ?? "warning"}
                  onChange={(event) =>
                    setAlertSettings((current) =>
                      current
                        ? {
                            ...current,
                            minLevel: event.target.value as AiAlertSettings["minLevel"],
                          }
                        : current
                    )
                  }
                  className="min-h-[42px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none"
                  style={insetSurfaceStyle}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label className="flex flex-col gap-[var(--space-1)]">
                <span
                  className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Cooldown Minutes
                </span>
                <input
                  type="number"
                  min={0}
                  value={formatCooldownMinutes(alertSettings?.cooldownMs ?? 300000)}
                  onChange={(event) =>
                    setAlertSettings((current) =>
                      current
                        ? {
                            ...current,
                            cooldownMs: Math.max(0, Number(event.target.value || 0)) * 60_000,
                          }
                        : current
                    )
                  }
                  className="min-h-[42px] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none"
                  style={insetSurfaceStyle}
                />
              </label>
            </div>

            <label className="mt-[var(--space-4)] flex items-start gap-[var(--space-3)] rounded-[calc(var(--radius-md)+2px)] p-[var(--space-4)]" style={softSurfaceStyle}>
              <input
                type="checkbox"
                checked={alertSettings?.dailyDigestEnabled ?? false}
                onChange={(event) =>
                  setAlertSettings((current) =>
                    current
                      ? {
                          ...current,
                          dailyDigestEnabled: event.target.checked,
                        }
                      : current
                  )
                }
                className="mt-[2px]"
              />
              <span>
                <span className="block text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                  Daily Digest
                </span>
                <span className="mt-[4px] block text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                  Send one summary notification per day with recent AI call volume, failures, latency, and estimated cost.
                </span>
              </span>
            </label>

            {alertNotice ? (
              <div
                className="mt-[var(--space-4)] rounded-[calc(var(--radius-md)+2px)] border px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]"
                style={{
                  background: alertNotice.type === "success" ? "rgba(16, 185, 129, 0.08)" : "rgba(220, 38, 38, 0.08)",
                  borderColor: alertNotice.type === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(220, 38, 38, 0.2)",
                  color: "var(--color-text)",
                }}
              >
                {alertNotice.message}
              </div>
            ) : null}
          </SurfaceSection>
        </div>
      )}

      {/* Tab: Details */}
      {activeTab === "details" && (
        <div className="space-y-[var(--space-6)]">
          <div className="grid gap-[var(--space-6)] xl:grid-cols-2">
            <ListCard title="Provider breakdown" description="Call volume, failures, and spend by provider across the active window.">
              {data.aiOps.providerBreakdown.length ? (
                <div className="space-y-[var(--space-2)]">
                  {data.aiOps.providerBreakdown.map((provider) => (
                    <div
                      key={provider.provider}
                      className="grid grid-cols-[minmax(0,1.2fr),auto,auto,auto] items-center gap-[var(--space-3)] rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]"
                      style={insetSurfaceStyle}
                    >
                      <span style={{ color: "var(--color-text)" }}>{provider.provider}</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>{provider.calls} calls</span>
                      <span style={{ color: "var(--color-text-secondary)" }}>{provider.failures} failed</span>
                      <span style={{ color: "var(--color-text)" }}>{formatCurrency(provider.estimatedCostUsd)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-text-tertiary)" }}>No provider breakdown available yet.</p>
              )}
            </ListCard>

            <ListCard title="Model breakdown" description="Detailed performance by provider and model combination.">
              {data.aiOps.modelBreakdown.length ? (
                <div className="space-y-[var(--space-2)]">
                  {data.aiOps.modelBreakdown.map((model) => (
                    <div
                      key={`${model.provider}:${model.model}`}
                      className="rounded-[var(--radius-md)] px-[var(--space-3)] py-[var(--space-3)] text-[var(--text-sm)]"
                      style={insetSurfaceStyle}
                    >
                      <div className="flex flex-col gap-[var(--space-1)] sm:flex-row sm:items-center sm:justify-between">
                        <span style={{ color: "var(--color-text)" }}>
                          {model.provider} / {model.model}
                        </span>
                        <span style={{ color: "var(--color-text-tertiary)" }}>{model.calls} calls</span>
                      </div>
                      <p className="mt-[var(--space-2)] text-[var(--text-xs)] leading-relaxed" style={{ color: "var(--color-text-tertiary)" }}>
                        {model.failures} failed · {model.totalTokens.toLocaleString()} tokens · {model.avgLatencyMs} ms avg · {formatCurrency(model.estimatedCostUsd)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--color-text-tertiary)" }}>No model breakdown available yet.</p>
              )}
            </ListCard>
          </div>

          <ListCard title="Provider / model" description="Most active provider and model combinations.">
            {data.aiOps.topModels.length ? (
              <div className="space-y-[var(--space-3)]">
                {data.aiOps.topModels.map((model) => (
                  <div key={`${model.provider}:${model.model}`} className="space-y-[2px] text-[var(--text-sm)]">
                    <p style={{ color: "var(--color-text)" }}>
                      {model.provider} / {model.model}
                    </p>
                    <p style={{ color: "var(--color-text-tertiary)" }}>
                      {model.calls} calls · {formatCurrency(model.estimatedCostUsd)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--color-text-tertiary)" }}>No model data yet.</p>
            )}
          </ListCard>
        </div>
      )}
    </div>
  );
}
