import type { MetadataRoute } from "next";
import { fetchAllPublishedPosts, getSiteUrl, logPublicFetchError, serverFetch } from "@/lib/config";
import type { Project } from "@/types";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const pages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/projects`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  try {
    const posts = await fetchAllPublishedPosts();
    const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAt || post.updatedAt || post.createdAt || Date.now()),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    let projectEntries: MetadataRoute.Sitemap = [];
    try {
      const projects = await serverFetch<Project[]>("/api/projects");
      projectEntries = projects.map((project) => ({
        url: `${baseUrl}/projects/${project.id}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      }));
    } catch {
      // ignore project fetch failures in sitemap
    }

    return [...pages, ...postEntries, ...projectEntries];
  } catch (error) {
    logPublicFetchError("failed to build sitemap", error);
    return pages;
  }
}
