import type { PublicSettings } from "@/lib/config";

export default function HeroSection({
  settings,
}: {
  settings: PublicSettings;
}) {
  const { siteConfig: cfg, bioHero, heroStats } = settings;

  return (
    <section className="relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)", filter: "blur(60px)" }} />

      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)] pt-[var(--space-16)] md:pt-[var(--space-24)] pb-[var(--space-16)]">
        <div className="section-label">Portfolio</div>

        <div className="grid grid-cols-12 gap-x-[var(--space-8)] gap-y-[var(--space-8)] items-start">
          <div className="col-span-12 lg:col-span-8">
            <h1 className="font-[family-name:var(--font-display)] font-800 leading-[var(--leading-tight)] mb-[var(--space-6)]" style={{ fontSize: "clamp(2.75rem, 7vw, 4.5rem)", color: "var(--color-text)", letterSpacing: "-0.03em" }}>
              {cfg.authorName}
            </h1>
            <p className="font-[family-name:var(--font-body)] text-[var(--text-lg)] md:text-[var(--text-xl)] font-400 leading-[1.4] max-w-[38rem]" style={{ color: "var(--color-text-secondary)" }}>
              {cfg.tagline}
            </p>

            {heroStats.length > 0 && (
              <div className="flex flex-wrap gap-x-[var(--space-12)] gap-y-[var(--space-6)] mt-[var(--space-12)]">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="min-w-[5rem]">
                    <span className="font-[family-name:var(--font-display)] text-[var(--text-lg)] font-700 block" style={{ color: "var(--color-accent)" }}>{stat.value}</span>
                    <span className="font-[family-name:var(--font-body)] text-[var(--text-xs)] mt-[var(--space-1)] block" style={{ color: "var(--color-text-tertiary)" }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="p-[var(--space-6)] lg:p-[var(--space-8)]" style={{ background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)" }}>
              {bioHero && (
                <p className="font-[family-name:var(--font-body)] text-[var(--text-base)] leading-[var(--leading-relaxed)]" style={{ color: "var(--color-text-secondary)" }}>
                  {bioHero}
                </p>
              )}
              <div className="mt-[var(--space-6)] pt-[var(--space-6)] grid grid-cols-2 gap-x-[var(--space-4)] gap-y-[var(--space-3)]" style={{ borderTop: "1px solid var(--color-border)" }}>
                {cfg.socialLinks.github && (
                  <a href={cfg.socialLinks.github} target="_blank" rel="noopener noreferrer" className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 flex items-center gap-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} /> GitHub
                  </a>
                )}
                {cfg.socialLinks.linkedin && (
                  <a href={cfg.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 flex items-center gap-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} /> LinkedIn
                  </a>
                )}
                {cfg.socialLinks.twitter && (
                  <a href={cfg.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 flex items-center gap-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} /> Twitter
                  </a>
                )}
                {cfg.socialLinks.email && (
                  <a href={`mailto:${cfg.socialLinks.email}`} className="font-[family-name:var(--font-body)] text-[var(--text-sm)] font-500 flex items-center gap-[var(--space-2)] transition-colors hover:text-[var(--color-accent)]" style={{ color: "var(--color-text-secondary)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} /> Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
