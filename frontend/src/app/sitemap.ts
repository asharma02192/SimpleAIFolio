import type { MetadataRoute } from "next";
import { fetchAllPublishedPosts, getSiteUrl, logPublicFetchError } from "@/lib/config";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl();

  const pages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/projects`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];

  try {
    const posts = await fetchAllPublishedPosts();
    const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt || post.publishedAt || post.createdAt || Date.now()),
      changeFrequency: "monthly",
      priority: 0.6,
    }));

    return [...pages, ...postEntries];
  } catch (error) {
    logPublicFetchError("failed to build sitemap", error);
    return pages;
  }
}
