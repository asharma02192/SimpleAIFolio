"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage, isAdminApiError } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
}

const emptyForm = { name: "", slug: "" };

export default function AdminTagsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <TagsContent />
      </UIProvider>
    </AuthProvider>
  );
}

function TagsContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Tag | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await adminApiRequest<Tag[]>("/api/tags");
      setTags(data);
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Failed to load tags"), "error");
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

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const startCreate = () => {
    setEditing(null);
    setCreating(true);
    setForm(emptyForm);
    setFormError(null);
  };

  const startEdit = (t: Tag) => {
    setCreating(false);
    setEditing(t);
    setForm({ name: t.name, slug: t.slug });
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
    const payload = { name: form.name, slug: form.slug || generateSlug(form.name) };
    try {
      if (editing) {
        await adminApiRequest(`/api/tags/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await adminApiRequest("/api/tags", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      cancel();
      await load();
      toast(editing ? "Tag updated" : "Tag created", "success");
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
    if (!(await confirm("Delete this tag?"))) return;
    setDeletingId(id);
    try {
      await adminApiRequest(`/api/tags/${id}`, { method: "DELETE" });
      await load();
      toast("Tag deleted", "success");
    } catch (err) {
      console.error(err);
      if (isAdminApiError(err) && err.status === 404) {
        await load();
        toast("Tag was already deleted.", "info");
      } else {
        toast(getAdminErrorMessage(err, "Delete failed"), "error");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Tags</h1>
          {!creating && !editing && (
            <button onClick={startCreate} className="inline-flex min-h-[40px] items-center justify-center self-start px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 sm:self-auto" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>+ New Tag</button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>{editing ? "Edit Tag" : "New Tag"}</h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div>
                <label htmlFor="tag-name" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Name</label>
                <input id="tag-name" value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: f.slug || generateSlug(name) })); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label htmlFor="tag-slug" className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Slug</label>
                <input id="tag-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              {formError && (
                <p className="text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap gap-[var(--space-3)]">
                <button onClick={handleSave} disabled={saving || !form.name} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                <button onClick={cancel} disabled={saving} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : tags.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-[var(--space-3)]">
            {tags.map((tag) => (
              <div key={tag.id} className="group flex items-center gap-[var(--space-2)] px-[var(--space-3)] py-[var(--space-2)]" style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)" }}>
                <span className="break-all font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>#{tag.name}</span>
                <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{tag.postCount || 0}</span>
                <div className="ml-1 flex items-center gap-[var(--space-2)]">
                  <button disabled={deletingId === tag.id} onClick={() => startEdit(tag)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] opacity-100 transition-colors hover:text-[var(--color-accent)] md:opacity-0 md:group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50" style={{ color: "var(--color-text-tertiary)" }}>edit</button>
                  <button disabled={deletingId === tag.id} onClick={() => handleDelete(tag.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] opacity-100 transition-colors hover:text-[var(--color-error)] md:opacity-0 md:group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50" style={{ color: "var(--color-text-tertiary)" }}>{deletingId === tag.id ? "..." : "x"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
