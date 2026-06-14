"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AuthProvider, apiFetch, logoutAdmin } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "SCHEDULED";
  publishedAt: string | null;
  createdAt: string;
  category: { name: string } | null;
}

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "SCHEDULED";

function PostsContent() {
  const { toast, confirm } = useUI();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  const fetchPosts = useCallback((p: number, s: StatusFilter, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ status: "all", perPage: String(perPage), page: String(p) });
    if (s !== "ALL") params.set("search", s.toLowerCase());
    if (q) params.set("search", q);
    apiFetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        let filtered = d.data || [];
        if (s !== "ALL") filtered = filtered.filter((post: Post) => post.status === s);
        setPosts(filtered);
        setTotal(d.total || 0);
        setTotalPages(Math.max(1, Math.ceil((d.total || 0) / perPage)));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPosts(page, statusFilter, search);
  }, [page, statusFilter, search, fetchPosts]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id));
  const someSelected = posts.some((p) => selected.has(p.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this post?"))) return;
    await apiFetch(`/api/posts/${id}`, { method: "DELETE" });
    setPosts((p) => p.filter((post) => post.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    toast("Post deleted", "success");
  };

  const handleDeleteSelected = async () => {
    if (!(await confirm(`Delete ${selected.size} post${selected.size !== 1 ? "s" : ""}?`))) return;
    const ids = Array.from(selected);
    await Promise.all(ids.map((id) => apiFetch(`/api/posts/${id}`, { method: "DELETE" })));
    setPosts((p) => p.filter((post) => !selected.has(post.id)));
    const count = selected.size;
    setSelected(new Set());
    toast(`${count} post${count !== 1 ? "s" : ""} deleted`, "success");
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

        {selected.size > 0 && (
          <div
            className="flex items-center gap-[var(--space-4)] mb-[var(--space-6)] px-[var(--space-4)] py-[var(--space-3)]"
            style={{ background: "var(--color-bg-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--color-border)" }}
          >
            <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text)" }}>
              {selected.size} selected
            </span>
            <button
              onClick={handleDeleteSelected}
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              Delete Selected
            </button>
          </div>
        )}

        <div className="mb-[var(--space-4)] flex flex-col gap-[var(--space-3)] sm:flex-row sm:items-center">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setPage(1); }}
            className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] outline-none"
            style={{
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              color: "var(--color-text)",
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="SCHEDULED">Scheduled</option>
          </select>
          <form onSubmit={onSearchSubmit} className="flex-1 flex gap-[var(--space-2)]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search posts..."
              className="flex-1 font-[family-name:var(--font-body)] text-[var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] outline-none"
              style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
            />
            <button type="submit" className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-4 py-[var(--space-2)] transition-colors" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}>
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="flex flex-col gap-[var(--space-3)]">
            {[1,2,3].map((i) => (
              <div key={i} className="h-[60px] rounded-[var(--radius-md)] animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-[var(--space-16)] text-center">
            <p className="text-[var(--text-sm)] mb-[var(--space-4)]" style={{ color: "var(--color-text-tertiary)" }}>
              {search ? `No posts matching "${search}".` : statusFilter !== "ALL" ? `No ${statusFilter.toLowerCase()} posts.` : "No posts yet. Create your first one."}
            </p>
            {statusFilter === "ALL" && (
              <Link
                href="/admin/posts/new"
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider"
                style={{ color: "var(--color-accent)" }}
              >
                New Post &rarr;
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col">
            <div
              className="flex items-center gap-[var(--space-3)] py-[var(--space-2)] px-[var(--space-1)]"
              style={{ borderBottom: "1px solid var(--color-border)" }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={toggleAll}
                className="cursor-pointer"
              />
              <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider" style={{ color: "var(--color-text-tertiary)" }}>
                {total} post{total !== 1 ? "s" : ""}
              </span>
            </div>
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col gap-[var(--space-3)] py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <div className="min-w-0 flex-1 flex items-start gap-[var(--space-3)]">
                  <input
                    type="checkbox"
                    checked={selected.has(post.id)}
                    onChange={() => toggleOne(post.id)}
                    className="mt-1 cursor-pointer flex-shrink-0"
                  />
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
                </div>
                <div className="flex flex-wrap gap-[var(--space-3)] pl-[var(--space-7)] sm:pl-0">
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

        {totalPages > 1 && (
          <div className="mt-[var(--space-6)] flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-4 py-2 transition-colors disabled:opacity-30"
              style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
            >
              ← Prev
            </button>
            <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-4 py-2 transition-colors disabled:opacity-30"
              style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
            >
              Next →
            </button>
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
