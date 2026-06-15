import type { Metadata } from "next";
import { connection } from "next/server";
import PageWrapper from "@/components/PageWrapper";
import { fetchSettings, logPublicFetchError, serverFetch } from "@/lib/config";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();

  return {
    title: "About",
    description: `Learn more about ${settings.siteConfig.authorName} and the work behind ${settings.siteConfig.title}.`,
  };
}

interface Experience {
  id: string;
  role: string;
  period: string;
  description: string;
  order: number;
}

export default async function AboutPage() {
  await connection();
  const settings = await fetchSettings();
  const { siteConfig: cfg, bioAbout, skillGroups } = settings;
  let experience: Experience[] = [];
  let experienceError = false;

  try {
    experience = await serverFetch<Experience[]>("/api/experience");
  } catch (error) {
    experienceError = true;
    logPublicFetchError("failed to load public experience", error);
  }

  return (
    <PageWrapper settings={settings}>
      <section className="py-[var(--space-16)] md:py-[var(--space-24)]">
        <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)]">
          <div className="grid grid-cols-12 gap-x-[var(--space-8)] gap-y-[var(--space-8)]">
            <div className="col-span-12 lg:col-span-7">
              <div className="section-label">About</div>
              <h1 className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-700 mb-[var(--space-8)]" style={{ letterSpacing: "-0.02em" }}>
                {cfg.authorName}
              </h1>

              {bioAbout.map((paragraph, i) => (
                <p key={i} className="font-[family-name:var(--font-body)] text-[var(--text-base)] leading-[var(--leading-relaxed)] mb-[var(--space-6)]" style={{ color: "var(--color-text-secondary)" }}>
                  {paragraph}
                </p>
              ))}

              {experience.length > 0 && (
                <>
                  <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700 mt-[var(--space-12)] mb-[var(--space-6)]" style={{ color: "var(--color-text)" }}>Experience</h2>
                  <div className="flex flex-col gap-[var(--space-6)]">
                    {experience.map((exp) => (
                      <div key={exp.id} className="grid grid-cols-[auto_1fr] gap-[var(--space-4)] items-start">
                        <span
                          className="mt-[0.4rem] h-2.5 w-2.5 rounded-full"
                          style={{ background: "var(--color-accent)" }}
                          aria-hidden="true"
                        />
                        <div>
                          <h3 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-600" style={{ color: "var(--color-text)" }}>{exp.role}</h3>
                          <span className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]" style={{ color: "var(--color-text-tertiary)" }}>{exp.period}</span>
                          {exp.description && (
                            <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)] mt-[var(--space-2)] leading-[var(--leading-relaxed)]" style={{ color: "var(--color-text-secondary)" }}>{exp.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {experienceError && (
                <div className="mt-[var(--space-12)]">
                  <h2 className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700 mb-[var(--space-3)]" style={{ color: "var(--color-text)" }}>
                    Experience
                  </h2>
                  <p className="font-[family-name:var(--font-body)] text-[var(--text-sm)]" style={{ color: "var(--color-text-tertiary)" }}>
                    Experience is temporarily unavailable. Please check back shortly.
                  </p>
                </div>
              )}
            </div>

            <div className="col-span-12 lg:col-span-5">
              {skillGroups.length > 0 && (
                <div className="p-[var(--space-6)] lg:p-[var(--space-8)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)" }}>
                  <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-700 mb-[var(--space-6)]" style={{ color: "var(--color-text)" }}>Skills & Tools</h2>
                  <div className="flex flex-col gap-[var(--space-5)]">
                    {skillGroups.map((group) => (
                      <div key={group.category}>
                        <h3 className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-wider mb-[var(--space-2)]" style={{ color: "var(--color-accent)" }}>
                          {group.category}
                        </h3>
                        <div className="flex flex-wrap gap-[var(--space-2)]">
                          {group.skills.map((skill) => (
                            <span key={skill.name} className="tech-chip">{skill.name}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-[var(--space-6)] p-[var(--space-6)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)" }}>
                <h2 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-700 mb-[var(--space-4)]" style={{ color: "var(--color-text)" }}>Connect</h2>
                <div className="grid grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-3)]">
                  {Object.entries(cfg.socialLinks).filter(([, url]) => url).map(([name, url]) => (
                    <a
                      key={name}
                      href={name === "email" ? `mailto:${url}` : url}
                      {...(name !== "email" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 flex items-center gap-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} /> {name.charAt(0).toUpperCase() + name.slice(1)}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageWrapper>
  );
}
