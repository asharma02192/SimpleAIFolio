import Link from "next/link";
import { siteConfig } from "@/lib/config";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        background: "oklch(12% 0.015 265)",
        color: "oklch(75% 0.01 265)",
      }}
    >
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)] py-[var(--space-16)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[var(--space-12)]">
          {/* Branding */}
          <div className="md:col-span-5">
            <div className="flex items-center gap-2 mb-[var(--space-4)]">
              <span
                className="inline-flex items-center justify-center w-7 h-7 text-[var(--text-xs)] font-700"
                style={{
                  background: "var(--color-accent)",
                  color: "var(--color-accent-on)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                A
              </span>
              <span
                className="font-[family-name:var(--font-display)] text-[1.125rem] font-700"
                style={{ color: "oklch(92% 0.01 265)" }}
              >
                {siteConfig.title}
              </span>
            </div>
            <p
              className="font-[family-name:var(--font-body)] text-[var(--text-sm)] leading-[var(--leading-normal)] max-w-[24rem]"
              style={{ color: "oklch(65% 0.01 265)" }}
            >
              {siteConfig.tagline}
            </p>
          </div>

          {/* Pages */}
          <div className="md:col-span-3">
            <p
              className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-widest mb-[var(--space-4)]"
              style={{ color: "oklch(55% 0.015 265)" }}
            >
              Pages
            </p>
            <ul className="flex flex-col gap-[var(--space-3)]">
              {(["About", "Blog", "Projects"] as const).map((page) => (
                <li key={page}>
                  <Link
                    href={`/${page.toLowerCase()}`}
                    className="font-[family-name:var(--font-body)] text-[var(--text-sm)] transition-colors hover:text-[oklch(90%_0.02_265)]"
                    style={{ color: "oklch(65% 0.01 265)" }}
                  >
                    {page}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div className="md:col-span-4">
            <p
              className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-widest mb-[var(--space-4)]"
              style={{ color: "oklch(55% 0.015 265)" }}
            >
              Connect
            </p>
            <ul className="flex flex-col gap-[var(--space-3)]">
              {Object.entries(siteConfig.socialLinks).map(([name, url]) =>
                url ? (
                  <li key={name}>
                    <a
                      href={name === "email" ? `mailto:${url}` : url}
                      className="font-[family-name:var(--font-body)] text-[var(--text-sm)] capitalize transition-colors hover:text-[oklch(90%_0.02_265)]"
                      style={{ color: "oklch(65% 0.01 265)" }}
                      {...(name !== "email"
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {name}
                    </a>
                  </li>
                ) : null
              )}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-[var(--space-12)] pt-[var(--space-6)] flex flex-col sm:flex-row justify-between gap-[var(--space-3)]"
          style={{ borderTop: "1px solid oklch(25% 0.015 265)" }}
        >
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
            style={{ color: "oklch(45% 0.015 265)" }}
          >
            &copy; {year} {siteConfig.authorName}
          </p>
          <a
            href="/feed.xml"
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors hover:text-[oklch(90%_0.02_265)]"
            style={{ color: "oklch(45% 0.015 265)" }}
          >
            RSS Feed
          </a>
        </div>
      </div>
    </footer>
  );
}
