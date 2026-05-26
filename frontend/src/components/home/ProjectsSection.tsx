import Link from "next/link";
import type { Project } from "@/types";
import { serverFetch } from "@/lib/config";

export default async function ProjectsSection() {
  let projects: Project[] = [];
  try {
    projects = await serverFetch<Project[]>("/api/projects");
  } catch {
    return null;
  }

  if (projects.length === 0) return null;

  return (
    <section
      className="py-[var(--space-16)] md:py-[var(--space-24)]"
      style={{ background: "var(--color-bg-elevated)" }}
    >
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)]">
        <div className="flex items-end justify-between mb-[var(--space-12)]">
          <div>
            <div className="section-label">Work</div>
            <h2
              className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-700"
              style={{ letterSpacing: "-0.02em" }}
            >
              Selected Projects
            </h2>
          </div>
          <Link
            href="/projects"
            className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 transition-colors hover:text-[var(--color-accent)] hidden sm:block"
            style={{ color: "var(--color-text-secondary)" }}
          >
            View all &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[var(--space-6)]">
          {projects.slice(0, 4).map((project, i) => (
            <div key={project.id} className="card group" style={{ padding: "var(--space-8)" }}>
              {/* Number badge */}
              <div className="flex items-center justify-between mb-[var(--space-5)]">
                <span
                  className="font-[family-name:var(--font-display)] text-[var(--text-3xl)] font-800 leading-none"
                  style={{ color: "var(--color-accent-lighter)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex gap-[var(--space-3)]">
                  {project.liveUrl && (
                    <a
                      href={project.liveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] font-500 transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Live &rarr;
                    </a>
                  )}
                  {project.githubUrl && (
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] font-500 transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-text-tertiary)" }}
                    >
                      Source &rarr;
                    </a>
                  )}
                </div>
              </div>

              <h3
                className="font-[family-name:var(--font-display)] text-[var(--text-xl)] font-700 mb-[var(--space-3)] group-hover:text-[var(--color-accent)] transition-colors"
                style={{ letterSpacing: "-0.015em" }}
              >
                {project.title}
              </h3>
              <p
                className="font-[family-name:var(--font-body)] text-[var(--text-sm)] leading-[var(--leading-normal)] mb-[var(--space-5)] max-w-[var(--measure)]"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {project.description}
              </p>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                {project.techStack.map((tech) => (
                  <span key={tech} className="tech-chip">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
