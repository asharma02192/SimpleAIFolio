"use client";

import { useEffect, useState } from "react";
import { AuthProvider, apiFetch, logoutAdmin, useAuth } from "@/lib/auth";
import AdminSidebar from "@/components/admin/Sidebar";
import { UIProvider, useUI } from "@/components/admin/Toast";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

function UsersContent() {
  const { toast, confirm } = useUI();
  const { userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "author" });
  const [saving, setSaving] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    apiFetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAdd = async () => {
    if (saving) return;
    if (form.password.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(form) });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Failed to create user", "error");
        return;
      }
      toast("User created", "success");
      setForm({ name: "", email: "", password: "", role: "author" });
      setShowAddForm(false);
      fetchUsers();
    } catch {
      toast("Failed to create user", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (id: string, role: string) => {
    try {
      await apiFetch(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify({ role }) });
      toast("Role updated", "success");
      fetchUsers();
    } catch {
      toast("Failed to update role", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm(`Delete user "${name}"? Their posts will be reassigned.`))) return;
    await apiFetch(`/api/admin/users/${id}`, { method: "DELETE" });
    toast("User deleted", "success");
    fetchUsers();
  };

  const roleColors: Record<string, string> = {
    admin: "var(--color-accent)",
    editor: "oklch(60% 0.12 250)",
    author: "oklch(60% 0.12 145)",
  };

  const inputStyle = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", color: "var(--color-text)" };
  const labelClass = "mb-[var(--space-1)] block font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider";

  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <div className="mb-[var(--space-8)] flex flex-col gap-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold" style={{ color: "var(--color-text)" }}>
            Users
          </h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex min-h-[40px] items-center justify-center self-start px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 sm:self-auto"
            style={{ background: "var(--color-accent)", color: "var(--color-accent-on)", borderRadius: "var(--radius-md)", minHeight: "40px" }}
          >
            {showAddForm ? "Cancel" : "Add User"}
          </button>
        </div>

        {showAddForm && (
          <div className="mb-[var(--space-6)] rounded-[var(--radius-lg)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
            <h2 className="mb-[var(--space-4)] font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700" style={{ color: "var(--color-text)" }}>New User</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[var(--space-4)]">
              <div>
                <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Password (min 8 chars)</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30" style={inputStyle} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-text-tertiary)" }}>Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] outline-none" style={inputStyle}>
                  <option value="admin">Admin — Full access</option>
                  <option value="editor">Editor — Posts, projects, media, comments</option>
                  <option value="author">Author — Create/edit own posts</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !form.name || !form.email || !form.password}
              className="mt-[var(--space-4)] inline-flex min-h-[40px] items-center justify-center rounded-[var(--radius-md)] px-5 py-2.5 font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-all duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
            >
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        )}

        <div className="mb-[var(--space-4)] rounded-[var(--radius-md)] p-[var(--space-3)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
          <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-secondary)" }}>
            <strong style={{ color: "var(--color-text)" }}>How users join:</strong> Admins add users directly from this page. The new user logs in at <code style={{ color: "var(--color-accent)" }}>/admin</code> with the email and password you set. No self-registration.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-[var(--space-3)]">
            {[1, 2].map((i) => <div key={i} className="h-[60px] rounded-[var(--radius-md)] animate-pulse" style={{ background: "var(--color-bg-elevated)" }} />)}
          </div>
        ) : users.length === 0 ? (
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>No users found.</p>
        ) : (
          <div className="flex flex-col gap-[var(--space-3)]">
            {users.map((u) => (
              <div key={u.id} className="flex flex-col gap-[var(--space-3)] rounded-[var(--radius-md)] p-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}>
                <div className="flex items-center gap-[var(--space-3)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-sm)] font-700" style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-600" style={{ color: "var(--color-text)" }}>{u.name}</p>
                    <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-[var(--space-3)]">
                  <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: "var(--color-bg)", color: roleColors[u.role] || "var(--color-text-tertiary)" }}>
                    {u.role}
                  </span>
                  {userRole === "admin" && (
                    <>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-2 py-1 outline-none"
                        style={inputStyle}
                      >
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="author">Author</option>
                      </select>
                      <button
                        onClick={() => handleDelete(u.id, u.name)}
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[var(--color-error)]"
                        style={{ color: "var(--color-text-tertiary)" }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthProvider>
      <UIProvider>
        <UsersContent />
      </UIProvider>
    </AuthProvider>
  );
}
