import type { AnnouncementSettings } from "@/lib/config";

export default function AnnouncementBar({
  announcement,
}: {
  announcement: AnnouncementSettings;
}) {

  if (!announcement?.enabled || !announcement.text) return null;

  const Wrapper = announcement.link ? "a" : "div";
  const wrapperProps = announcement.link
    ? { href: announcement.link, target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <div
      className="w-full sticky top-0 z-50 overflow-hidden text-center announcement-surface"
      style={{
        background: "var(--announcement-bg)",
        borderBottom: "2px solid var(--color-accent)",
      }}
    >
      <Wrapper
        className="announcement-bar-inner relative inline-flex items-center justify-center gap-[var(--space-3)] py-[var(--space-3)] px-[var(--space-8)]"
        {...wrapperProps}
      >
        <span className="announcement-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} />
        <span
          className="announcement-text relative font-[family-name:var(--font-display)] text-[var(--text-base)] md:text-[var(--text-lg)] font-800 uppercase tracking-widest"
          style={{ color: "var(--color-bg)" }}
        >
          {announcement.text}
        </span>
        <span className="announcement-dot inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--color-accent)" }} />
        <div className="announcement-shimmer" />
      </Wrapper>
      <style>{`
        .announcement-bar-inner {
          animation: announcement-slide-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .announcement-dot {
          animation: announcement-dot-blink 1.5s ease-in-out infinite;
        }
        .announcement-dot:last-of-type {
          animation-delay: 0.75s;
        }
        .announcement-shimmer {
          position: absolute;
          top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          animation: announcement-shimmer 3s ease-in-out infinite;
        }
        @keyframes announcement-slide-in {
          0% { transform: translateY(-100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes announcement-dot-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes announcement-shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .announcement-bar-inner,
          .announcement-dot,
          .announcement-shimmer {
            animation: none !important;
          }
          .announcement-shimmer {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
