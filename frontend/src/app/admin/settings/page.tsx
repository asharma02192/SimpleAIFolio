"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
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
  site_title: "", tagline: "", description: "", author_name: "",
  bio_hero: "", bio_about_1: "", bio_about_2: "", bio_about_3: "",
  social_links: { github: "", linkedin: "", twitter: "", email: "" },
  hero_stats: [{ value: "", label: "" }],
  skill_groups: [],
  announcement: { text: "", link: "", enabled: false },
};

function SettingsContent() {
  const { token } = useAuth();
  const { toast } = useUI();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    if (!token) return;
    apiFetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings({ ...defaultSettings, ...data }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  const set = (key: keyof Settings, value: unknown) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const setSocial = (key: string, value: string) =>
    setSettings((s) => ({ ...s, social_links: { ...(s.social_links || {}), [key]: value } }));

  const setStat = (index: number, field: "value" | "label", val: string) => {
    const stats = [...(settings.hero_stats || [])];
    stats[index] = { ...stats[index], [field]: val };
    set("hero_stats", stats);
  };

  const addStat = () => set("hero_stats", [...(settings.hero_stats || []), { value: "", label: "" }]);
  const removeStat = (i: number) => set("hero_stats", (settings.hero_stats || []).filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Save failed");
      toast("Settings saved", "success");
    } catch (err) {
      toast("Failed to save settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
  };

  const labelClass = "font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]";

  const sections = [
    { id: "home", label: "Home Page" },
    { id: "about", label: "About Page" },
    { id: "site", label: "Site Wide" },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)] max-w-[50rem] overflow-y-auto">
        <div className="flex items-center justify-between mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Settings</h1>
          <button onClick={save} disabled={saving} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>
            {saving ? "Saving..." : "Save All"}
          </button>
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : (
          <>
            {/* Page Tabs */}
            <div className="flex gap-[var(--space-1)] mb-[var(--space-8)] p-[var(--space-1)]" style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-lg)" }}>
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="flex-1 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-[var(--space-4)] py-[var(--space-2)] transition-colors"
                  style={{
                    background: activeSection === s.id ? "var(--color-accent)" : "transparent",
                    color: activeSection === s.id ? "var(--color-accent-on)" : "var(--color-text-secondary)",
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-[var(--space-10)]">

              {/* ===== HOME PAGE ===== */}
              {activeSection === "home" && (
                <>
                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Hero Section</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>Appears at the top of the home page — your intro text and key highlights</p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Bio Text</label><textarea value={settings.bio_hero || ""} onChange={(e) => set("bio_hero", e.target.value)} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div>
                        <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Stats (highlights under your name)</label>
                        {(settings.hero_stats || []).map((stat, i) => (
                          <div key={i} className="flex gap-[var(--space-2)] mb-[var(--space-2)] items-center">
                            <input value={stat.value} onChange={(e) => setStat(i, "value", e.target.value)} placeholder="Value (e.g. Full-Stack)" className="flex-1 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} />
                            <input value={stat.label} onChange={(e) => setStat(i, "label", e.target.value)} placeholder="Label (e.g. Development)" className="flex-1 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} />
                            <button onClick={() => removeStat(i)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-1 cursor-pointer transition-colors hover:opacity-80" style={{ color: "var(--color-error)" }}>x</button>
                          </div>
                        ))}
                        <button onClick={addStat} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mt-[var(--space-1)] cursor-pointer transition-colors hover:opacity-80" style={{ color: "var(--color-accent)" }}>+ Add stat</button>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Skills Section</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>Skill groups shown on the home page (and about page sidebar)</p>
                    <textarea
                      value={JSON.stringify(settings.skill_groups || [], null, 2)}
                      onChange={(e) => { try { set("skill_groups", JSON.parse(e.target.value)); } catch (err) { void err; /* invalid json */ } }}
                      rows={16}
                      className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] font-[family-name:var(--font-mono)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                      style={inputStyle}
                    />
                  </section>
                </>
              )}

              {/* ===== ABOUT PAGE ===== */}
              {activeSection === "about" && (
                <>
                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Bio Paragraphs</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>The main body text on the about page — up to 3 paragraphs</p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 1</label><textarea value={settings.bio_about_1 || ""} onChange={(e) => set("bio_about_1", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 2</label><textarea value={settings.bio_about_2 || ""} onChange={(e) => set("bio_about_2", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Paragraph 3</label><textarea value={settings.bio_about_3 || ""} onChange={(e) => set("bio_about_3", e.target.value)} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <div className="p-[var(--space-4)] flex items-center gap-[var(--space-3)]" style={{ background: "var(--color-bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}>
                    <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                      Experience timeline entries are managed separately.
                    </span>
                    <a href="/admin/experience" className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500" style={{ color: "var(--color-accent)" }}>Go to Experience Editor →</a>
                  </div>
                </>
              )}

              {/* ===== SITE WIDE ===== */}
              {activeSection === "site" && (
                <>
                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Site Info</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>Used across all pages — browser title, meta description, author name</p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Site Title</label><input value={settings.site_title || ""} onChange={(e) => set("site_title", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Tagline</label><input value={settings.tagline || ""} onChange={(e) => set("tagline", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Description</label><textarea value={settings.description || ""} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Author Name</label><input value={settings.author_name || ""} onChange={(e) => set("author_name", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Social Links</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>Shown on home page hero card and about page connect section</p>
                    <div className="grid grid-cols-2 gap-[var(--space-4)]">
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>GitHub</label><input value={settings.social_links?.github || ""} onChange={(e) => setSocial("github", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>LinkedIn</label><input value={settings.social_links?.linkedin || ""} onChange={(e) => setSocial("linkedin", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Twitter</label><input value={settings.social_links?.twitter || ""} onChange={(e) => setSocial("twitter", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Email</label><input value={settings.social_links?.email || ""} onChange={(e) => setSocial("email", e.target.value)} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                    </div>
                  </section>

                  <section>
                    <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-1)]" style={{ color: "var(--color-text)" }}>Announcement Bar</h2>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>A dark banner shown at the very top of every page — great for webinars, launches, or alerts</p>
                    <div className="flex flex-col gap-[var(--space-4)]">
                      <label className="flex items-center gap-[var(--space-2)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.announcement?.enabled || false}
                          onChange={(e) => set("announcement", { ...(settings.announcement || { text: "", link: "" }), enabled: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>Show announcement bar</span>
                      </label>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Announcement Text</label><input value={settings.announcement?.text || ""} onChange={(e) => set("announcement", { ...(settings.announcement || { link: "", enabled: false }), text: e.target.value })} placeholder="Join my free webinar on AI agents!" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Link URL (optional)</label><input value={settings.announcement?.link || ""} onChange={(e) => set("announcement", { ...(settings.announcement || { text: "", enabled: false }), link: e.target.value })} placeholder="https://example.com/webinar" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                      {(settings.announcement?.enabled && settings.announcement?.text) && (
                        <div className="p-[var(--space-3)] text-center" style={{ background: "#1a1a1a", borderRadius: "var(--radius-md)", color: "#f5f5f5" }}>
                          <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500">{settings.announcement.text}</span>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <SettingsContent />
      </UIProvider>
    </AuthProvider>
  );
}
