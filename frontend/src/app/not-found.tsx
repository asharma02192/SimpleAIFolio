import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";

export default function NotFound() {
  return (
    <PageWrapper>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-24)] text-center">
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
          className="text-[var(--text-sm)] mb-[var(--space-8)] max-w-[var(--measure)] mx-auto"
          style={{ color: "var(--color-text-secondary)" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider"
          style={{ color: "var(--color-accent)" }}
        >
          Back to home &rarr;
        </Link>
      </div>
    </PageWrapper>
  );
}
