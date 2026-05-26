import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked, Renderer } from "marked";
import PageWrapper from "@/components/PageWrapper";
import { serverFetch } from "@/lib/config";
import type { Post } from "@/types";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toSafeUrl(href: string) {
  const value = href.trim();
  const lower = value.toLowerCase();

  if (
    lower.startsWith("/") ||
    lower.startsWith("#") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("mailto:")
  ) {
    return value;
  }

  return "#";
}

function renderMarkdown(markdown: string) {
  const renderer = new Renderer();

  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, tokens }) => {
    const safeHref = toSafeUrl(href);
    const text = renderer.parser.parseInline(tokens);
    const titleAttr = title ? ` title=\"${escapeHtml(title)}\"` : "";
    const relAttr = safeHref.startsWith("http") ? " rel=\"noopener noreferrer\"" : "";
    const targetAttr = safeHref.startsWith("http") ? " target=\"_blank\"" : "";

    return `<a href=\"${escapeHtml(safeHref)}\"${titleAttr}${targetAttr}${relAttr}>${text}</a>`;
  };
  renderer.image = ({ href, title, text }) => {
    const safeHref = toSafeUrl(href);
    const titleAttr = title ? ` title=\"${escapeHtml(title)}\"` : "";
    return `<img src=\"${escapeHtml(safeHref)}\" alt=\"${escapeHtml(text)}\"${titleAttr}>`;
  };

  return marked.parse(markdown, { renderer }) as string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await serverFetch<Post>(`/api/posts/${slug}`);
    return {
      title: post.title,
      description: post.excerpt || post.title,
    };
  } catch {
    return { title: "Post Not Found" };
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: Post;
  let relatedPosts: Post[] = [];
  try {
    post = await serverFetch<Post>(`/api/posts/${slug}`);
  } catch {
    notFound();
  }

  // Fetch related posts from same category
  if (post.category) {
    try {
      const data = await serverFetch<{ data: Post[] }>(
        `/api/posts?category=${post.category.slug}&perPage=3`
      );
      relatedPosts = data.data.filter((p) => p.id !== post.id);
    } catch { /* empty */ }
  }

  return (
    <PageWrapper>
      <article className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        {/* Back link */}
        <Link
          href="/blog"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider mb-[var(--space-8)] inline-block transition-colors hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          &larr; Back to blog
        </Link>

        {/* Post header */}
        <header className="mb-[var(--space-12)]">
          <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-4)]">
            {post.category && (
              <span
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-2)] py-[var(--space-1)]"
                style={{
                  background: "var(--color-accent-lightest)",
                  color: "var(--color-accent)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {post.category.name}
              </span>
            )}
            {post.publishedAt && (
              <span
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                {formatDate(post.publishedAt)}
              </span>
            )}
            <span
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
              style={{ color: "var(--color-text-tertiary)" }}
            >
              {post.readingTime} min read
            </span>
          </div>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-xl)] md:text-[var(--text-2xl)] font-semibold max-w-[var(--measure-wide)] leading-[var(--leading-tight)]"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(1.75rem, 4vw, var(--text-2xl))",
            }}
          >
            {post.title}
          </h1>
        </header>

        {/* Post body */}
        <div
          className="prose max-w-[var(--measure)]"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body ?? "") }}
        />

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="mt-[var(--space-12)] pt-[var(--space-6)] flex flex-wrap gap-[var(--space-2)]"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            {post.tags.map((tag) => (
              <span
                key={tag.id}
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-3)] py-[var(--space-1)]"
                style={{
                  background: "var(--color-bg-muted)",
                  color: "var(--color-text-tertiary)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div
            className="mt-[var(--space-16)] pt-[var(--space-8)]"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            <h2
              className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-semibold mb-[var(--space-8)]"
              style={{ color: "var(--color-text)" }}
            >
              Continue Reading
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
              {relatedPosts.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  className="group p-[var(--space-6)] transition-colors"
                  style={{
                    background: "var(--color-bg-subtle)",
                    borderRadius: "var(--radius-lg)",
                  }}
                >
                  {related.category && (
                    <span
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider mb-[var(--space-2)] block"
                      style={{ color: "var(--color-accent)" }}
                    >
                      {related.category.name}
                    </span>
                  )}
                  <h3
                    className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-semibold group-hover:text-[var(--color-accent)] transition-colors"
                    style={{ color: "var(--color-text)" }}
                  >
                    {related.title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>
    </PageWrapper>
  );
}
