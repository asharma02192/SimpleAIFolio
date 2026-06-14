"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export default function AdminNewsletterPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <NewsletterContent />
      </UIProvider>
    </AuthProvider>
  );
}

function NewsletterContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await adminApiRequest<Subscriber[]>("/api/admin/newsletter");
      setSubscribers(data);
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Failed to load subscribers"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [token, load]);

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this subscriber?"))) return;
    try {
      await adminApiRequest(`/api/admin/newsletter/${id}`, { method: "DELETE" });
      await load();
      toast("Subscriber deleted", "success");
    } catch (err) {
      toast(getAdminErrorMessage(err, "Delete failed"), "error");
    }
  };

  const activeCount = subscribers.filter((s) => s.active).length;

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Newsletter Subscribers</h1>
          {subscribers.length > 0 && (
            <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mt-[var(--space-1)]" style={{ color: "var(--color-text-tertiary)" }}>
              {activeCount} active of {subscribers.length} total
            </p>
          )}
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : subscribers.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No subscribers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--color-border)" }}>
                  <th className="text-left font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text-tertiary)" }}>Email</th>
                  <th className="text-left font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text-tertiary)" }}>Subscribed</th>
                  <th className="text-left font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text-tertiary)" }}>Status</th>
                  <th className="text-right font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text-tertiary)" }}></th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="font-[family-name:var(--font-body)] text-[var(--text-sm)] py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text)" }}>{sub.email}</td>
                    <td className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] py-[var(--space-3)] px-[var(--space-2)]" style={{ color: "var(--color-text-tertiary)" }}>
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-[var(--space-3)] px-[var(--space-2)]">
                      <span
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-2)] py-[0.125rem]"
                        style={{
                          background: sub.active ? "var(--color-accent-lightest)" : "var(--color-bg-muted)",
                          color: sub.active ? "var(--color-accent)" : "var(--color-text-tertiary)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        {sub.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-right py-[var(--space-3)] px-[var(--space-2)]">
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
