import { apiRequest } from "./client.js";

export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const resourceDefs: ResourceDef[] = [
  { uri: "posts://drafts", name: "Draft Posts", description: "All draft blog posts with title, slug, and excerpt", mimeType: "application/json" },
  { uri: "posts://published", name: "Published Posts", description: "All published blog posts with title, slug, and excerpt", mimeType: "application/json" },
  { uri: "posts://scheduled", name: "Scheduled Posts", description: "Posts scheduled for future publishing", mimeType: "application/json" },
  { uri: "site://settings", name: "Site Settings", description: "Current site configuration (name, theme, nav links, social)", mimeType: "application/json" },
  { uri: "site://stats", name: "Dashboard Stats", description: "Analytics snapshot: total views, posts, top pages, AI usage", mimeType: "application/json" },
  { uri: "newsletter://subscribers/count", name: "Newsletter Count", description: "Active and total newsletter subscriber counts", mimeType: "application/json" },
];

export async function readResource(uri: string): Promise<string> {
  switch (uri) {
    case "posts://drafts": {
      const { status, data } = await apiRequest<{ data: unknown[] }>("GET", "/api/posts?status=all&perPage=50");
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch posts" });
      const drafts = (data.data as Array<Record<string, unknown>>)
        .filter((p) => p.status === "DRAFT")
        .map((p) => ({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, updatedAt: p.updatedAt }));
      return JSON.stringify({ drafts, count: drafts.length }, null, 2);
    }

    case "posts://published": {
      const { status, data } = await apiRequest<{ data: unknown[] }>("GET", "/api/posts?perPage=50");
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch posts" });
      const published = (data.data as Array<Record<string, unknown>>)
        .map((p) => ({ id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, publishedAt: p.publishedAt, readingTime: p.readingTime }));
      return JSON.stringify({ published, count: published.length }, null, 2);
    }

    case "posts://scheduled": {
      const { status, data } = await apiRequest<{ data: unknown[] }>("GET", "/api/posts?status=all&perPage=50");
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch posts" });
      const scheduled = (data.data as Array<Record<string, unknown>>)
        .filter((p) => p.status === "SCHEDULED")
        .map((p) => ({ id: p.id, title: p.title, slug: p.slug, scheduledAt: p.scheduledAt }));
      return JSON.stringify({ scheduled, count: scheduled.length }, null, 2);
    }

    case "site://settings": {
      const { status, data } = await apiRequest<Record<string, unknown>>("GET", "/api/settings", undefined, false);
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch settings" });
      return JSON.stringify(data, null, 2);
    }

    case "site://stats": {
      const { status, data } = await apiRequest<Record<string, unknown>>("GET", "/api/analytics/dashboard?windowDays=30");
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch stats" });
      const summary = {
        totalViews: data.totalViews,
        recentViews: data.recentViews,
        totalPosts: data.totalPosts,
        publishedPosts: data.publishedPosts,
        totalProjects: data.totalProjects,
        topPages: data.topPages,
        aiOps: data.aiOps ? {
          totalCalls: (data.aiOps as Record<string, unknown>).totalCalls,
          totalTokens: (data.aiOps as Record<string, unknown>).totalTokens,
          estimatedCostUsd: (data.aiOps as Record<string, unknown>).estimatedCostUsd,
        } : null,
      };
      return JSON.stringify(summary, null, 2);
    }

    case "newsletter://subscribers/count": {
      const { status, data } = await apiRequest<Array<{ active: boolean }>>("GET", "/api/admin/newsletter");
      if (status !== 200) return JSON.stringify({ error: "Failed to fetch subscribers" });
      return JSON.stringify({ active: data.filter((s) => s.active).length, total: data.length }, null, 2);
    }

    default:
      return JSON.stringify({ error: `Unknown resource: ${uri}` });
  }
}
