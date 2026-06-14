import type { Metadata } from "next";
import Link from "next/link";
import PageWrapper from "@/components/PageWrapper";
import { fetchSettings, logPublicFetchError, serverFetch } from "@/lib/config";
import type { Post, Project, PaginatedResponse } from "@/types";

export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();

  return {
    title: "Search",
    description: `Search ${settings.siteConfig.authorName}'s blog posts and projects.`,
  };
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = (params.q || "").trim();

  let posts: Post[] = [];
  let projects: Project[] = [];
  let postsError = false;
  let projectsError = false;

  if (query) {
    try {
      const data = await serverFetch<PaginatedResponse<Post>>(
        `/api/posts?search=${encodeURIComponent(query)}&perPage=20`,
        { cache: "no-store" }
      );
      posts = data.data;
    } catch (error) {
      postsError = true;
      logPublicFetchError("failed to search posts", error);
    }

    try {
      const allProjects = await serverFetch<Project[]>("/api/projects", {
        cache: "no-store",
      });
      const lower = query.toLowerCase();
      projects = allProjects.filter(
        (p) =>
          p.title.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.techStack.some((t) => t.toLowerCase().includes(lower))
      );
    } catch (error) {
      projectsError = true;
      logPublicFetchError("failed to search projects", error);
    }
  }

  const hasResults = posts.length > 0 || projects.length > 0;

  return (
    <PageWrapper>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        <div className="mb-[var(--space-12)]">
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
            style={{ color: "var(--color-accent)" }}
          >
            Search
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-semibold"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(2rem, 5vw, var(--text-3xl))",
            }}
          >
            {query ? `Results for "${query}"` : "Search"}
          </h1>
        </div>

        {!query ? (
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Enter a search term to find blog posts and projects.
          </p>
        ) : !hasResults && !postsError && !projectsError ? (
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            No results found for &ldquo;{query}&rdquo;
          </p>
        ) : (
          <>
            {posts.length > 0 && (
              <section className="mb-[var(--space-16)]">
                <h2
                  className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-8)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Blog Posts ({posts.length})
                </h2>
                <div className="flex flex-col">
                  {posts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="group py-[var(--space-6)] grid grid-cols-12 gap-[var(--space-4)] items-start"
                      style={{ borderBottom: "1px solid var(--color-border)" }}
                    >
                      <div className="col-span-12 md:col-span-2">
                        <span
                          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          {post.publishedAt ? formatDate(post.publishedAt) : "Draft"}
                        </span>
                      </div>
                      <div className="col-span-12 md:col-span-8">
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
                          {post.readingTime && (
                            <span
                              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
                              style={{ color: "var(--color-text-tertiary)" }}
                            >
                              {post.readingTime} min
                            </span>
                          )}
                        </div>
                        <h3
                          className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold mb-[var(--space-2)] group-hover:text-[var(--color-accent)] transition-colors"
                          style={{ color: "var(--color-text)" }}
                        >
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p
                            className="text-[var(--text-sm)]"
                            style={{ color: "var(--color-text-secondary)" }}
                          >
                            {post.excerpt}
                          </p>
                        )}
                      </div>
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
              </section>
            )}

            {projects.length > 0 && (
              <section>
                <h2
                  className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-8)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Projects ({projects.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="group block p-[var(--space-6)]"
                      style={{
                        background: "var(--color-bg-subtle)",
                        borderRadius: "var(--radius-lg)",
                      }}
                    >
                      <h3
                        className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-semibold mb-[var(--space-3)]"
                        style={{ color: "var(--color-text)" }}
                      >
                        {project.title}
                      </h3>
                      <p
                        className="text-[var(--text-sm)] mb-[var(--space-4)]"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-[var(--space-2)]">
                        {project.techStack.map((tech) => (
                          <span
                            key={tech}
                            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-2)] py-[var(--space-1)]"
                            style={{
                              background: "var(--color-bg-muted)",
                              color: "var(--color-text-tertiary)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}
