"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthProvider, logoutAdmin, useAuth } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Settings {
  site_title?: string;
  logo_url?: string;
  tagline?: string;
  description?: string;
  author_name?: string;
  bio_hero?: string;
  bio_about_1?: string;
  bio_about_2?: string;
  bio_about_3?: string;
  social_links?: { github?: string; linkedin?: string; twitter?: string; email?: string };
  hero_stats?: { value: string; label: string }[];
  skill_groups?: { category: string; skills: { name: string; level: string }[] }[];
  announcement?: { text: string; link: string; enabled: boolean };
  theme?: string;
}

interface AiConfig {
  provider: string;
  apiKeyMasked: string;
  apiKeySet: boolean;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  apiKey?: string;
}

interface McpConfig {
  apiKeyMasked: string;
  apiKeySet: boolean;
  mcpUrl: string;
  siteUrl: string;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
}

const defaultSettings: Settings = {
  site_title: "",
  logo_url: "",
  tagline: "",
  description: "",
  author_name: "",
  bio_hero: "",
  bio_about_1: "",
  bio_about_2: "",
  bio_about_3: "",
  social_links: { github: "", linkedin: "", twitter: "", email: "" },
  hero_stats: [{ value: "", label: "" }],
  skill_groups: [],
  announcement: { text: "", link: "", enabled: false },
  theme: "light-minimal",
};

const sections = [
  { id: "home", label: "Home Page" },
  { id: "about", label: "About Page" },
  { id: "site", label: "Site Wide" },
] as const;

export default function SettingsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <SettingsContent />
      </UIProvider>
    </AuthProvider>
  );
}

