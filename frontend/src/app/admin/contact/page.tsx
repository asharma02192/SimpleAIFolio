"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, logoutAdmin } from "@/lib/auth";
import { adminApiRequest, getAdminErrorMessage } from "@/lib/admin-api";
import AdminSidebar from "@/components/admin/Sidebar";
import { AuthProvider } from "@/lib/auth";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function AdminContactPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <ContactContent />
      </UIProvider>
    </AuthProvider>
  );
}

function ContactContent() {
  const { token } = useAuth();
  const { toast, confirm } = useUI();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await adminApiRequest<ContactMessage[]>("/api/admin/contact");
      setMessages(data);
    } catch (err) {
      console.error(err);
      toast(getAdminErrorMessage(err, "Failed to load messages"), "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!token) return;
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [token, load]);

  const markRead = async (id: string) => {
    try {
      await adminApiRequest(`/api/admin/contact/${id}/read`, { method: "PUT" });
      await load();
    } catch (err) {
      toast(getAdminErrorMessage(err, "Failed to mark as read"), "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm("Delete this message?"))) return;
    try {
      await adminApiRequest(`/api/admin/contact/${id}`, { method: "DELETE" });
      await load();
      toast("Message deleted", "success");
    } catch (err) {
      toast(getAdminErrorMessage(err, "Delete failed"), "error");
    }
  };

  const unread = messages.filter((m) => !m.read).length;

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 w-full flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)]">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>Contact Messages</h1>
          {unread > 0 && (
            <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] mt-[var(--space-1)]" style={{ color: "var(--color-accent)" }}>
              {unread} unread
            </p>
          )}
        </div>

        {loading ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>Loading...</p>
        ) : messages.length === 0 ? (
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No messages yet.</p>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="py-[var(--space-4)]"
                style={{
                  borderBottom: "1px solid var(--color-border)",
                  background: msg.read ? "transparent" : "var(--color-bg-subtle)",
                  paddingLeft: "var(--space-2)",
                  borderLeft: msg.read ? "none" : "3px solid var(--color-accent)",
                }}
              >
                <div className="flex items-start justify-between gap-[var(--space-4)]">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
                      <span className="font-[family-name:var(--font-display)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{msg.name}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{msg.email}</span>
                      <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>
                        {new Date(msg.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {msg.subject && (
                      <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 mb-[var(--space-1)]" style={{ color: "var(--color-text-secondary)" }}>{msg.subject}</p>
                    )}
                    <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] whitespace-pre-wrap" style={{ color: "var(--color-text-secondary)" }}>{msg.message}</p>
                  </div>
                  <div className="flex gap-[var(--space-3)] flex-shrink-0">
                    {!msg.read && (
                      <button onClick={() => markRead(msg.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-tertiary)" }}>Mark Read</button>
                    )}
                    <button onClick={() => handleDelete(msg.id)} className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] cursor-pointer transition-colors hover:text-[var(--color-error)]" style={{ color: "var(--color-text-tertiary)" }}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
