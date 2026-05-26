import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

  // Static pages
  const pages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/projects`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  // With real API: fetch all published posts and add them
  // For now, add demo posts
  const posts: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog/building-ai-agents-langchain`, lastModified: new Date("2026-05-20"), priority: 0.6 },
    { url: `${baseUrl}/blog/ai-code-generation-2026`, lastModified: new Date("2026-05-15"), priority: 0.6 },
    { url: `${baseUrl}/blog/prompt-engineering-patterns`, lastModified: new Date("2026-05-10"), priority: 0.6 },
  ];

  return [...pages, ...posts];
}
