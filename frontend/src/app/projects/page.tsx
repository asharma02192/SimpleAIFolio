import type { Metadata } from "next";
import PageWrapper from "@/components/PageWrapper";
import { siteConfig, serverFetch } from "@/lib/config";
import type { Project } from "@/types";

export const metadata: Metadata = {
  title: "Projects",
  description: `Projects and work by ${siteConfig.authorName}.`,
};

export default async function ProjectsPage() {
  let projects: Project[] = [];
  try {
    projects = await serverFetch<Project[]>("/api/projects");
  } catch { /* empty */ }

  const featured = projects.filter((p) => p.featured);
  const other = projects.filter((p) => !p.featured);

  return (
    <PageWrapper>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-4)] md:px-[var(--space-8)] py-[var(--space-16)]">
        {/* Header */}
        <div className="mb-[var(--space-16)]">
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-4)]"
            style={{ color: "var(--color-accent)" }}
          >
            Projects
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-semibold"
            style={{
              color: "var(--color-text)",
              fontSize: "clamp(2rem, 5vw, var(--text-3xl))",
            }}
          >
            Selected Work
          </h1>
        </div>

        {projects.length === 0 ? (
          <p
            className="font-[family-name:var(--font-body)] text-[var(--text-base)]"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            No projects yet. Add projects from the admin dashboard.
          </p>
        ) : (
          <>
            {/* Featured projects — full width */}
            {featured.length > 0 && (
              <div className="flex flex-col gap-[var(--space-6)] mb-[var(--space-16)]">
                {featured.map((project, i) => (
                  <div
                    key={project.id}
                    className="group grid grid-cols-1 md:grid-cols-12 gap-[var(--space-6)] p-[var(--space-8)]"
                    style={{
                      background: "var(--color-bg-subtle)",
                      borderRadius: "var(--radius-lg)",
                    }}
                  >
                    {/* Number */}
                    <div className="md:col-span-1 flex items-start">
                      <span
                        className="font-[family-name:var(--font-mono)] text-[var(--text-xl)] font-light"
                        style={{ color: "var(--color-accent-lighter)" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="md:col-span-8">
                      <div className="flex items-center gap-[var(--space-3)] mb-[var(--space-2)]">
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
                      </div>
                      <h2
                        className="font-[family-name:var(--font-display)] text-[var(--text-xl)] md:text-[var(--text-2xl)] font-semibold mb-[var(--space-4)]"
                        style={{ color: "var(--color-text)" }}
                      >
                        {project.title}
                      </h2>
                      <p
                        className="text-[var(--text-sm)] md:text-[var(--text-base)] max-w-[var(--measure)] mb-[var(--space-6)]"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {project.description}
                      </p>
                      <div className="flex flex-wrap gap-[var(--space-2)]">
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
                    </div>

                    {/* Links */}
                    <div className="md:col-span-3 flex md:flex-col md:items-end gap-[var(--space-4)] md:gap-[var(--space-3)]">
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] uppercase tracking-wider transition-colors hover:text-[var(--color-accent)]"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          Live &rarr;
                        </a>
                      )}
                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-[family-name:var(--font-mono)] text-[var(--text-sm)] uppercase tracking-wider transition-colors hover:text-[var(--color-accent)]"
                          style={{ color: "var(--color-text-secondary)" }}
                        >
                          Source &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Other projects — compact grid */}
            {other.length > 0 && (
              <>
                <h2
                  className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-widest mb-[var(--space-8)]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Other Projects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-6)]">
                  {other.map((project) => (
                    <div
                      key={project.id}
                      className="p-[var(--space-6)]"
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
                      <div className="flex flex-wrap gap-[var(--space-2)] mb-[var(--space-4)]">
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
                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] uppercase tracking-wider transition-colors hover:text-[var(--color-accent)]"
                          style={{ color: "var(--color-text-tertiary)" }}
                        >
                          Source &rarr;
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  );
}
