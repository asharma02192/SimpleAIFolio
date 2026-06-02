import type { PaginatedResponse, Post, SiteConfig, SkillGroup } from "@/types";

export interface HeroStat {
  value: string;
  label: string;
}

export interface AnnouncementSettings {
  text: string;
  link: string;
  enabled: boolean;
}

export interface PublicSettings {
  siteConfig: SiteConfig;
  bioHero: string;
  bioAbout: string[];
  heroStats: HeroStat[];
  skillGroups: SkillGroup[];
  announcement: AnnouncementSettings;
}

type JsonRecord = Record<string, unknown>;
type ServerFetchOptions = RequestInit & { next?: { revalidate?: number } };
const missingEnvWarnings = new Set<string>();
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const publicFetchWarnings = new Set<string>();

export class ServerFetchError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ServerFetchError";
    this.status = status;
  }
}

// Default/fallback values used whenever the settings API is unavailable or incomplete.
export const siteConfig: SiteConfig = {
  title: "Amit",
  tagline: "Developer. Writer. Building with AI.",
  description: "Personal portfolio exploring AI tools, techniques, and intelligent agents.",
  authorName: "Amit",
  socialLinks: {
    github: "https://github.com",
    linkedin: "https://linkedin.com",
    twitter: "https://twitter.com",
    email: "hello@example.com",
  },
};

export const defaultSkillGroups: SkillGroup[] = [
  {
    category: "Frontend",
    skills: [
      { name: "React / Next.js", level: "expert" },
      { name: "TypeScript", level: "expert" },
      { name: "Tailwind CSS", level: "expert" },
      { name: "HTML / CSS", level: "expert" },
    ],
  },
  {
    category: "Backend",
    skills: [
      { name: "Node.js / Express", level: "expert" },
      { name: "Python", level: "proficient" },
      { name: "PostgreSQL", level: "proficient" },
      { name: "REST APIs", level: "expert" },
    ],
  },
  {
    category: "AI & Machine Learning",
    skills: [
      { name: "LLM Integration", level: "expert" },
      { name: "AI Agents / LangChain", level: "proficient" },
      { name: "Prompt Engineering", level: "expert" },
      { name: "RAG Systems", level: "proficient" },
    ],
  },
  {
    category: "DevOps & Tools",
    skills: [
      { name: "Docker", level: "proficient" },
      { name: "Linux / VPS", level: "expert" },
      { name: "Git / GitHub", level: "expert" },
      { name: "CI/CD", level: "proficient" },
    ],
  },
];

const defaultAnnouncement: AnnouncementSettings = {
  text: "",
  link: "",
  enabled: false,
};

export const navLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
  { href: "/projects", label: "Projects" },
] as const;

function getEnvWithFallback(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (!missingEnvWarnings.has(name)) {
    missingEnvWarnings.add(name);
    console.warn(`[config] ${name} is not set. Falling back to ${fallback}.`);
  }

  return fallback;
}

export const API_BASE = getEnvWithFallback("NEXT_PUBLIC_API_URL", "http://localhost:3001");
export const PUBLIC_REVALIDATE_SECONDS = 60;
export const SETTINGS_REVALIDATE_SECONDS = 60;

export function getSiteUrl() {
  const rawUrl = getEnvWithFallback("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

  try {
    const url = new URL(rawUrl);
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:3000";
  }
}

export function toAbsoluteUrl(value?: string | null) {
  if (!value) return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return `${getSiteUrl()}${trimmed}`;
  }

  return undefined;
}

export function logPublicFetchError(context: string, error: unknown) {
  if (publicFetchWarnings.has(context)) {
    return;
  }

  if (isBuildPhase && error instanceof Error && error.message.includes("fetch failed")) {
    publicFetchWarnings.add(context);
    console.warn(`[public] ${context}`);
    return;
  }

  publicFetchWarnings.add(context);
  console.error(`[public] ${context}`, error);
}

