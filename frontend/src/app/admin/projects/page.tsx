"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  liveUrl?: string | null;
  githubUrl?: string | null;
  featured: boolean;
  order: number;
}

const emptyForm = {
  title: "",
  description: "",
  techStack: "",
  liveUrl: "",
  githubUrl: "",
  featured: false,
  order: 0,
};

export default function AdminProjectsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <ProjectsContent />
      </UIProvider>
    </AuthProvider>
  );
}

function ProjectsContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (token) load(); }, [token]);

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
  };

  const startEdit = (p: Project) => {
    setCreating(false);
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      techStack: p.techStack.join(", "),
      liveUrl: p.liveUrl || "",
      githubUrl: p.githubUrl || "",
      featured: p.featured,
      order: p.order,
    });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      techStack: form.techStack.split(",").map((s) => s.trim()).filter(Boolean),
      liveUrl: form.liveUrl || null,
      githubUrl: form.githubUrl || null,
      featured: form.featured,
      order: Number(form.order),
    };

    try {
      if (editing) {
        await apiFetch(`/api/projects/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      cancel();
      load();
      toast(editing ? "Project updated" : "Project created", "success");
    } catch (err) {
      console.error(err);
      toast("Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this project?"))) return;
    await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
    toast("Project deleted", "success");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)] max-w-[60rem]">
        <div className="flex items-center justify-between mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Projects
          </h1>
          {!creating && !editing && (
            <button
              onClick={startCreate}
              className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
            >
              + New Project
            </button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>
              {editing ? "Edit Project" : "New Project"}
            </h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Title</label>
                <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Tech Stack (comma-separated)</label>
                <input value={form.techStack} onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))} placeholder="React, Node.js, PostgreSQL" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div className="grid grid-cols-2 gap-[var(--space-4)]">
                <div>
                  <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Live URL</label>
                  <input value={form.liveUrl} onChange={(e) => setForm((f) => ({ ...f, liveUrl: e.target.value }))} placeholder="https://..." className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
                </div>
                <div>
                  <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>GitHub URL</label>
                  <input value={form.githubUrl} onChange={(e) => setForm((f) => ({ ...f, githubUrl: e.target.value }))} placeholder="https://github.com/..." className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-[var(--space-4)]">
                <div className="flex items-center gap-[var(--space-2)]">
                  <input type="checkbox" checked={form.featured} onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))} />
                  <label className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>Featured</label>
                </div>
                <div>
                  <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Sort Order</label>
                  <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-20 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
                </div>
              </div>
              <div className="flex gap-[var(--space-3)] mt-[var(--space-2)]">
                <button onClick={handleSave} disabled={saving || !form.title} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
                <button onClick={cancel} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : projects.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No projects yet.</p>
        ) : (
          <div className="flex flex-col">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between py-[var(--space-4)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="flex-1">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <h3 className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{project.title}</h3>
                    {project.featured && (
                      <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-2)] py-[0.125rem]" style={{ background: "var(--color-accent-lightest)", color: "var(--color-accent)", borderRadius: "var(--radius-sm)" }}>Featured</span>
                    )}
                  </div>
                  <div className="flex gap-[var(--space-2)] mt-[var(--space-1)]">
                    {project.techStack.map((t) => (
                      <span key={t} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-[var(--space-3)]">
                  <button onClick={() => startEdit(project)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)" }}>Edit</button>
                  <button onClick={() => handleDelete(project.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]" style={{ color: "var(--color-text-tertiary)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
