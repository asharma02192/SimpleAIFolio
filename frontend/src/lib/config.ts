import type { SiteConfig, SkillGroup } from "@/types";

// Default/fallback values — used when API is unreachable
export const siteConfig: SiteConfig = {
  title: "Amit",
  tagline: "Developer. Writer. Building with AI.",
  description: "Personal portfolio — exploring AI tools, techniques, and building intelligent agents.",
  authorName: "Amit",
  socialLinks: {
    github: "https://github.com",
    linkedin: "https://linkedin.com",
    twitter: "https://twitter.com",
    email: "hello@example.com",
  },
};

export const defaultSkillGroups: SkillGroup[] = [
  { category: "Frontend", skills: [
    { name: "React / Next.js", level: "expert" }, { name: "TypeScript", level: "expert" },
    { name: "Tailwind CSS", level: "expert" }, { name: "HTML / CSS", level: "expert" },
  ]},
  { category: "Backend", skills: [
    { name: "Node.js / Express", level: "expert" }, { name: "Python", level: "proficient" },
    { name: "PostgreSQL", level: "proficient" }, { name: "REST APIs", level: "expert" },
  ]},
  { category: "AI & Machine Learning", skills: [
    { name: "LLM Integration", level: "expert" }, { name: "AI Agents / LangChain", level: "proficient" },
    { name: "Prompt Engineering", level: "expert" }, { name: "RAG Systems", level: "proficient" },
  ]},
  { category: "DevOps & Tools", skills: [
    { name: "Docker", level: "proficient" }, { name: "Linux / VPS", level: "expert" },
    { name: "Git / GitHub", level: "expert" }, { name: "CI/CD", level: "proficient" },
  ]},
];

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/projects", label: "Projects" },
] as const;

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function serverFetch<T>(path: string): Promise<T> {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Fetch settings from API, merge with defaults
export async function fetchSettings() {
  try {
    const data = await serverFetch<Record<string, unknown>>("/api/settings");
    return {
      siteConfig: {
        title: (data.site_title as string) || siteConfig.title,
        tagline: (data.tagline as string) || siteConfig.tagline,
        description: (data.description as string) || siteConfig.description,
        authorName: (data.author_name as string) || siteConfig.authorName,
        socialLinks: {
          github: (data.social_links as Record<string, string>)?.github || siteConfig.socialLinks.github,
          linkedin: (data.social_links as Record<string, string>)?.linkedin || siteConfig.socialLinks.linkedin,
          twitter: (data.social_links as Record<string, string>)?.twitter || siteConfig.socialLinks.twitter,
          email: (data.social_links as Record<string, string>)?.email || siteConfig.socialLinks.email,
        },
      },
      bioHero: (data.bio_hero as string) || "",
      bioAbout: [data.bio_about_1, data.bio_about_2, data.bio_about_3].filter(Boolean) as string[],
      heroStats: (data.hero_stats as { value: string; label: string }[]) || [],
      skillGroups: (data.skill_groups as SkillGroup[]) || defaultSkillGroups,
      announcement: (data.announcement as { text: string; link: string; enabled: boolean }) || { text: "", link: "", enabled: false },
    };
  } catch {
    return {
      siteConfig,
      bioHero: "",
      bioAbout: [],
      heroStats: [],
      skillGroups: defaultSkillGroups,
      announcement: { text: "", link: "", enabled: false },
    };
  }
}

export function getReadingTime(body: string): number {
  const wordsPerMinute = 200;
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
