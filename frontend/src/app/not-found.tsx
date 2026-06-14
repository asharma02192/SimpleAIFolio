import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-[var(--space-4)] text-center" style={{ background: "var(--color-bg)" }}>
      <p
        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
        style={{ color: "var(--color-accent)" }}
      >
        404
      </p>
      <h1
        className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-semibold mb-[var(--space-4)]"
        style={{ color: "var(--color-text)" }}
      >
        Page not found
      </h1>
      <p
        className="font-[family-name:var(--font-body)] text-[var(--text-sm)] mb-[var(--space-8)]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center justify-center rounded-[var(--radius-md)] px-[var(--space-6)] py-[var(--space-3)] font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider transition-opacity hover:opacity-90"
        style={{ background: "var(--color-accent)", color: "var(--color-accent-on)" }}
      >
        &larr; Back to home
      </Link>
    </div>
  );
}
