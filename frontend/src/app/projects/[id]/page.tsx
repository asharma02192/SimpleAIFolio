import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import {
  fetchSettings,
  getSiteUrl,
  isServerFetchErrorStatus,
  logPublicFetchError,
  serverFetch,
  toAbsoluteUrl,
} from "@/lib/config";
import type { Project } from "@/types";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const settings = await fetchSettings();
  const siteUrl = getSiteUrl();

  try {
    const projects = await serverFetch<Project[]>("/api/projects");
    const project = projects.find((p) => p.id === id);

    if (!project) {
      return {
        title: "Project Not Found",
        robots: { index: false, follow: false },
      };
    }

    return {
      title: project.title,
      description: project.description,
      alternates: {
        canonical: `${siteUrl}/projects/${project.id}`,
      },
      openGraph: {
        type: "article",
        url: `${siteUrl}/projects/${project.id}`,
        title: project.title,
        description: project.description,
        siteName: settings.siteConfig.title,
      },
    };
  } catch (error) {
    logPublicFetchError(`failed to generate metadata for project ${id}`, error);
    return {
      title: "Project Unavailable",
      description: settings.siteConfig.description,
      robots: { index: false, follow: false },
    };
  }
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let project: Project | null = null;

  try {
    const projects = await serverFetch<Project[]>("/api/projects");
    project = projects.find((p) => p.id === id) || null;
  } catch (error) {
    logPublicFetchError(`failed to load project ${id}`, error);
  }

  if (!project) {
    notFound();
  }

  const thumbnailUrl = toAbsoluteUrl(project.thumbnail);

  return (
    <PageWrapper>
      <article className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        <Link
          href="/projects"
          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider mb-[var(--space-8)] inline-block transition-colors hover:text-[var(--color-accent)]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          &larr; Back to projects
        </Link>

        <header className="mb-[var(--space-12)]">
          <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-4)]">
            {project.featured && (
              <span
                className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider px-[var(--space-2)] py-[var(--space-1)]"
                style={{
                  background: "var(--color-accent-lightest)",
                  color: "var(--color-accent)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                Featured
              </span>
            )}
          </div>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-xl)] md:text-[var(--text-2xl)] font-semibold leading-[var(--leading-tight)] mb-[var(--space-6)]"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(1.75rem, 4vw, var(--text-2xl))",
            }}
          >
            {project.title}
          </h1>
        </header>

        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt={project.title}
            className="mb-[var(--space-12)]"
            style={{
              width: "100%",
              maxHeight: "480px",
              objectFit: "cover",
              borderRadius: "var(--radius-lg)",
            }}
          />
        )}

        <div
          className="font-[family-name:var(--font-body)] text-[var(--text-base)] max-w-[var(--measure)] mb-[var(--space-12)]"
          style={{ color: "var(--color-text-secondary)", lineHeight: "var(--leading-relaxed)" }}
        >
          {project.description}
        </div>

        <div
          className="flex flex-wrap gap-[var(--space-2)] mb-[var(--space-12)] pt-[var(--space-6)]"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          {project.techStack.map((tech) => (
            <span
              key={tech}
              className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] px-[var(--space-3)] py-[var(--space-1)]"
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

        {(project.liveUrl || project.githubUrl) && (
          <div
            className="flex flex-wrap gap-[var(--space-4)] pt-[var(--space-6)]"
            style={{ borderTop: "1px solid var(--color-border)" }}
          >
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] uppercase tracking-wider px-[var(--space-6)] py-[var(--space-3)] transition-colors"
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-bg)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                View Live &rarr;
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] uppercase tracking-wider px-[var(--space-6)] py-[var(--space-3)] transition-colors"
                style={{
                  background: "var(--color-bg-subtle)",
                  color: "var(--color-text-secondary)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                View Source &rarr;
              </a>
            )}
          </div>
        )}
      </article>
    </PageWrapper>
  );
}
