"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import AdminDashboard from "@/components/admin/Dashboard";
import AdminSidebar from "@/components/admin/Sidebar";

function AdminContent() {
  const { isAuthenticated, isReady, login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center px-[var(--space-4)]" style={{ background: "var(--color-bg)" }}>
        <p className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-[var(--space-4)]" style={{ background: "var(--color-bg)" }}>
        <div className="w-full max-w-sm">
          <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold mb-[var(--space-8)]" style={{ color: "var(--color-text)" }}>
            Admin Login
          </h1>
          {error && (
            <p className="text-[var(--text-sm)] mb-[var(--space-4)]" style={{ color: "var(--color-error)" }}>
              {error}
            </p>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              try {
                await login(email, password);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Login failed");
              }
            }}
            className="flex flex-col gap-[var(--space-4)]"
          >
            <label htmlFor="admin-email" className="sr-only">Email</label>
            <input
              id="admin-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="w-full px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text)",
              }}
            />
            <label htmlFor="admin-password" className="sr-only">Password</label>
            <input
              id="admin-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition-colors"
              style={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-text)",
              }}
            />
            <button
              type="submit"
              className="w-full py-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-sm)] uppercase tracking-wider transition-opacity hover:opacity-90"
              style={{
                background: "var(--color-accent)",
                color: "var(--color-accent-on)",
                borderRadius: "var(--radius-md)",
              }}
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logout} />
      <main className="flex-1 p-[var(--space-8)] overflow-auto">
        <AdminDashboard />
      </main>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AuthProvider>
      <AdminContent />
    </AuthProvider>
  );
}
