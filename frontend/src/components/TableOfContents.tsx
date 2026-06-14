"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const article = document.querySelector(".prose");
    if (!article) return;

    const elements = article.querySelectorAll("h2, h3");
    const items: TocItem[] = [];

    elements.forEach((el, i) => {
      const id = `toc-heading-${i}`;
      el.id = id;
      items.push({
        id,
        text: el.textContent || "",
        level: parseInt(el.tagName[1]),
      });
    });

    setHeadings(items);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  if (headings.length < 2) return null;

  return (
    <nav
      className="mb-[var(--space-8)] p-[var(--space-4)]"
      style={{
        background: "var(--color-bg-subtle)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
      }}
    >
      <p
        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-3)]"
        style={{ color: "var(--color-text-tertiary)" }}
      >
        Table of Contents
      </p>
      <ul className="flex flex-col gap-[var(--space-1)]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className="block text-[var(--text-sm)] transition-colors"
              style={{
                color: activeId === h.id ? "var(--color-accent)" : "var(--color-text-secondary)",
                paddingLeft: h.level === 3 ? "var(--space-4)" : 0,
              }}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