function SettingsContent() {
  const { token } = useAuth();
  const { toast } = useUI();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [aiConfig, setAiConfig] = useState<AiConfig | null>(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [mcpRegenerating, setMcpRegenerating] = useState(false);
  const [mcpCopied, setMcpCopied] = useState<string | null>(null);
  const [skillGroupsText, setSkillGroupsText] = useState("[]");
  const [skillGroupsError, setSkillGroupsError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]["id"]>("home");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const loadSettings = async () => {
      setLoading(true);
      setPageError(null);

      try {
        const data = await adminApiRequest<Settings>("/api/settings");
        if (cancelled) return;

        const merged = { ...defaultSettings, ...data };
        setSettings(merged);
        setSkillGroupsText(JSON.stringify(merged.skill_groups || [], null, 2));
        setSkillGroupsError(null);
      } catch (error) {
        if (cancelled) return;

        console.error(error);
        const message = getAdminErrorMessage(error, "Failed to load settings.");
        setPageError(message);
        toast(message, "error");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();
    void adminApiRequest<AiConfig>("/api/admin/ai-config").then(setAiConfig).catch(() => {});
    void adminApiRequest<McpConfig>("/api/admin/mcp-config").then(setMcpConfig).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, toast]);

  const inputStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
  };

  const labelClass = "mb-[var(--space-1)] block font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider";

  const set = (key: keyof Settings, value: unknown) => {
    setSaveError(null);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const setSocial = (key: string, value: string) => {
    setSaveError(null);
    setSettings((current) => ({
      ...current,
      social_links: { ...(current.social_links || {}), [key]: value },
    }));
  };

  const setStat = (index: number, field: "value" | "label", value: string) => {
    const stats = [...(settings.hero_stats || [])];
    stats[index] = { ...stats[index], [field]: value };
    set("hero_stats", stats);
  };

  const addStat = () => set("hero_stats", [...(settings.hero_stats || []), { value: "", label: "" }]);
  const removeStat = (index: number) => set("hero_stats", (settings.hero_stats || []).filter((_, statIndex) => statIndex !== index));

  const updateSkillGroupsText = (value: string) => {
    setSaveError(null);
    setSkillGroupsText(value);

    try {
      const parsed = JSON.parse(value) as Settings["skill_groups"];
      if (!Array.isArray(parsed)) {
        throw new Error("Skill groups must be a JSON array.");
      }
      set("skill_groups", parsed);
      setSkillGroupsError(null);
    } catch (error) {
      setSkillGroupsError(error instanceof Error ? error.message : "Skill groups must be valid JSON.");
    }
  };

  const settingsValidationError = useMemo(() => {
    if (skillGroupsError) return skillGroupsError;
    return null;
  }, [skillGroupsError]);

  const save = async () => {
    if (saving) return;

    if (settingsValidationError) {
      setSaveError(settingsValidationError);
      toast(settingsValidationError, "error");
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await adminApiRequest("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      toast("Settings saved", "success");
    } catch (error) {
      console.error(error);
      const message = getAdminErrorMessage(error, "Failed to save settings.");
      setSaveError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveAiConfig = async () => {
    if (aiSaving || !aiConfig) return;
    setAiSaving(true);
    try {
      await adminApiRequest("/api/admin/ai-config", {
        method: "PUT",
        body: JSON.stringify(aiConfig),
      });
      const fresh = await adminApiRequest<AiConfig>("/api/admin/ai-config");
      setAiConfig(fresh);
      toast("AI configuration saved", "success");
    } catch (error) {
      const message = getAdminErrorMessage(error, "Failed to save AI configuration.");
      toast(message, "error");
    } finally {
      setAiSaving(false);
    }
  };

  const regenerateMcpKey = async () => {
    if (mcpRegenerating) return;
    setMcpRegenerating(true);
    try {
      await adminApiRequest("/api/admin/mcp-config/regenerate", { method: "POST" });
      const fresh = await adminApiRequest<McpConfig>("/api/admin/mcp-config");
      setMcpConfig(fresh);
      toast("MCP API key regenerated. Reconnect your AI tools with the new key.", "success");
    } catch (error) {
      const message = getAdminErrorMessage(error, "Failed to regenerate key.");
      toast(message, "error");
    } finally {
      setMcpRegenerating(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMcpCopied(label);
      toast("Copied to clipboard", "success");
      setTimeout(() => setMcpCopied(null), 2000);
    } catch {
      toast("Failed to copy", "error");
    }
  };

  const aiInputStyle = {
    ...inputStyle,
    fontFamily: "var(--font-mono)",
  };

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Settings
          </h1>
          <button
            onClick={save}
            disabled={saving || loading}
            className="inline-flex min-h-[40px] items-center justify-center self-start rounded-[var(--radius-md)] px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
          >
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            Loading...
          </p>
        ) : pageError ? (
          <div
            className="rounded-[var(--radius-lg)] px-[var(--space-4)] py-[var(--space-4)] text-[var(--text-sm)]"
            style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            Settings are temporarily unavailable. Please refresh and try again.
          </div>
        ) : (
          <>
            <div className="mb-[var(--space-8)] flex gap-0 rounded-[var(--radius-lg)] p-[var(--space-1)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
              {sections.map((section) => {
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className="flex-1 rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-center font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600 transition-all duration-150 whitespace-nowrap"
                    style={{
                      background: active ? "var(--color-accent)" : "transparent",
                      color: active ? "var(--color-accent-on)" : "var(--color-text-secondary)",
                      boxShadow: active ? "0 1px 3px rgba(15, 23, 42, 0.1)" : "none",
                    }}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-[var(--space-6)]">
              {activeSection === "home" && (
                <>
                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Home Page</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Hero Section
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Appears at the top of the home page with your intro text and key highlights.
                      </p>
                    </div>
                    <div className="flex flex-col gap-[var(--space-5)]">
                      <div>
                        <label htmlFor="settings-bio-hero" className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Bio Text</label>
                        <textarea id="settings-bio-hero" value={settings.bio_hero || ""} onChange={(e) => set("bio_hero", e.target.value)} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Stats</label>
                        {(settings.hero_stats || []).map((stat, index) => (
                          <div key={index} className="mb-[var(--space-2)] flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-center">
                            <input value={stat.value} onChange={(e) => setStat(index, "value", e.target.value)} placeholder="Value" className="flex-1 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                            <input value={stat.label} onChange={(e) => setStat(index, "label", e.target.value)} placeholder="Label" className="flex-1 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                            <button onClick={() => removeStat(index)} className="self-start px-1 font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:opacity-80 sm:self-center" style={{ color: "var(--color-error)" }}>x</button>
                          </div>
                        ))}
                        <button onClick={addStat} className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:opacity-80" style={{ color: "var(--color-accent)" }}>+ Add stat</button>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Home Page</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Skills Section
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Skill groups shown on the home page and the about-page sidebar.
                      </p>
                    </div>
                    <textarea
                      id="settings-skill-groups"
                      aria-label="Skill groups JSON"
                      value={skillGroupsText}
                      onChange={(e) => updateSkillGroupsText(e.target.value)}
                      rows={16}
                      className="w-full px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                      style={inputStyle}
                      aria-invalid={!!skillGroupsError}
                    />
                    {skillGroupsError ? (
                      <p className="mt-[var(--space-2)] text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>
                        {skillGroupsError}
                      </p>
                    ) : (
                      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Use a JSON array of groups with `category` and `skills`.
                      </p>
                    )}
                  </section>
                </>
              )}

              {activeSection === "about" && (
                <>
                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>About Page</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Bio Paragraphs
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        The main body text on the about page, up to three paragraphs.
                      </p>
                    </div>
                    <div className="flex flex-col gap-[var(--space-5)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 1</label><textarea value={settings.bio_about_1 || ""} onChange={(e) => set("bio_about_1", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 2</label><textarea value={settings.bio_about_2 || ""} onChange={(e) => set("bio_about_2", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 3</label><textarea value={settings.bio_about_3 || ""} onChange={(e) => set("bio_about_3", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <div className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-lg)] p-[var(--space-5)] sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div>
                      <p className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>Experience Timeline</p>
                      <p className="font-[family-name:var(--font-body)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>Experience timeline entries are managed separately.</p>
                    </div>
                    <a href="/admin/experience" className="inline-flex min-h-[36px] items-center rounded-[var(--radius-md)] px-4 py-2 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-colors" style={{ color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>Go to Experience Editor &rarr;</a>
                  </div>
                </>
              )}

              {activeSection === "site" && (
                 <>
                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Appearance</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Theme
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Choose the visual theme for your website. Changes apply after saving.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-[var(--space-4)]">
                      {([
                        { id: "light-minimal", name: "Light Minimal", desc: "Warm light background with indigo accents and Bricolage headings" },
                        { id: "dark-modern", name: "Dark Modern", desc: "Dark charcoal with indigo accent, cream text, and Bricolage headings" },
                        { id: "mono-editorial", name: "Mono Editorial", desc: "Pure white, true black text, Sora headings — sharp and print-like" },
                      ] as const).map((t) => {
                        const selected = (settings.theme || "light-minimal") === t.id;
                        return (
                          <button
                            key={t.id}
                            onClick={() => set("theme", t.id)}
                            className="text-left rounded-[var(--radius-lg)] p-[var(--space-5)] transition-all duration-150"
                            style={{
                              background: selected ? "var(--color-accent-lightest)" : "var(--color-bg)",
                              border: `2px solid ${selected ? "var(--color-accent)" : "var(--color-border)"}`,
                              boxShadow: selected ? "0 0 0 1px var(--color-accent)" : "none",
                            }}
                          >
                            <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-2)]">
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[var(--text-xs)]"
                                style={{
                                  border: `2px solid ${selected ? "var(--color-accent)" : "var(--color-border-strong)"}`,
                                  background: selected ? "var(--color-accent)" : "transparent",
                                  color: selected ? "var(--color-accent-on)" : "transparent",
                                }}
                              >
                                {selected ? "✓" : ""}
                              </div>
                              <span className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-700" style={{ color: "var(--color-text)" }}>
                                {t.name}
                              </span>
                            </div>
                            <p className="font-[family-name:var(--font-body)] text-[var(--text-xs)] pl-[var(--space-8)]" style={{ color: "var(--color-text-tertiary)" }}>
                              {t.desc}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Site Wide</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Site Info
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Used across all pages for browser title, description, and author name.
                      </p>
                    </div>
                    <div className="flex flex-col gap-[var(--space-5)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Site Title</label><input value={settings.site_title || ""} onChange={(e) => set("site_title", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Logo URL (optional)</label><input value={settings.logo_url || ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="/uploads/logo.webp" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Tagline</label><input value={settings.tagline || ""} onChange={(e) => set("tagline", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Description</label><textarea value={settings.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Author Name</label><input value={settings.author_name || ""} onChange={(e) => set("author_name", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Site Wide</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Social Links
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Shown on the home-page hero card and about-page connect section.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>GitHub</label><input value={settings.social_links?.github || ""} onChange={(e) => setSocial("github", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>LinkedIn</label><input value={settings.social_links?.linkedin || ""} onChange={(e) => setSocial("linkedin", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Twitter</label><input value={settings.social_links?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Email</label><input value={settings.social_links?.email || ""} onChange={(e) => setSocial("email", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)]">
                      <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Site Wide</p>
                      <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                        Announcement Bar
                      </h2>
                      <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        A top banner for launches, updates, or alerts.
                      </p>
                    </div>
                    <div className="flex flex-col gap-[var(--space-5)]">
                      <label className="flex items-center gap-[var(--space-2)]">
                        <input
                          type="checkbox"
                          checked={settings.announcement?.enabled || false}
                          onChange={(e) => set("announcement", { ...(settings.announcement || { text: "", link: "" }), enabled: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500" style={{ color: "var(--color-text)" }}>
                          Show announcement bar
                        </span>
                      </label>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Announcement Text</label><input value={settings.announcement?.text || ""} onChange={(e) => set("announcement", { ...(settings.announcement || { link: "", enabled: false }), text: e.target.value })} placeholder="Join my free webinar on AI agents!" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Link URL (optional)</label><input value={settings.announcement?.link || ""} onChange={(e) => set("announcement", { ...(settings.announcement || { text: "", enabled: false }), link: e.target.value })} placeholder="https://example.com/webinar" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      {settings.announcement?.enabled && settings.announcement?.text ? (
                        <div className="rounded-[var(--radius-md)] p-[var(--space-3)] text-center" style={{ background: "#1a1a1a", color: "#f5f5f5" }}>
                          <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500">{settings.announcement.text}</span>
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)] flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>AI Writer</p>
                        <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                          AI Configuration
                        </h2>
                        <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                          OpenAI-compatible API settings for the AI Blog Studio. Saved securely — the key is never exposed to the frontend.
                        </p>
                      </div>
                      <button
                        onClick={saveAiConfig}
                        disabled={aiSaving}
                        className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
                        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
                      >
                        {aiSaving ? "Saving..." : "Save AI Config"}
                      </button>
                    </div>
                    {aiConfig ? (
                      <div className="flex flex-col gap-[var(--space-5)]">
                        <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
                          <div>
                            <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Provider</label>
                            <select
                              value={aiConfig.provider}
                              onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value })}
                              className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                              style={inputStyle}
                            >
                              <option value="openai-compatible">OpenAI Compatible</option>
                              <option value="disabled">Disabled</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Model</label>
                            <input
                              value={aiConfig.model}
                              onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                              placeholder="gpt-4o"
                              className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                              style={aiInputStyle}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>API Endpoint URL</label>
                          <input
                            value={aiConfig.baseUrl}
                            onChange={(e) => setAiConfig({ ...aiConfig, baseUrl: e.target.value })}
                            placeholder="https://api.openai.com/v1"
                            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                            style={aiInputStyle}
                          />
                        </div>
                        <div>
                          <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>API Key</label>
                          <input
                            type="password"
                            value={aiConfig.apiKeySet ? aiConfig.apiKeyMasked : ""}
                            onChange={(e) => setAiConfig({ ...aiConfig, apiKeyMasked: e.target.value, apiKey: e.target.value })}
                            placeholder={aiConfig.apiKeySet ? "Key is set — enter a new one to replace" : "Enter your API key"}
                            className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                            style={aiInputStyle}
                          />
                          {aiConfig.apiKeySet ? (
                            <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                              Current: {aiConfig.apiKeyMasked}
                            </p>
                          ) : (
                            <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "oklch(55% 0.15 30)" }}>
                              No API key configured. AI features will not work.
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2">
                          <div>
                            <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Temperature ({aiConfig.temperature})</label>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.1"
                              value={aiConfig.temperature}
                              onChange={(e) => setAiConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                              className="w-full"
                              style={{ accentColor: "var(--color-accent)" }}
                            />
                            <div className="flex justify-between font-[family-name:var(--font-mono)] text-[0.625rem]" style={{ color: "var(--color-text-tertiary)" }}>
                              <span>Precise</span>
                              <span>Creative</span>
                            </div>
                          </div>
                          <div>
                            <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Max Tokens</label>
                            <input
                              type="number"
                              value={aiConfig.maxTokens}
                              onChange={(e) => setAiConfig({ ...aiConfig, maxTokens: parseInt(e.target.value) || 6000 })}
                              min={500}
                              max={16000}
                              className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                              style={aiInputStyle}
                            />
                          </div>
                        </div>
                        <div className="rounded-[var(--radius-md)] p-[var(--space-3)] flex items-start gap-[var(--space-2)]" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                          <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>🔒</span>
                          <p className="font-[family-name:var(--font-body)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            Your API key is stored with an internal prefix and never exposed publicly. It is only sent to the backend over an authenticated, admin-only endpoint.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Loading AI configuration...
                      </p>
                    )}
                  </section>

                  {/* ── MCP Server ── */}
                  <section className="rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <div className="mb-[var(--space-5)] flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.2em] mb-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>Integrations</p>
                        <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>
                          MCP Server
                        </h2>
                        <p className="mt-[var(--space-1)] font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                          Connect AI tools (Claude Code, ChatGPT, Cursor) directly to your CMS. {mcpConfig?.toolCount || 59} tools, {mcpConfig?.resourceCount || 6} resources, {mcpConfig?.promptCount || 4} prompts.
                        </p>
                      </div>
                      <button
                        onClick={regenerateMcpKey}
                        disabled={mcpRegenerating || !mcpConfig}
                        className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-md)] px-4 py-2 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:opacity-50 whitespace-nowrap self-start sm:self-auto"
                        style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                      >
                        {mcpRegenerating ? "Regenerating..." : "Regenerate Key"}
                      </button>
                    </div>

                    {mcpConfig ? (
                      <div className="flex flex-col gap-[var(--space-5)]">
                        {/* API Key */}
                        <div>
                          <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>API Key</label>
                          <div className="flex items-center gap-[var(--space-2)]">
                            <code className="flex-1 px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-sm)] rounded-[var(--radius-md)]" style={{ ...inputStyle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {mcpConfig.apiKeyMasked}
                            </code>
                            <button
                              onClick={() => copyToClipboard(mcpConfig.apiKeyMasked, "key")}
                              className="px-3 py-[var(--space-2)] rounded-[var(--radius-md)] font-[family-name:var(--font-body)] text-[var(--text-xs)] font-500 transition-colors"
                              style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}
                            >
                              {mcpCopied === "key" ? "Copied!" : "Copy"}
                            </button>
                          </div>
                          <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            Required for remote connections. Regenerating invalidates all existing connections.
                          </p>
                        </div>

                        {/* Connection URL */}
                        <div>
                          <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Connection URL</label>
                          <code className="block px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-sm)] rounded-[var(--radius-md)] break-all" style={inputStyle}>
                            {mcpConfig.mcpUrl}
                          </code>
                        </div>

                        {/* Quick connect configs */}
                        <div>
                          <p className={`${labelClass} mb-[var(--space-2)]`} style={{ color: "var(--color-text-tertiary)" }}>Quick Connect</p>
                          <div className="flex flex-col gap-[var(--space-3)]">
                            <div className="rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                              <div className="flex items-center justify-between mb-[var(--space-2)]">
                                <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>Cursor / Windsurf / ChatGPT</span>
                                <button
                                  onClick={() => copyToClipboard(mcpConfig.mcpUrl, "cursor")}
                                  className="text-[var(--text-xs)] font-500 transition-colors"
                                  style={{ color: "var(--color-accent)" }}
                                >
                                  {mcpCopied === "cursor" ? "Copied!" : "Copy URL"}
                                </button>
                              </div>
                              <p className="text-[var(--text-xs)] font-[family-name:var(--font-body)]" style={{ color: "var(--color-text-tertiary)" }}>
                                Add as remote MCP server. Set the Authorization header to <code style={{ color: "var(--color-text)" }}>Bearer &lt;your-api-key&gt;</code>.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[var(--radius-md)] p-[var(--space-3)] flex items-start gap-[var(--space-2)]" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
                          <span className="text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>💡</span>
                          <p className="font-[family-name:var(--font-body)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                            The MCP server auto-deploys with your app via Docker. For HTTPS on your VPS, proxy <code>mcp.yourdomain.com/mcp</code> to localhost:3100.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                        Loading MCP configuration...
                      </p>
                    )}
                  </section>
                </>
              )}

              {saveError ? (
                <div className="rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)]" style={{ background: "oklch(95% 0.05 25)", border: "1px solid oklch(90% 0.05 25)", color: "oklch(40% 0.1 25)" }}>
                  {saveError}
                </div>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
