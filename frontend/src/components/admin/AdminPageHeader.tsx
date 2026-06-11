"use client";

interface AdminPageHeaderProps {
  label?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export default function AdminPageHeader({
  label,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="mb-[var(--space-6)] flex flex-col gap-[var(--space-3)] lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-[52rem]">
        {label ? (
          <p
            className="font-[family-name:var(--font-mono)] text-[0.625rem] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {label}
          </p>
        ) : null}
        <h1
          className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="mt-[var(--space-2)] max-w-[68ch] text-[var(--text-sm)] leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-[var(--space-2)] shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
