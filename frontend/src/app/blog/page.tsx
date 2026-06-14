import type { Metadata } from "next";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import BlogSearch from "@/components/BlogSearch";
import { fetchSettings, logPublicFetchError, serverFetch } from "@/lib/config";
import type { Post, Category } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3201";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();

  return {
    title: "Blog",
    description: `Writing by ${settings.siteConfig.authorName} about AI tools, techniques, agents, and software development.`,
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string; search?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page) || 1;

  let posts: Post[] = [];
  let categories: Category[] = [];
  let totalPages = 1;
  let postsError = false;

  try {
    const catParam = params.category ? `&category=${params.category}` : "";
    const searchParam = params.search ? `&search=${encodeURIComponent(params.search)}` : "";
    const data = await serverFetch<{ data: Post[]; total: number; totalPages: number }>(
      `/api/posts?perPage=10&page=${page}${catParam}${searchParam}`
    );
    posts = data.data;
    totalPages = data.totalPages;
  } catch (error) {
    postsError = true;
    logPublicFetchError("failed to load blog listing", error);
  }

  try {
    categories = await serverFetch<Category[]>("/api/categories");
  } catch (error) {
    logPublicFetchError("failed to load blog categories", error);
  }

  return (
    <PageWrapper>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        {/* Header */}
        <div className="mb-[var(--space-12)]">
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
            style={{ color: "var(--color-accent)" }}
          >
            Blog
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-semibold"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(2rem, 5vw, var(--text-3xl))",
            }}
          >
            Writing
          </h1>
        </div>

        <BlogSearch />

        {/* Category filters */}
        {categories.length > 0 && (
          <div
            className="flex gap-[var(--space-2)] mb-[var(--space-12)] overflow-x-auto pb-[var(--space-2)]"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <Link
              href="/blog"
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-3)] py-[var(--space-3)] whitespace-nowrap transition-colors"
              style={{ color: params.category ? "var(--color-text-tertiary)" : "var(--color-accent)" }}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/blog?category=${cat.slug}`}
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-3)] py-[var(--space-3)] whitespace-nowrap transition-colors hover:text-[var(--color-accent)]"
                style={{ color: params.category === cat.slug ? "var(--color-accent)" : "var(--color-text-tertiary)" }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}

        {/* Post listing */}
        {postsError ? (
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Posts are temporarily unavailable. Please try again later.
          </p>
        ) : posts.length > 0 ? (
          <div className="flex flex-col">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group py-[var(--space-6)] grid grid-cols-12 gap-[var(--space-4)] items-start"
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                {/* Date */}
                <div className="col-span-12 md:col-span-2">
                  <span
                    className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {post.publishedAt ? formatDate(post.publishedAt) : "Draft"}
                  </span>
                </div>

                {/* Content */}
                <div className="col-span-12 md:col-span-8">
                  {post.featuredImage && (
                    <img
                      src={`${API_BASE}${post.featuredImage}`}
                      alt={post.title}
                      loading="lazy"
                      className="mb-[var(--space-4)] w-full"
                      style={{ maxHeight: "200px", objectFit: "cover", borderRadius: "var(--radius-md)" }}
                    />
                  )}
                  <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-2)]">
                    {post.category && (
                      <span
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-2)] py-[0.125rem]"
                        style={{
                          background: "var(--color-accent-lightest)",
                          color: "var(--color-accent)",
                          borderRadius: "var(--radius-sm)",
                        }}
                      >
                        {post.category.name}
                      </span>
                    )}
                    <span
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      {post.readingTime} min
                    </span>
                  </div>
                  <h2
                    className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold mb-[var(--space-2)] group-hover:text-[var(--color-accent)] transition-colors"
                    style={{ color: "var(--color-text)" }}
                  >
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p
                      className="text-[var(--text-sm)]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {post.excerpt}
                    </p>
                  )}
                </div>

                {/* Arrow */}
                <div className="hidden md:flex col-span-2 justify-end items-center">
                  <span
                    className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "var(--color-accent)" }}
                  >
                    &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            No published posts yet.
          </p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-[var(--space-12)] flex justify-center gap-[var(--space-4)]">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/blog?page=${p}${params.category ? `&category=${params.category}` : ""}`}
                className="font-[family-name:var(--font-mono)] text-[var(--text-sm)]"
                style={{ color: p === page ? "var(--color-accent)" : "var(--color-text-tertiary)" }}
              >
                {p}
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
