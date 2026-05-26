import { siteConfig } from "@/lib/config";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000";

  // With real API: fetch published posts from backend
  // For now, use demo posts
  const posts = [
    {
      title: "Building AI Agents with LangChain: A Practical Guide",
      slug: "building-ai-agents-langchain",
      excerpt: "A hands-on walkthrough of creating autonomous AI agents that can reason, plan, and execute multi-step tasks.",
      publishedAt: "2026-05-20",
    },
    {
      title: "The State of AI Code Generation in 2026",
      slug: "ai-code-generation-2026",
      excerpt: "Comparing the latest AI coding tools, their strengths, limitations, and where the industry is heading next.",
      publishedAt: "2026-05-15",
    },
    {
      title: "Prompt Engineering Patterns That Actually Work",
      slug: "prompt-engineering-patterns",
      excerpt: "Beyond basic prompting — structured patterns for chain-of-thought, few-shot learning, and system prompt design.",
      publishedAt: "2026-05-10",
    },
  ];

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${siteConfig.title}</title>
    <description>${siteConfig.description}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts
      .map(
        (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <description>${escapeXml(post.excerpt)}</description>
      <link>${baseUrl}/blog/${post.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
    </item>`
      )
      .join("")}
  </channel>
</rss>`;

  return new Response(rss.trim(), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
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
