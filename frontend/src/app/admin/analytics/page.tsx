"use client";

import { AuthProvider, logoutAdmin } from "@/lib/auth";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import AdminSidebar from "@/components/admin/Sidebar";

function AnalyticsContent() {
  return (
    <div className="admin-main min-h-screen flex flex-col md:flex-row" style={{ background: "var(--color-bg)" }}>
      <AdminSidebar onLogout={logoutAdmin} />
      <main className="min-w-0 flex-1 overflow-x-hidden p-[var(--space-4)] sm:p-[var(--space-6)] md:p-[var(--space-8)]">
        <AnalyticsDashboard />
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
