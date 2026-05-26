import Link from "next/link";
import type { Post } from "@/types";
import { serverFetch } from "@/lib/config";

export default async function BlogTicker() {
  let posts: Post[] = [];
  try {
    const data = await serverFetch<{ data: Post[]; total: number }>("/api/posts?perPage=10");
    posts = data.data;
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  const items = [...posts, ...posts];

  return (
    <div
      className="w-full overflow-hidden"
      style={{
        background: "var(--color-bg-muted)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center">
        <Link
          href="/blog"
          className="flex-shrink-0 font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-wider px-[var(--space-4)] py-[var(--space-2)]"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-accent-on)",
          }}
        >
          Blog
        </Link>
        <div className="overflow-hidden flex-1">
          <div className="ticker-scroll flex items-center whitespace-nowrap py-[var(--space-2)]">
            {items.map((post, i) => (
              <Link
                key={`${post.id}-${i}`}
                href={`/blog/${post.slug}`}
                className="font-[family-name:var(--font-body)] text-[var(--text-sm)] mx-[var(--space-6)] flex-shrink-0 transition-colors hover:text-[var(--color-accent)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {post.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
