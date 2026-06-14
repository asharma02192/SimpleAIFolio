import Link from "next/link";
import type { Post } from "@/types";
import { logPublicFetchError, serverFetch } from "@/lib/config";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3201";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function RecentWriting() {
  let posts: Post[] = [];
  let postsError = false;
  try {
    const data = await serverFetch<{ data: Post[]; total: number }>("/api/posts?perPage=3");
    posts = data.data;
  } catch (error) {
    postsError = true;
    logPublicFetchError("failed to load home recent writing", error);
  }

  if (postsError) {
    return (
      <section className="py-[var(--space-16)] md:py-[var(--space-24)]">
        <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)]">
          <div className="section-label">Recent Writing</div>
          <h2
            className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-700 mb-[var(--space-6)]"
            style={{ letterSpacing: "-0.02em" }}
          >
            Latest Posts
          </h2>
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Latest posts are temporarily unavailable.
          </p>
        </div>
      </section>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="py-[var(--space-16)] md:py-[var(--space-24)]">
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)]">
        <div className="flex items-end justify-between mb-[var(--space-12)]">
          <div>
            <div className="section-label">Recent Writing</div>
            <h2
              className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-700"
              style={{ letterSpacing: "-0.02em" }}
            >
              Latest Posts
            </h2>
          </div>
          <Link
            href="/blog"
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-colors hover:text-[var(--color-accent)] hidden sm:block"
            style={{ color: "var(--color-text-secondary)" }}
          >
            View all &rarr;
          </Link>
        </div>

        {/* Featured post */}
        <Link href={`/blog/${posts[0].slug}`} className="block group mb-[var(--space-8)]">
          <div className="card" style={{ padding: "var(--space-8)" }}>
            <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-4)]">
              {posts[0].category && <span className="tag">{posts[0].category.name}</span>}
              <span
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {formatDate(posts[0].publishedAt!)} &middot; {posts[0].readingTime} min read
              </span>
            </div>
            <h3
              className="font-[family-name:var(--font-display)] text-[var(--text-lg)] md:text-[var(--text-xl)] font-700 mb-[var(--space-3)] group-hover:text-[var(--color-accent)] transition-colors"
              style={{ letterSpacing: "-0.015em" }}
            >
              {posts[0].title}
            </h3>
            {posts[0].excerpt && (
              <p
                className="font-[family-name:var(--font-body)] text-[var(--text-sm)] leading-[var(--leading-normal)] max-w-[var(--measure)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {posts[0].excerpt}
              </p>
            )}
          </div>
        </Link>

        {/* Two smaller posts */}
        {posts.length > 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
            {posts.slice(1).map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="block group"
              >
                <div className="card">
                  <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-3)]">
                    {post.category && <span className="tag">{post.category.name}</span>}
                    <span
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {formatDate(post.publishedAt!)}
                    </span>
                  </div>
                  <h3
                    className="font-[family-name:var(--font-display)] text-[var(--text-base)] md:text-[var(--text-lg)] font-700 mb-[var(--space-2)] group-hover:text-[var(--color-accent)] transition-colors"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p
                      className="font-[family-name:var(--font-body)] text-[var(--text-sm)] leading-[var(--leading-normal)]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Mobile view all link */}
        <div className="mt-[var(--space-8)] sm:hidden text-center">
          <Link
            href="/blog"
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500"
            style={{ color: "var(--color-accent)" }}
          >
            View all posts &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