export function isServerFetchErrorStatus(error: unknown, status: number) {
  return error instanceof ServerFetchError && error.status === status;
}

function getFetchBaseUrl() {
  return process.env.API_INTERNAL_URL?.trim()
    || process.env.NEXT_PUBLIC_API_URL?.trim()
    || getEnvWithFallback("API_INTERNAL_URL", "http://localhost:3001");
}

export async function serverFetch<T>(path: string, options: ServerFetchOptions = {}): Promise<T> {
  const { next, cache, headers, ...rest } = options;
  const base = getFetchBaseUrl();
  const response = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...headers,
    },
    cache: cache ?? "force-cache",
    next: next ?? { revalidate: PUBLIC_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new ServerFetchError(response.status, `API error: ${response.status} for ${path}`);
  }

  return response.json() as Promise<T>;
}

function parseSocialLinks(value: unknown) {
  const links = (value && typeof value === "object" ? value : {}) as Record<string, string>;

  return {
    github: links.github || siteConfig.socialLinks.github,
    linkedin: links.linkedin || siteConfig.socialLinks.linkedin,
    twitter: links.twitter || siteConfig.socialLinks.twitter,
    email: links.email || siteConfig.socialLinks.email,
  };
}

function parseHeroStats(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((stat): stat is HeroStat => {
      if (!stat || typeof stat !== "object") return false;
      return typeof (stat as HeroStat).value === "string" && typeof (stat as HeroStat).label === "string";
    })
    .map((stat) => ({
      value: stat.value.trim(),
      label: stat.label.trim(),
    }))
    .filter((stat) => stat.value && stat.label);
}

function parseAnnouncement(value: unknown): AnnouncementSettings {
  if (!value || typeof value !== "object") return defaultAnnouncement;

  const announcement = value as Partial<AnnouncementSettings>;
  return {
    text: typeof announcement.text === "string" ? announcement.text : "",
    link: typeof announcement.link === "string" ? announcement.link : "",
    enabled: announcement.enabled === true,
  };
}

function buildSettings(data: JsonRecord): PublicSettings {
  return {
    siteConfig: {
      title: (data.site_title as string) || siteConfig.title,
      tagline: (data.tagline as string) || siteConfig.tagline,
      description: (data.description as string) || siteConfig.description,
      authorName: (data.author_name as string) || siteConfig.authorName,
      socialLinks: parseSocialLinks(data.social_links),
    },
    bioHero: (data.bio_hero as string) || "",
    bioAbout: [data.bio_about_1, data.bio_about_2, data.bio_about_3].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    ),
    heroStats: parseHeroStats(data.hero_stats),
    skillGroups: Array.isArray(data.skill_groups) && data.skill_groups.length > 0
      ? (data.skill_groups as SkillGroup[])
      : defaultSkillGroups,
    announcement: parseAnnouncement(data.announcement),
  };
}

export async function fetchSettings(): Promise<PublicSettings> {
  try {
    const data = await serverFetch<JsonRecord>("/api/settings", {
      next: { revalidate: SETTINGS_REVALIDATE_SECONDS },
    });
    return buildSettings(data);
  } catch (error) {
    logPublicFetchError("settings fetch failed, using defaults", error);
    return {
      siteConfig,
      bioHero: "",
      bioAbout: [],
      heroStats: [],
      skillGroups: defaultSkillGroups,
      announcement: defaultAnnouncement,
    };
  }
}

export async function fetchAllPublishedPosts() {
  const posts: Post[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await serverFetch<PaginatedResponse<Post>>(
      `/api/posts?perPage=50&page=${page}`,
      { next: { revalidate: PUBLIC_REVALIDATE_SECONDS } }
    );
    posts.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  } while (page <= totalPages);

  return posts;
}

export function getReadingTime(body: string): number {
  const wordsPerMinute = 200;
  const words = body.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}
