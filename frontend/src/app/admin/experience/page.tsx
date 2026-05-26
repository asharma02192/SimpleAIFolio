"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Experience {
  id: string;
  role: string;
  period: string;
  description: string;
  order: number;
}

const emptyForm = { role: "", period: "", description: "", order: 0 };

export default function AdminExperiencePage() {
  return (
    <AuthProvider>
      <UIProvider>
        <ExperienceContent />
      </UIProvider>
    </AuthProvider>
  );
}

function ExperienceContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Experience | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch("/api/experience")
      .then((r) => r.json())
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (token) load(); }, [token]);

  const startCreate = () => { setEditing(null); setCreating(true); setForm(emptyForm); };
  const startEdit = (e: Experience) => { setCreating(false); setEditing(e); setForm({ role: e.role, period: e.period, description: e.description, order: e.order }); };
  const cancel = () => { setEditing(null); setCreating(false); setForm(emptyForm); };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/api/experience/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      } else {
        await apiFetch("/api/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      }
      cancel(); load();
      toast(editing ? "Experience updated" : "Experience created", "success");
    } catch { toast("Save failed", "error"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this experience entry?"))) return;
    await apiFetch(`/api/experience/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((e) => e.id !== id));
    toast("Experience deleted", "success");
  };

  const inputStyle = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" };
  const labelClass = "font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]";

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)] max-w-[50rem]">
        <div className="flex items-center justify-between mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Experience</h1>
          {!creating && !editing && (
            <button onClick={startCreate} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>+ New Entry</button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>{editing ? "Edit Experience" : "New Experience"}</h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Role</label><input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              <div className="grid grid-cols-2 gap-[var(--space-4)]">
                <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Period</label><input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2024 — Present" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Order</label><input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-20 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              </div>
              <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Description</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              <div className="flex gap-[var(--space-3)]">
                <button onClick={handleSave} disabled={saving || !form.role} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                <button onClick={cancel} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : items.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No experience entries yet.</p>
        ) : (
          <div className="flex flex-col">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-[var(--space-4)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{item.role}</h3>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{item.period}</span>
                </div>
                <div className="flex gap-[var(--space-3)]">
                  <button onClick={() => startEdit(item)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)" }}>Edit</button>
                  <button onClick={() => handleDelete(item.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]" style={{ color: "var(--color-text-tertiary)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
