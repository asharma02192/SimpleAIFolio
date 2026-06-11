"use client";

import { ReactNode } from "react";

interface AdminTabsProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
}

export default function AdminTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
}: AdminTabsProps) {
  return (
    <div>
      <div
        className="flex gap-[var(--space-1)] overflow-x-auto"
        style={{
          borderBottom: "1px solid var(--color-border)",
          WebkitOverflowScrolling: "touch",
          flexWrap: "nowrap",
          scrollbarWidth: "thin",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="shrink-0 cursor-pointer bg-transparent px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] transition-colors"
              style={{
                color: isActive ? "var(--color-accent)" : "var(--color-text-tertiary)",
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
                marginBottom: "-1px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="mt-[var(--space-5)]">
        {tabs.map((tab) =>
          tab.id === activeTab ? <div key={tab.id}>{children}</div> : null
        )}
      </div>
    </div>
  );
}
