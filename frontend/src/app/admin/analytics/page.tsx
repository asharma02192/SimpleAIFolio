"use client";

import { AuthProvider } from "@/lib/auth";
import AdminDashboard from "@/components/admin/Dashboard";
import AdminSidebar from "@/components/admin/Sidebar";

function AnalyticsContent() {
  return (
    <div className="min-h-screen flex" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin"; }} />
      <main className="flex-1 p-[var(--space-8)]">
        <h1 className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold mb-[var(--space-8)]" style={{ color: "var(--color-text)" }}>
          Analytics
        </h1>
        <AdminDashboard />
      </main>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthProvider>
      <AnalyticsContent />
    </AuthProvider>
  );
}
