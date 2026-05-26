"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: "■" },
  { href: "/admin/posts", label: "Posts", icon: "¶" },
  { href: "/admin/categories", label: "Categories", icon: "☰" },
  { href: "/admin/tags", label: "Tags", icon: "#" },
  { href: "/admin/projects", label: "Projects", icon: "◇" },
  { href: "/admin/media", label: "Media", icon: "□" },
  { href: "/admin/analytics", label: "Analytics", icon: "◈" },
  { href: "/admin/experience", label: "Experience", icon: "▸" },
  { href: "/admin/settings", label: "Settings", icon: "⚙" },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();

  return (
    <aside
      className="w-56 flex-shrink-0 flex flex-col p-[var(--space-4)]"
      style={{
        background: "var(--color-bg-elevated)",
        borderRight: "1px solid var(--color-border)",
        minHeight: "100vh",
      }}
    >
      {/* Logo */}
      <div className="mb-[var(--space-8)] px-[var(--space-3)]">
        <Link
          href="/admin"
          className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          MyPLWeb
        </Link>
        <p
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mt-[var(--space-1)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Admin
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-[var(--space-1)] flex-1">
        {adminNavItems.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] transition-colors"
              style={{
                color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                background: isActive ? "var(--color-accent-lightest)" : "transparent",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-[var(--space-2)] mt-[var(--space-4)]">
        <Link
          href="/"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-3)] py-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          View Site &rarr;
        </Link>
        <button
          onClick={onLogout}
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] text-left px-[var(--space-3)] py-[var(--space-2)] transition-colors hover:text-[var(--color-error)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
