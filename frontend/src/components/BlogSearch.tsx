"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export default function BlogSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debounced) {
      params.set("search", debounced);
    } else {
      params.delete("search");
    }
    router.replace(`/blog?${params.toString()}`);
  }, [debounced, router, searchParams]);

  return (
    <div className="mb-[var(--space-8)]">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search posts..."
        className="w-full max-w-md px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        style={{
          background: "var(--color-bg-elevated)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          color: "var(--color-text)",
        }}
      />
    </div>
  );
}
