"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, apiFetch } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";
import AdminSidebar from "@/components/admin/Sidebar";

interface Category { id: string; name: string; slug: string; }
interface Tag { id: string; name: string; slug: string; }
interface PostData {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryId: string;
  tagIds: string[];
  status: "DRAFT" | "PUBLISHED";
  metaTitle: string;
  metaDescription: string;
  featuredImage: string;
}

export default function PostEditorContent({ postId }: { postId?: string }) {
  const { toast } = useUI();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<PostData>({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    categoryId: "",
    tagIds: [],
    status: "DRAFT",
    metaTitle: "",
    metaDescription: "",
    featuredImage: "",
  });

  useEffect(() => {
    apiFetch("/api/categories").then((r) => r.json()).then(setCategories).catch(console.error);
    apiFetch("/api/tags").then((r) => r.json()).then(setTags).catch(console.error);

    if (postId) {
      apiFetch(`/api/posts/admin/${postId}`)
        .then((r) => r.json())
        .then((post) => {
          setForm({
            title: post.title || "",
            slug: post.slug || "",
            excerpt: post.excerpt || "",
            body: post.body || "",
            categoryId: post.categoryId || "",
            tagIds: post.tags?.map((t: Tag) => t.id) || [],
            status: post.status || "DRAFT",
            metaTitle: post.metaTitle || "",
            metaDescription: post.metaDescription || "",
            featuredImage: post.featuredImage || "",
          });
        })
        .catch(console.error);
    }
  }, [postId]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = useCallback(async (status?: "DRAFT" | "PUBLISHED") => {
    if (!form.title.trim()) {
      toast("Title is required", "error");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        slug: form.slug || generateSlug(form.title),
        excerpt: form.excerpt || null,
        body: form.body || "",
        categoryId: form.categoryId || null,
        tagIds: form.tagIds?.length ? form.tagIds : [],
        status: status || form.status,
        featuredImage: form.featuredImage || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      };

      const url = postId ? `/api/posts/${postId}` : "/api/posts";
      const method = postId ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Save failed (${res.status})`);
      }

      const saved = await res.json();
      setLastSaved(new Date().toLocaleTimeString());
      toast("Post saved", "success");
      if (!postId) {
        router.replace(`/admin/posts/${saved.id}/edit`);
      }
    } catch (err) {
      console.error(err);
      toast(err instanceof Error ? err.message : "Failed to save post", "error");
    } finally {
      setSaving(false);
    }
  }, [form, postId, router]);

  // Auto-save every 30s (only if there's a title and existing post)
  useEffect(() => {
    if (!postId) return;
    const interval = setInterval(() => {
      if (form.title.trim() && form.body.trim()) save();
    }, 30000);
    return () => clearInterval(interval);
  }, [form, save, postId]);

  const updateForm = (updates: Partial<PostData>) =>
    setForm((prev) => ({ ...prev, ...updates }));

  return (
    <AuthProvider>
      <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
        <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
        <main className="flex-1 overflow-auto">
          {/* Top bar */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-[var(--space-8)] py-[var(--space-3)]"
            style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex items-center gap-[var(--space-4)]">
              <Link
                href="/admin/posts"
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                &larr; Posts
              </Link>
              <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                {form.status}
              </span>
              {lastSaved && (
                <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                  Saved {lastSaved}
                </span>
              )}
            </div>
            <div className="flex gap-[var(--space-3)]">
              <button
                onClick={() => save("DRAFT")}
                disabled={saving}
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-5 py-2.5 transition-opacity"
                style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => save("PUBLISHED")}
                disabled={saving}
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-5 py-2.5 transition-opacity hover:opacity-90"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
              >
                Publish
              </button>
            </div>
          </div>

          <div className="flex min-h-[calc(100vh-52px)]">
            {/* Main editor */}
            <div className="flex-1 p-[var(--space-8)] max-w-[80ch]">
              {/* Title */}
              <input
                type="text"
                value={form.title}
                onChange={(e) => {
                  updateForm({ title: e.target.value });
                  if (!postId && !form.slug) {
                    updateForm({ slug: generateSlug(e.target.value) });
                  }
                }}
                placeholder="Post title..."
                className="w-full mb-[var(--space-6)] font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-semibold bg-transparent outline-none border-b border-[var(--color-border)] pb-[var(--space-2)]"
                style={{ color: "var(--color-text)" }}
              />

              {/* Slug */}
              <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-6)]">
                <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                  Slug:
                </span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => updateForm({ slug: e.target.value })}
                  className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] bg-transparent outline-none flex-1 focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                />
              </div>

              {/* Excerpt */}
              <textarea
                value={form.excerpt}
                onChange={(e) => updateForm({ excerpt: e.target.value })}
                placeholder="Brief excerpt..."
                rows={2}
                className="w-full mb-[var(--space-6)] text-[var(--text-sm)] p-[var(--space-4)] resize-none outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                style={{ background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text-secondary)" }}
              />

              {/* Body */}
              <textarea
                value={form.body}
                onChange={(e) => updateForm({ body: e.target.value })}
                placeholder="Write your post content here... (HTML supported)"
                rows={20}
                className="w-full text-[var(--text-sm)] p-[var(--space-4)] resize-y outline-none font-[family-name:var(--font-mono)] focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                style={{ background: "var(--color-bg-subtle)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)", minHeight: "400px" }}
              />
            </div>

            {/* Sidebar panel */}
            <div
              className="w-72 flex-shrink-0 p-[var(--space-6)] flex flex-col gap-[var(--space-6)]"
              style={{ borderLeft: "1px solid var(--color-border)", background: "var(--color-bg-elevated)" }}
            >
              {/* Category */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)] block" style={{ color: "var(--color-text-tertiary)" }}>
                  Category
                </label>
                <select
                  value={form.categoryId}
                  onChange={(e) => updateForm({ categoryId: e.target.value })}
                  className="w-full text-[var(--text-sm)] p-[var(--space-2)] min-h-[40px] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
                >
                  <option value="">None</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)] block" style={{ color: "var(--color-text-tertiary)" }}>
                  Tags
                </label>
                <div className="flex flex-col gap-[var(--space-1)]">
                  {tags.map((t) => (
                    <label key={t.id} className="flex items-center gap-[var(--space-2)] text-[var(--text-sm)] cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
                      <input
                        type="checkbox"
                        checked={form.tagIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            updateForm({ tagIds: [...form.tagIds, t.id] });
                          } else {
                            updateForm({ tagIds: form.tagIds.filter((id) => id !== t.id) });
                          }
                        }}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* SEO */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)] block" style={{ color: "var(--color-text-tertiary)" }}>
                  SEO
                </label>
                <input
                  type="text"
                  value={form.metaTitle}
                  onChange={(e) => updateForm({ metaTitle: e.target.value })}
                  placeholder="Meta title"
                  className="w-full text-[var(--text-sm)] p-[var(--space-2)] mb-[var(--space-2)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
                />
                <textarea
                  value={form.metaDescription}
                  onChange={(e) => updateForm({ metaDescription: e.target.value })}
                  placeholder="Meta description"
                  rows={3}
                  className="w-full text-[var(--text-sm)] p-[var(--space-2)] resize-none outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
                />
              </div>

              {/* Featured image URL */}
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)] block" style={{ color: "var(--color-text-tertiary)" }}>
                  Featured Image URL
                </label>
                <input
                  type="text"
                  value={form.featuredImage}
                  onChange={(e) => updateForm({ featuredImage: e.target.value })}
                  placeholder="/uploads/image.webp"
                  className="w-full text-[var(--text-sm)] p-[var(--space-2)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
