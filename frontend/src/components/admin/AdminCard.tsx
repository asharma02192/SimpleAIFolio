"use client";

interface AdminCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
}

const paddingMap = {
  sm: "p-[var(--space-4)]",
  md: "p-[var(--space-5)]",
  lg: "p-[var(--space-6)]",
} as const;

const surfaceStyle = {
  background: "var(--color-bg-elevated)",
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 0 rgba(15, 23, 42, 0.04)",
};

export default function AdminCard({
  children,
  className = "",
  padding = "md",
}: AdminCardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] ${paddingMap[padding]} ${className}`}
      style={surfaceStyle}
    >
      {children}
    </div>
  );
}
