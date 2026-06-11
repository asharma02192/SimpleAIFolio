"use client";

interface AdminEmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function AdminEmptyState({
  icon,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-[var(--space-3)] py-[var(--space-10)] text-center"
      style={{ color: "var(--color-text-secondary)" }}
    >
      {icon ? (
        <span className="text-[2rem] leading-none">{icon}</span>
      ) : null}
      <p
        className="text-[var(--text-sm)] font-medium"
        style={{ color: "var(--color-text)" }}
      >
        {title}
      </p>
      {description ? (
        <p
          className="max-w-[36ch] text-[var(--text-sm)] leading-relaxed"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {description}
        </p>
      ) : null}
      {action ? (
        <div className="mt-[var(--space-2)]">{action}</div>
      ) : null}
    </div>
  );
}
