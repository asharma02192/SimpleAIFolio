"use client";

import { useState } from "react";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3200";

export default function PostShareButtons({ slug, title }: { slug: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const pageUrl = `${SITE_URL}/blog/${slug}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/blog/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent
    }
  };

  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(pageUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-8 h-8 font-[family-name:var(--font-mono)] text-[var(--text-sm)] transition-colors hover:text-[var(--color-accent)]"
        style={{ color: "var(--color-text-tertiary)" }}
        title="Share on X"
      >
        𝕏
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center w-8 h-8 font-[family-name:var(--font-mono)] text-[var(--text-sm)] transition-colors hover:text-[var(--color-accent)]"
        style={{ color: "var(--color-text-tertiary)" }}
        title="Share on LinkedIn"
      >
        in
      </a>
      <button
        onClick={handleCopy}
        className="inline-flex items-center justify-center w-8 h-8 font-[family-name:var(--font-mono)] text-[var(--text-sm)] cursor-pointer transition-colors hover:text-[var(--color-accent)]"
        style={{ color: copied ? "var(--color-accent)" : "var(--color-text-tertiary)" }}
        title="Copy link"
      >
        {copied ? "✓" : "⎘"}
      </button>
    </div>
  );
}
