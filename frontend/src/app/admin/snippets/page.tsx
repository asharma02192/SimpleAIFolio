"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage, isAdminApiError } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface ScriptSnippet {
  id: string;
  name: string;
  location: string;
  code: string;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = { name: "", location: "head", code: "", enabled: true, order: 0 };

export default function AdminSnippetsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <SnippetsContent />
      </UIProvider>
    </AuthProvider>
  );
}

function SnippetsContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [snippets, setSnippets] = useState<ScriptSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScriptSnippet | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApiRequest<ScriptSnippet[]>("/api/admin/snippets");
      setSnippets(data);
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Failed to load snippets"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [token, load]);

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setFormError(null);
  };

  const startEdit = (s: ScriptSnippet) => {
    setCreating(false);
    setEditing(s);
    setForm({ name: s.name, location: s.location, code: s.code, enabled: s.enabled, order: s.order });
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
    const payload = { name: form.name, location: form.location, code: form.code, enabled: form.enabled, order: form.order };
    try {
      if (editing) {
        await adminApiRequest(`/api/admin/snippets/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await adminApiRequest("/api/admin/snippets", { method: "POST", body: JSON.stringify(payload) });
      }
      cancel();
      await load();
      toast(editing ? "Snippet updated" : "Snippet created", "success");
    } catch (err) {
      console.error(err);
      const message = getAdminErrorMessage(err, "Save failed");
      setFormError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (s: ScriptSnippet) => {
    try {
      await adminApiRequest(`/api/admin/snippets/${s.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      await load();
      toast(s.enabled ? "Snippet disabled" : "Snippet enabled", "success");
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Toggle failed"), "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    if (!(await confirm("Delete this snippet?"))) return;
    setDeletingId(id);
    try {
      await adminApiRequest(`/api/admin/snippets/${id}`, { method: "DELETE" });
      await load();
      toast("Snippet deleted", "success");
    } catch (err) {
      console.error(err);
      if (isAdminApiError(err) && err.status === 404) {
        await load();
        toast("Snippet was already deleted.", "info");
      } else {
        toast(getAdminErrorMessage(err, "Delete failed"), "error");
      }
    } finally {
      setDeletingId(null);
    }
  };

  const inputStyle = {
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-text)",
  };

  const labelStyle = {
    color: "var(--color-text-tertiary)",
  };

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Script Snippets</h1>
            <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mt-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>
              Manage tracking pixels &amp; third-party scripts (Facebook Pixel, Google Analytics, etc.)
            </p>
          </div>
          {!creating && !editing && (
            <button onClick={startCreate} className="inline-flex min-h-[40px] items-center justify-center self-start px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 sm:self-auto" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)" }}>+ New Snippet</button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>{editing ? "Edit Snippet" : "New Snippet"}</h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div className="flex flex-col sm:flex-row gap-[var(--space-4)]">
                <div className="flex-1">
                  <label htmlFor="snippet-name" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={labelStyle}>Name</label>
                  <input id="snippet-name" placeholder="e.g. Facebook Pixel" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                </div>
                <div className="w-full sm:w-40">
                  <label htmlFor="snippet-location" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={labelStyle}>Location</label>
                  <select id="snippet-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle}>
                    <option value="head">&lt;head&gt;</option>
                    <option value="body_end">End of &lt;body&gt;</option>
                  </select>
                </div>
                <div className="w-full sm:w-24">
                  <label htmlFor="snippet-order" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={labelStyle}>Order</label>
                  <input id="snippet-order" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors" style={inputStyle} />
                </div>
              </div>
              <div>
                <label htmlFor="snippet-code" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={labelStyle}>Code (raw HTML/JS)</label>
                <textarea
                  id="snippet-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  rows={10}
                  placeholder={'<!-- Facebook Pixel -->\n<script>\n  fbq("init", "YOUR_PIXEL_ID");\n  fbq("track", "PageView");\n</script>\n<noscript>\n  <img height="1" width="1" src="..." />\n</noscript>'}
                  className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] font-[family-name:var(--font-mono)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 transition-colors"
                  style={{ ...inputStyle, minHeight: "200px" }}
                />
              </div>
              <div className="flex items-center gap-[var(--space-2)]">
                <input
                  id="snippet-enabled"
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="h-4 w-4"
                />
                <label htmlFor="snippet-enabled" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={labelStyle}>Enabled</label>
              </div>
              {formError && (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>{formError}</p>
              )}
              <div className="flex flex-wrap gap-[var(--space-3)]">
                <button onClick={handleSave} disabled={saving || !form.name || !form.code} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                <button onClick={cancel} disabled={saving} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : snippets.length === 0 ? (
          <div className="p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No snippets yet. Add your first tracking pixel or script.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {snippets.map((s) => (
              <div key={s.id} className="flex flex-col gap-[var(--space-3)] py-[var(--space-4)] sm:flex-row sm:items-start sm:justify-between" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
                    <h3 className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{s.name}</h3>
                    <span className="font-[family-name:var(--font-mono)] text-[0.625rem] px-[var(--space-2)] py-0.5 rounded-full" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-tertiary)" }}>{s.location === "head" ? "<head>" : "</body>"}</span>
                    {!s.enabled && (
                      <span className="font-[family-name:var(--font-mono)] text-[0.625rem] px-[var(--space-2)] py-0.5 rounded-full" style={{ background: "var(--color-bg-muted)", color: "var(--color-text-tertiary)" }}>disabled</span>
                    )}
                  </div>
                  <pre className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] whitespace-pre-wrap break-all line-clamp-2" style={{ color: "var(--color-text-tertiary)", maxHeight: "3em", overflow: "hidden" }}>{s.code}</pre>
                </div>
                <div className="flex flex-wrap gap-[var(--space-3)] flex-shrink-0">
                  <button onClick={() => handleToggle(s)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors" style={{ color: s.enabled ? "var(--color-text-tertiary)" : "var(--color-accent)" }}>{s.enabled ? "Disable" : "Enable"}</button>
                  <button disabled={deletingId === s.id} onClick={() => startEdit(s)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)" }}>Edit</button>
                  <button disabled={deletingId === s.id} onClick={() => handleDelete(s.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)" }}>{deletingId === s.id ? "Deleting..." : "Delete"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
