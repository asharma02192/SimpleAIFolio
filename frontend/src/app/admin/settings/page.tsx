"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthProvider, logoutAdmin, useAuth } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Settings {
  site_title?: string;
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
}

const defaultSettings: Settings = {
  site_title: "",
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
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
            <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-2)] rounded-[var(--radius-lg)] p-[var(--space-1)] sm:flex-row sm:flex-wrap" style={{ background: "var(--color-bg-elevated)" }}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="rounded-[var(--radius-md)] px-[var(--space-4)] py-[var(--space-2)] text-left font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-colors sm:flex-1 sm:text-center"
                  style={{
                    background: activeSection === section.id ? "var(--color-accent)" : "transparent",
                    color: activeSection === section.id ? "var(--color-accent-on)" : "var(--color-text-secondary)",
                  }}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-[var(--space-10)]">
              {activeSection === "home" && (
                <>
                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Hero Section
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Appears at the top of the home page with your intro text and key highlights.
                    </p>
                    <div className="flex flex-col gap-[var(--space-4)]">
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

                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Skills Section
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Skill groups shown on the home page and the about-page sidebar.
                    </p>
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
                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Bio Paragraphs
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      The main body text on the about page, up to three paragraphs.
                    </p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 1</label><textarea value={settings.bio_about_1 || ""} onChange={(e) => set("bio_about_1", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 2</label><textarea value={settings.bio_about_2 || ""} onChange={(e) => set("bio_about_2", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 3</label><textarea value={settings.bio_about_3 || ""} onChange={(e) => set("bio_about_3", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <div className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-4)] sm:flex-row sm:items-center" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                    <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Experience timeline entries are managed separately.
                    </span>
                    <a href="/admin/experience" className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500" style={{ color: "var(--color-accent)" }}>Go to Experience Editor &rarr;</a>
                  </div>
                </>
              )}

              {activeSection === "site" && (
                <>
                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Site Info
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Used across all pages for browser title, description, and author name.
                    </p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Site Title</label><input value={settings.site_title || ""} onChange={(e) => set("site_title", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Tagline</label><input value={settings.tagline || ""} onChange={(e) => set("tagline", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Description</label><textarea value={settings.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Author Name</label><input value={settings.author_name || ""} onChange={(e) => set("author_name", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Social Links
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Shown on the home-page hero card and about-page connect section.
                    </p>
                    <div className="grid grid-cols-1 gap-[var(--space-4)] sm:grid-cols-2">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>GitHub</label><input value={settings.social_links?.github || ""} onChange={(e) => setSocial("github", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>LinkedIn</label><input value={settings.social_links?.linkedin || ""} onChange={(e) => setSocial("linkedin", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Twitter</label><input value={settings.social_links?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Email</label><input value={settings.social_links?.email || ""} onChange={(e) => setSocial("email", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section>
                    <h2 className="mb-[var(--space-1)] font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>
                      Announcement Bar
                    </h2>
                    <p className="mb-[var(--space-4)] font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      A top banner for launches, updates, or alerts.
                    </p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <label className="flex items-center gap-[var(--space-2)]">
                        <input
                          type="checkbox"
                          checked={settings.announcement?.enabled || false}
                          onChange={(e) => set("announcement", { ...(settings.announcement || { text: "", link: "" }), enabled: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>
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
                </>
              )}

              {saveError ? (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>
                  {saveError}
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
