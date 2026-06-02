"use client";

import { AuthProvider, logoutAdmin } from "@/lib/auth";
import AdminDashboard from "@/components/admin/Dashboard";
import AdminSidebar from "@/components/admin/Sidebar";

function AnalyticsContent() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
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
