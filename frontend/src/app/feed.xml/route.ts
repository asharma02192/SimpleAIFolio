import { fetchAllPublishedPosts, fetchSettings, getSiteUrl, logPublicFetchError } from "@/lib/config";
import type { Post } from "@/types";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const baseUrl = getSiteUrl();
  const settings = await fetchSettings();
  let posts: Post[] = [];

  try {
    posts = await fetchAllPublishedPosts();
  } catch (error) {
    logPublicFetchError("failed to build rss feed", error);
  }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.siteConfig.title)}</title>
    <description>${escapeXml(settings.siteConfig.description || settings.siteConfig.tagline)}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts
      .map((post) => {
        const postUrl = `${baseUrl}/blog/${post.slug}`;
        const description = post.metaDescription || post.excerpt || settings.siteConfig.description;
        const publishedAt = post.publishedAt || post.updatedAt || post.createdAt || new Date().toISOString();

        return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(description || "")}</description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${new Date(publishedAt).toUTCString()}</pubDate>
    </item>`;
      })
      .join("")}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=86400",
    },
  });
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
