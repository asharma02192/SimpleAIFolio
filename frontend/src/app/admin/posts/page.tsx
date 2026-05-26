"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthProvider, apiFetch } from "@/lib/auth";
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
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)]">
        <div className="flex items-center justify-between mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Posts
          </h1>
          <Link
            href="/admin/posts/new"
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 px-5 py-2.5 transition-all duration-150 cursor-pointer hover:brightness-110"
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
                className="flex items-center justify-between py-[var(--space-4)]"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-1)]">
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
                  <h3 className="text-[var(--text-sm)] font-semibold" style={{ color: "var(--color-text)" }}>
                    {post.title}
                  </h3>
                </div>
                <div className="flex gap-[var(--space-3)]">
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
