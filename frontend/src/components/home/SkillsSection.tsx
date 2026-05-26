import { fetchSettings } from "@/lib/config";

export default async function SkillsSection() {
  const { skillGroups } = await fetchSettings();

  return (
    <section className="py-[var(--space-16)] md:py-[var(--space-24)]" style={{ background: "var(--color-bg-elevated)" }}>
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)]">
        <div className="section-label">Competencies</div>
        <h2 className="font-[family-name:var(--font-display)] text-[var(--text-2xl)] md:text-[var(--text-3xl)] font-700 mb-[var(--space-12)]" style={{ letterSpacing: "-0.02em" }}>
          Skills & Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-8)] md:gap-[var(--space-12)]">
          {skillGroups.map((group) => (
            <div key={group.category}>
              <h3 className="font-[family-name:var(--font-display)] text-[var(--text-base)] font-700 mb-[var(--space-4)]" style={{ color: "var(--color-accent)" }}>
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
    </section>
  );
}
