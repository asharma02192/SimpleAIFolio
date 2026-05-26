"use client";

import { useState, useEffect } from "react";
import { useAuth, apiFetch } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  postCount?: number;
}

const emptyForm = { name: "", slug: "", description: "" };

export default function AdminCategoriesPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <CategoriesContent />
      </UIProvider>
    </AuthProvider>
  );
}

function CategoriesContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch("/api/categories")
      .then((r) => r.json())
      .then(setCategories)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (token) load(); }, [token]);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const startCreate = () => { setEditing(null); setCreating(true); setForm(emptyForm); };

  const startEdit = (c: Category) => {
    setCreating(false);
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, description: c.description || "" });
  };

  const cancel = () => { setEditing(null); setCreating(false); setForm(emptyForm); };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: form.name,
      slug: form.slug || generateSlug(form.name),
      description: form.description || null,
    };
    try {
      if (editing) {
        await apiFetch(`/api/categories/${editing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/categories", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
      }
      cancel(); load(); toast(editing ? "Category updated" : "Category created", "success");
    } catch (err) { console.error(err); toast("Save failed", "error"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this category?"))) return;
    await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
    setCategories((prev) => prev.filter((c) => c.id !== id));
    toast("Category deleted", "success");
  };

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)] max-w-[50rem]">
        <div className="flex items-center justify-between mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Categories</h1>
          {!creating && !editing && (
            <button onClick={startCreate} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>+ New Category</button>
          )}
        </div>

        {(creating || editing) && (
          <div className="mb-[var(--space-8)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
            <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>{editing ? "Edit Category" : "New Category"}</h2>
            <div className="flex flex-col gap-[var(--space-4)]">
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Name</label>
                <input value={form.name} onChange={(e) => { const name = e.target.value; setForm((f) => ({ ...f, name, slug: f.slug || generateSlug(name) })); }} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Slug</label>
                <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider block mb-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }} />
              </div>
              <div className="flex gap-[var(--space-3)]">
                <button onClick={handleSave} disabled={saving || !form.name} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}>{saving ? "Saving..." : editing ? "Update" : "Create"}</button>
                <button onClick={cancel} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-colors cursor-pointer hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)", minHeight: "40px" }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : categories.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No categories yet.</p>
        ) : (
          <div className="flex flex-col">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between py-[var(--space-4)]" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <div>
                  <h3 className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{cat.name}</h3>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{cat.slug} &middot; {cat.postCount || 0} posts</span>
                </div>
                <div className="flex gap-[var(--space-3)]">
                  <button onClick={() => startEdit(cat)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)" }}>Edit</button>
                  <button onClick={() => handleDelete(cat.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]" style={{ color: "var(--color-text-tertiary)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
