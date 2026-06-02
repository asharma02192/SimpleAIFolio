"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AuthProvider, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { useUI } from "@/components/admin/Toast";
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
  ogImage: string;
}

export default function PostEditorContent({ postId }: { postId?: string }) {
  const { toast } = useUI();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editorError, setEditorError] = useState<string | null>(null);
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
    ogImage: "",
  });

  useEffect(() => {
    adminApiRequest<Category[]>("/api/categories")
      .then(setCategories)
      .catch((err) => {
        console.error(err);
        toast(getAdminErrorMessage(err, "Failed to load categories"), "error");
      });
    adminApiRequest<Tag[]>("/api/tags")
      .then(setTags)
      .catch((err) => {
        console.error(err);
        toast(getAdminErrorMessage(err, "Failed to load tags"), "error");
      });

    if (postId) {
      adminApiRequest<Record<string, unknown>>(`/api/posts/admin/${postId}`)
        .then((post) => {
          setForm({
            title: (post.title as string) || "",
            slug: (post.slug as string) || "",
            excerpt: (post.excerpt as string) || "",
            body: (post.body as string) || "",
            categoryId: (post.categoryId as string) || "",
            tagIds: Array.isArray(post.tags) ? (post.tags as Tag[]).map((t) => t.id) : [],
            status: (post.status as "DRAFT" | "PUBLISHED") || "DRAFT",
            metaTitle: (post.metaTitle as string) || "",
            metaDescription: (post.metaDescription as string) || "",
            featuredImage: (post.featuredImage as string) || "",
            ogImage: (post.ogImage as string) || "",
          });
        })
        .catch((err) => {
          console.error(err);
          toast(getAdminErrorMessage(err, "Failed to load post"), "error");
        });
    }
  }, [postId, toast]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const save = useCallback(async (status?: "DRAFT" | "PUBLISHED") => {
    if (saving) return;

    if (!form.title.trim()) {
      setEditorError("Title is required");
      toast("Title is required", "error");
      return;
    }
    setSaving(true);
    setEditorError(null);
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
        ogImage: form.ogImage || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      };

      const url = postId ? `/api/posts/${postId}` : "/api/posts";
      const saved = await adminApiRequest<{ id?: string }>(url, {
        method: postId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setLastSaved(new Date().toLocaleTimeString());
      toast("Post saved", "success");
      if (!postId && saved.id) {
        await new Promise((r) => setTimeout(r, 1000));
        window.location.href = `/admin/posts/${saved.id}/edit`;
      }
    } catch (err) {
      console.error(err);
      const message = getAdminErrorMessage(err, "Failed to save post");
      setEditorError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }, [form, postId, saving, toast]);

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
      <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
        <AdminSidebar onLogout={logoutAdmin} />
        <main className="min-w-0 flex-1 overflow-x-hidden">
          {/* Top bar */}
          <div
            className="sticky top-[57px] z-20 flex flex-col items-start justify-between gap-[var(--space-3)] px-[var(--space-4)] py-[var(--space-3)] sm:flex-row sm:items-center sm:px-[var(--space-6)] md:top-0 md:px-[var(--space-8)]"
            style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}
          >
            <div className="flex flex-wrap items-center gap-[var(--space-2)] sm:gap-[var(--space-4)]">
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
              {editorError && (
                <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-error)" }}>
                  {editorError}
                </span>
              )}
            </div>
            <div className="flex w-full flex-wrap gap-[var(--space-3)] sm:w-auto">
              <button
                onClick={() => save("DRAFT")}
                disabled={saving}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center px-5 py-2.5 font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider transition-opacity sm:flex-none"
                style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => save("PUBLISHED")}
                disabled={saving}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center px-5 py-2.5 font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider transition-opacity hover:opacity-90 sm:flex-none"
                style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
              >
                Publish
              </button>
            </div>
          </div>

          <div className="flex min-h-[calc(100vh-52px)] flex-col xl:flex-row">
            {/* Main editor */}
            <div className="min-w-0 flex-1 p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)] xl:max-w-[80ch]">
              {/* Title */}
              <input
                type="text"
                value={form.title}
                onChange={(e) => {
                  const newTitle = e.target.value;
                  if (editorError) setEditorError(null);
                  updateForm({ title: newTitle });
                  if (!postId) {
                    updateForm({ slug: generateSlug(newTitle) });
                  }
                }}
                placeholder="Post title..."
                className="w-full mb-[var(--space-6)] font-[family-name:var(--font-display)] text-[var(--text-2xl)] font-semibold bg-transparent outline-none border-b border-[var(--color-border)] pb-[var(--space-2)]"
                style={{ color: "var(--color-text)" }}
              />

              {/* Slug */}
              <div className="mb-[var(--space-6)] flex flex-col gap-[var(--space-2)] sm:flex-row sm:items-center">
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
              <RichTextEditor
                content={form.body}
                onChange={(html) => updateForm({ body: html })}
              />
            </div>

            {/* Sidebar panel */}
            <div
              className="w-full flex-shrink-0 border-t p-[var(--space-4)] sm:p-[var(--space-6)] xl:w-72 xl:border-t-0 xl:border-l"
              style={{ borderColor: "var(--color-border)", background: "var(--color-bg-elevated)" }}
            >
              <div className="flex flex-col gap-[var(--space-6)]">
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
              <div>
                <label className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-2)] block" style={{ color: "var(--color-text-tertiary)" }}>
                  OG Image URL
                </label>
                <input
                  type="text"
                  value={form.ogImage}
                  onChange={(e) => updateForm({ ogImage: e.target.value })}
                  placeholder="/uploads/og-image.webp"
                  className="w-full text-[var(--text-sm)] p-[var(--space-2)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
                  style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", color: "var(--color-text)" }}
                />
              </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
