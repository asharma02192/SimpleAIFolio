"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: "D" },
  { href: "/admin/posts", label: "Posts", icon: "P" },
  { href: "/admin/categories", label: "Categories", icon: "C" },
  { href: "/admin/tags", label: "Tags", icon: "T" },
  { href: "/admin/projects", label: "Projects", icon: "R" },
  { href: "/admin/media", label: "Media", icon: "M" },
  { href: "/admin/analytics", label: "Analytics", icon: "A" },
  { href: "/admin/experience", label: "Experience", icon: "E" },
  { href: "/admin/settings", label: "Settings", icon: "S" },
];

export default function AdminSidebar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebarSurface = {
    background: "var(--color-bg-elevated)",
    borderRight: "1px solid var(--color-border)",
  };

  const renderSidebarContent = (isMobile = false) => (
    <>
      <div className="mb-[var(--space-8)] px-[var(--space-3)]">
        <Link
          href="/admin"
          className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          MyPLWeb
        </Link>
        <p
          className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Admin
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-[var(--space-1)]">
        {adminNavItems.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => {
                if (isMobile) setMenuOpen(false);
              }}
              className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--text-sm)] transition-colors motion-reduce:transition-none"
              style={{
                color: isActive ? "var(--color-accent)" : "var(--color-text-secondary)",
                background: isActive ? "var(--color-accent-lightest)" : "transparent",
              }}
            >
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full font-[family-name:var(--font-mono)] text-[0.625rem]"
                style={{ background: "var(--color-bg-muted)", color: "var(--color-text-secondary)" }}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
        <Link
          href="/"
          onClick={() => {
            if (isMobile) setMenuOpen(false);
          }}
          className="px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[var(--color-accent)] motion-reduce:transition-none"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          View Site &rarr;
        </Link>
        <button
          onClick={() => {
            setMenuOpen(false);
            onLogout();
          }}
          className="px-[var(--space-3)] py-[var(--space-2)] text-left font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[var(--color-error)] motion-reduce:transition-none"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-[var(--space-4)] py-[var(--space-3)] md:hidden"
        style={{ background: "var(--color-bg-elevated)", borderBottom: "1px solid var(--color-border)" }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider motion-reduce:transition-none"
          style={{ background: "var(--color-bg-muted)", color: "var(--color-text)" }}
          aria-label="Open admin navigation"
        >
          Menu
        </button>
        <div className="min-w-0 text-right">
          <p className="truncate font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold" style={{ color: "var(--color-text)" }}>
            MyPLWeb
          </p>
          <p className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>
            Admin
          </p>
        </div>
      </div>

      <div className={`fixed inset-0 z-40 md:hidden ${menuOpen ? "" : "pointer-events-none"}`} aria-hidden={!menuOpen}>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity motion-reduce:transition-none ${menuOpen ? "opacity-100" : "opacity-0"}`}
          aria-label="Close admin navigation overlay"
        />
        <aside
          className={`absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col p-[var(--space-4)] shadow-2xl transition-transform motion-reduce:transition-none ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={sidebarSurface}
        >
          <div className="mb-[var(--space-4)] flex items-center justify-between px-[var(--space-3)]">
            <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest" style={{ color: "var(--color-text-tertiary)" }}>
              Navigation
            </span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-[var(--radius-md)] px-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider"
              style={{ background: "var(--color-bg-muted)", color: "var(--color-text)" }}
              aria-label="Close admin navigation"
            >
              Close
            </button>
          </div>
          {renderSidebarContent(true)}
        </aside>
      </div>

      <aside
        className="hidden w-56 flex-shrink-0 flex-col p-[var(--space-4)] md:sticky md:top-0 md:flex md:min-h-screen"
        style={sidebarSurface}
      >
        {renderSidebarContent()}
      </aside>
    </>
  );
}
