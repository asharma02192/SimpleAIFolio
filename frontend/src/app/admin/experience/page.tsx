"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage, isAdminApiError } from "@/lib/admin-api";
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApiRequest<Experience[]>("/api/experience");
      setItems(data);
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Failed to load experience"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;

    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [token, load]);

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setFormError(null);
  };

  const startEdit = (item: Experience) => {
    setCreating(false);
    setEditing(item);
    setForm({
      role: item.role,
      period: item.period,
      description: item.description,
      order: item.order,
    });
    setFormError(null);
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await adminApiRequest(`/api/experience/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
      } else {
        await adminApiRequest("/api/experience", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }

      cancel();
      await load();
      toast(editing ? "Experience updated" : "Experience created", "success");
    } catch (err) {
      console.error(err);
      const message = getAdminErrorMessage(err, "Save failed");
      setFormError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    if (!(await confirm("Delete this experience entry?"))) return;

    setDeletingId(id);
    try {
      await adminApiRequest(`/api/experience/${id}`, { method: "DELETE" });
      await load();
      toast("Experience deleted", "success");
    } catch (err) {
      console.error(err);
      if (isAdminApiError(err) && err.status === 404) {
        await load();
        toast("Experience entry was already deleted.", "info");
      } else {
        toast(getAdminErrorMessage(err, "Delete failed"), "error");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const inputStyle = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" };
  const labelClass = "font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]";

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Experience</h1>
          {!creating && !editing && (
            <button onClick={startCreate} className="inline-flex min-h-[40px] items-center justify-center self-start px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 sm:self-auto" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>+ New Entry</button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>{editing ? "Edit Experience" : "New Experience"}</h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Role</label><input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
                <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Period</label><input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} placeholder="2024 - Present" className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
                <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Order</label><input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} className="w-20 px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              </div>
              <div><label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Description</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={inputStyle} /></div>
              {formError && (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap gap-[var(--space-3)]">
                <button onClick={handleSave} disabled={saving || !form.role} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                <button onClick={cancel} disabled={saving} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>Cancel</button>
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
              <div key={item.id} className="flex flex-col gap-[var(--space-3)] py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{item.role}</h3>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{item.period}</span>
                </div>
                <div className="flex flex-wrap gap-[var(--space-3)]">
                  <button disabled={deletingId === item.id} onClick={() => startEdit(item)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)" }}>Edit</button>
                  <button disabled={deletingId === item.id} onClick={() => handleDelete(item.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)" }}>{deletingId === item.id ? "Deleting..." : "Delete"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
