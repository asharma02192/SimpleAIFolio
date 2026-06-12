"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, apiFetch, logoutAdmin } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  createdAt: string;
  category: { name: string } | null;
}

function PostsContent() {
  const { toast, confirm } = useUI();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/posts?status=all&perPage=100")
      .then((r) => r.json())
      .then((d) => setPosts(d.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this post?"))) return;
    await apiFetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((p) => p.filter((post) => post.id !== id));
    toast("Post deleted", "success");
  };

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Posts
          </h1>
          <Link
            href="/admin/posts/new"
            className="inline-flex min-h-[40px] items-center justify-center self-start px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 sm:self-auto"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
          >
            New Post
          </Link>
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : posts.length === 0 ? (
          <div className="py-[var(--space-16)] text-center">
            <p className="text-[var(--text-sm)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>
              No posts yet. Create your first one.
            </p>
            <Link
              href="/admin/posts/new"
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider"
              style={{ color: "var(--color-accent)" }}
            >
              New Post &rarr;
            </Link>
          </div>
        ) : (
          <div className="flex flex-col">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col gap-[var(--space-3)] py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-[var(--space-1)] flex flex-wrap items-center gap-[var(--space-2)] sm:gap-[var(--space-3)]">
                    <span
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-2)] py-[0.125rem]"
                      style={{
                        background: post.status === "PUBLISHED" ? "var(--color-accent-lightest)" : "var(--color-bg-muted)",
                        color: post.status === "PUBLISHED" ? "var(--color-accent)" : "var(--color-text-tertiary)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      {post.status}
                    </span>
                    {post.category && (
                      <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                        {post.category.name}
                      </span>
                    )}
                  </div>
                  <h3 className="break-words text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                    {post.title}
                  </h3>
                </div>
                <div className="flex flex-wrap gap-[var(--space-3)]">
                  <Link
                    href={`/admin/posts/${post.id}/edit`}
                    className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[var(--color-accent)]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[var(--color-error)]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminPostsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <PostsContent />
      </UIProvider>
    </AuthProvider>
  );
}
