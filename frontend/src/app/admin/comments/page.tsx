"use client";

import { useEffect, useState, useCallback } from "react";
import { AuthProvider, apiFetch, logoutAdmin } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Comment {
  id: string;
  author: string;
  content: string;
  status: string;
  createdAt: string;
  post: { id: string; title: string; slug: string } | null;
}

function CommentsContent() {
  const { toast, confirm } = useUI();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  const fetchComments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (statusFilter !== "all") params.set("status", statusFilter);
    apiFetch(`/api/admin/comments?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setComments(d.data || []);
        setTotal(d.total || 0);
        setTotalPages(d.totalPages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { void fetchComments(); }, [page, statusFilter, fetchComments]);

  const updateStatus = async (id: string, status: string) => {
    await apiFetch(`/api/admin/comments/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    fetchComments();
    toast(`Comment ${status}`, "success");
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this comment?"))) return;
    await apiFetch(`/api/admin/comments/${id}`, { method: "DELETE" });
    fetchComments();
    toast("Comment deleted", "success");
  };

  const statusColors: Record<string, string> = {
    approved: "var(--color-accent)",
    pending: "oklch(70% 0.15 80)",
    spam: "oklch(60% 0.2 25)",
  };

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <h1 className="mb-[var(--space-8)] font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
          Comments
        </h1>

        <div className="mb-[var(--space-4)]">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-[var(--space-3)] py-[var(--space-2)] outline-none"
            style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}
          >
            <option value="all">All Comments</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
            <option value="spam">Spam</option>
          </select>
        </div>

        {loading ? (
          <div className="flex flex-col gap-[var(--space-3)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[80px] rounded-[var(--radius-md)] animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="py-[var(--space-16)] text-center font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
            No comments found.
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-3)]">
            {comments.map((c) => (
              <div key={c.id} className="rounded-[var(--radius-md)] p-[var(--space-4)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)] mb-[var(--space-2)]">
                  <div className="flex items-center gap-[var(--space-3)]">
                    <span className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{c.author}</span>
                    <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "var(--color-bg)", color: statusColors[c.status] || "var(--color-text-tertiary)" }}>
                      {c.status}
                    </span>
                  </div>
                  <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] mb-[var(--space-2)]" style={{ color: "var(--color-text-secondary)" }}>
                  {c.content}
                </p>
                {c.post && (
                  <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mb-[var(--space-3)]" style={{ color: "var(--color-text-tertiary)" }}>
                    On: {c.post.title}
                  </p>
                )}
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {c.status !== "approved" && (
                    <button onClick={() => updateStatus(c.id, "approved")} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-3 py-1 rounded-[var(--radius-sm)] transition-colors" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}>
                      Approve
                    </button>
                  )}
                  {c.status !== "pending" && (
                    <button onClick={() => updateStatus(c.id, "pending")} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-3 py-1 rounded-[var(--radius-sm)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-text)" }}>
                      Unapprove
                    </button>
                  )}
                  {c.status !== "spam" && (
                    <button onClick={() => updateStatus(c.id, "spam")} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-3 py-1 rounded-[var(--radius-sm)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "oklch(55% 0.15 25)" }}>
                      Mark Spam
                    </button>
                  )}
                  <button onClick={() => handleDelete(c.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-3 py-1 rounded-[var(--radius-sm)] transition-colors" style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", color: "var(--color-error)" }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-[var(--space-6)] flex items-center justify-between">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-4 py-2 transition-colors disabled:opacity-30" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}>
              ← Prev
            </button>
            <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
              Page {page} of {totalPages} ({total} total)
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] px-4 py-2 transition-colors disabled:opacity-30" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" }}>
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminCommentsPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <CommentsContent />
      </UIProvider>
    </AuthProvider>
  );
}
