"use client";

import Link from "next/link";
import NewsletterSignup from "./NewsletterSignup";
import type { SiteConfig } from "@/types";

export default function Footer({
  siteConfig,
}: {
  siteConfig: SiteConfig;
}) {
  const year = new Date().getFullYear();
  const brandLetter = siteConfig.title.trim().charAt(0).toUpperCase() || "A";
  const socials = Object.entries(siteConfig.socialLinks).filter(([, url]) => url);

  return (
    <footer
      className="footer-surface"
      style={{
        background: "var(--footer-bg)",
        color: "var(--footer-text)",
      }}
    >
      <div className="max-w-[var(--max-width)] mx-auto px-[var(--space-6)] lg:px-[var(--space-12)] py-[var(--space-16)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-[var(--space-12)]">
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
                {brandLetter}
              </span>
              <span
                className="font-[family-name:var(--font-display)] text-[1.125rem] font-700"
                style={{ color: "var(--footer-heading)" }}
              >
                {siteConfig.title}
              </span>
            </div>
            <p
              className="font-[family-name:var(--font-body)] text-[var(--text-sm)] leading-[var(--leading-normal)] max-w-[24rem]"
              style={{ color: "var(--footer-link)" }}
            >
              {siteConfig.tagline}
            </p>
          </div>

          <div className="md:col-span-3">
            <p
              className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-widest mb-[var(--space-4)]"
              style={{ color: "var(--footer-muted)" }}
            >
              Pages
            </p>
            <ul className="flex flex-col gap-[var(--space-3)]">
              {(["About", "Blog", "Projects"] as const).map((page) => (
                <li key={page}>
                  <Link
                    href={`/${page.toLowerCase()}`}
                    className="font-[family-name:var(--font-body)] text-[var(--text-sm)] transition-colors duration-150"
                    style={{ color: "var(--footer-link)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--footer-link-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--footer-link)"; }}
                  >
                    {page}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <p
              className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-widest mb-[var(--space-4)]"
              style={{ color: "var(--footer-muted)" }}
            >
              Newsletter
            </p>
            <p
              className="font-[family-name:var(--font-body)] text-[var(--text-sm)] mb-[var(--space-3)]"
              style={{ color: "var(--footer-link)" }}
            >
              Get notified when I publish new posts.
            </p>
            <NewsletterSignup />

            {socials.length > 0 && (
              <div className="mt-[var(--space-5)]">
                <p
                  className="font-[family-name:var(--font-display)] text-[var(--text-xs)] font-700 uppercase tracking-widest mb-[var(--space-3)]"
                  style={{ color: "var(--footer-muted)" }}
                >
                  Connect
                </p>
                <div className="flex flex-wrap gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
                  {socials.map(([name, url]) => (
                    <a
                      key={name}
                      href={name === "email" ? `mailto:${url}` : url}
                      className="font-[family-name:var(--font-body)] text-[var(--text-sm)] capitalize transition-colors duration-150"
                      style={{ color: "var(--footer-link)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--footer-link-hover)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--footer-link)"; }}
                      {...(name !== "email"
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                    >
                      {name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="mt-[var(--space-12)] pt-[var(--space-6)] flex flex-col sm:flex-row justify-between gap-[var(--space-3)]"
          style={{ borderTop: "1px solid var(--footer-divider)" }}
        >
          <p
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)]"
            style={{ color: "var(--footer-copyright)" }}
          >
            &copy; {year} {siteConfig.authorName}
          </p>
          <a
            href="/feed.xml"
            className="font-[family-name:var(--font-mono)] text-[var(--text-xs)] transition-colors"
            style={{ color: "var(--footer-copyright)" }}
          >
            RSS Feed
          </a>
        </div>
      </div>
    </footer>
  );
}
