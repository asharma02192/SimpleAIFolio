import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked, Renderer } from "marked";
import PageWrapper from "@/components/PageWrapper";
import {
  fetchSettings,
  getSiteUrl,
  isServerFetchErrorStatus,
  logPublicFetchError,
  serverFetch,
  toAbsoluteUrl,
} from "@/lib/config";
import type { Post } from "@/types";

export const revalidate = 60;

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

function toSafeImageUrl(src: string) {
  const value = src.trim();
  const lower = value.toLowerCase();

  if (
    lower.startsWith("/") ||
    lower.startsWith("http://") ||
    lower.startsWith("https://")
  ) {
    return value;
  }

  return "";
}

const BLOCKED_TAGS = /<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base)\b[^>]*>/gi;
const BLOCKED_TAG_BLOCKS = /<(script|style|iframe|object|embed|form|textarea|select)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

function sanitizeRenderedHtml(html: string) {
  const withoutBlockedContent = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCKED_TAG_BLOCKS, "")
    .replace(BLOCKED_TAGS, "");

  return withoutBlockedContent.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (match, rawTagName: string, rawAttrs: string) => {
    const tagName = rawTagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    if (match.startsWith("</")) {
      return `</${tagName}>`;
    }

    if (tagName === "br" || tagName === "hr") {
      return `<${tagName}>`;
    }

    const attrs: string[] = [];
    const attrRegex = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

      if (attrName.startsWith("on") || attrName === "style") {
        continue;
      }

      if (tagName === "a" && attrName === "href") {
        const safeHref = toSafeUrl(attrValue);
        attrs.push(`href="${escapeHtml(safeHref)}"`);
        if (safeHref.startsWith("http://") || safeHref.startsWith("https://")) {
          attrs.push('target="_blank"', 'rel="noopener noreferrer"');
        }
        continue;
      }

      if (tagName === "a" && attrName === "title") {
        attrs.push(`title="${escapeHtml(attrValue)}"`);
        continue;
      }

      if (tagName === "img" && attrName === "src") {
        const safeSrc = toSafeImageUrl(attrValue);
        if (!safeSrc) {
          return "";
        }
        attrs.push(`src="${escapeHtml(safeSrc)}"`);
        continue;
      }

      if (tagName === "img" && (attrName === "alt" || attrName === "title")) {
        attrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
      }
    }

    if (tagName === "img" && !attrs.some((attr) => attr.startsWith("src="))) {
      return "";
    }

    const attrString = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
    return `<${tagName}${attrString}>`;
  });
}

function isHtmlContent(body: string): boolean {
  const trimmed = body.trim();
  return /^<[a-zA-Z]/.test(trimmed) || /<(p|h[1-6]|div|ul|ol|blockquote|pre|img)\b/i.test(trimmed);
}

function renderBody(body: string): string {
  if (isHtmlContent(body)) {
    return sanitizeRenderedHtml(body);
  }
  return sanitizeRenderedHtml(renderMarkdown(body));
}

function renderMarkdown(markdown: string) {
  const renderer = new Renderer();

  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, tokens }) => {
    const safeHref = toSafeUrl(href);
    const text = renderer.parser.parseInline(tokens);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    const relAttr = safeHref.startsWith("http") ? ' rel="noopener noreferrer"' : "";
    const targetAttr = safeHref.startsWith("http") ? ' target="_blank"' : "";

    return `<a href="${escapeHtml(safeHref)}"${titleAttr}${targetAttr}${relAttr}>${text}</a>`;
  };
  renderer.image = ({ href, title, text }) => {
    const safeHref = toSafeImageUrl(href);
    if (!safeHref) return "";
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    return `<img src="${escapeHtml(safeHref)}" alt="${escapeHtml(text)}"${titleAttr}>`;
  };

  return marked.parse(markdown, { renderer }) as string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const settings = await fetchSettings();
  const siteUrl = getSiteUrl();

  try {
    const post = await serverFetch<Post>(`/api/posts/${slug}`);
    const title = post.metaTitle || post.title;
    const description = post.metaDescription || post.excerpt || post.title;
    const canonicalUrl = `${siteUrl}/blog/${post.slug}`;
    const imageUrl = toAbsoluteUrl(post.ogImage || post.featuredImage);

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        type: "article",
        url: canonicalUrl,
        title,
        description,
        siteName: settings.siteConfig.title,
        publishedTime: post.publishedAt || undefined,
        images: imageUrl ? [{ url: imageUrl }] : undefined,
      },
      twitter: {
        card: imageUrl ? "summary_large_image" : "summary",
        title,
        description,
        images: imageUrl ? [imageUrl] : undefined,
      },
    };
  } catch (error) {
    if (isServerFetchErrorStatus(error, 404)) {
      return {
        title: "Post Not Found",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    logPublicFetchError(`failed to generate metadata for post ${slug}`, error);
    return {
      title: "Post Unavailable",
      description: settings.siteConfig.description,
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let post: Post | null = null;
  let relatedPosts: Post[] = [];
  try {
    post = await serverFetch<Post>(`/api/posts/${slug}`);
  } catch (error) {
    if (isServerFetchErrorStatus(error, 404)) {
      notFound();
    }

    logPublicFetchError(`failed to load post ${slug}`, error);
  }

  if (!post) {
    return (
      <PageWrapper>
        <article className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
          <Link
            href="/blog"
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider mb-[var(--space-8)] inline-block transition-colors hover:text-[var(--color-accent)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            &larr; Back to blog
          </Link>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-xl)] md:text-[var(--text-2xl)] font-semibold mb-[var(--space-4)]"
            style={{ color: "var(--color-text)" }}
          >
            This post is temporarily unavailable.
          </h1>
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Please try again later.
          </p>
        </article>
      </PageWrapper>
    );
  }

  if (post.category) {
    try {
      const data = await serverFetch<{ data: Post[] }>(
        `/api/posts?category=${post.category.slug}&perPage=3`
      );
      relatedPosts = data.data.filter((p) => p.id !== post.id);
    } catch {
      // Ignore related post fetch failures on the public page.
    }
  }

  return (
    <PageWrapper>
      <article className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        <Link
          href="/blog"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider mb-[var(--space-8)] inline-block transition-colors hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          &larr; Back to blog
        </Link>

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
            className="font-[family-name:var(--font-display)] text-[var(--text-xl)] md:text-[var(--text-2xl)] font-semibold leading-[var(--leading-tight)]"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(1.75rem, 4vw, var(--text-2xl))",
            }}
          >
            {post.title}
          </h1>
        </header>

        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: renderBody(post.body ?? "") }}
        />

        {post.tags && post.tags.length > 0 && (
          <div
            className="mt-[var(--space-12)] pt-[var(--space-6)] flex flex-wrap gap-[var(--space-2)]"
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
