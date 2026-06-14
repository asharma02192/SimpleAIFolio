import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

export const analyticsTools: Tool[] = [
  {
    name: "get_dashboard_stats",
    description: "Get comprehensive analytics dashboard: total page views, top pages, post/project counts, AI usage stats (calls, tokens, cost, latency, failures), provider/model breakdowns, alerts, and daily usage trends. Window: 7, 30, or 90 days.",
    inputSchema: {
      type: "object",
      properties: {
        windowDays: { type: "number", enum: [7, 30, 90], default: 30, description: "Time window for stats" },
      },
    },
  },
  {
    name: "get_page_views",
    description: "Get the total view count for a specific page path (e.g. '/blog/my-post-slug').",
    inputSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: { type: "string", description: "Page path (e.g. '/blog/my-post', '/about', '/')" },
      },
    },
  },
  {
    name: "get_top_pages",
    description: "Get the top 10 most viewed pages in the time window. Returns path and view count.",
    inputSchema: {
      type: "object",
      properties: {
        windowDays: { type: "number", enum: [7, 30, 90], default: 30 },
      },
    },
  },
  {
    name: "get_analytics_alerts",
    description: "Get AI ops alert settings (webhook/telegram notification config, min alert level, cooldown).",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleAnalyticsTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_dashboard_stats": {
      const days = args.windowDays || 30;
      const { status, data } = await apiRequest<Record<string, unknown>>("GET", `/api/analytics/dashboard?windowDays=${days}`);
      if (status !== 200) return fail(data);
      return ok(data);
    }

    case "get_page_views": {
      const { status, data } = await apiRequest<{ views: number }>("GET", `/api/analytics/page-views?path=${encodeURIComponent(String(args.path))}`, undefined, false);
      if (status !== 200) return fail(data);
      return ok({ path: args.path, views: data.views });
    }

    case "get_top_pages": {
      const days = args.windowDays || 30;
      const { status, data } = await apiRequest<Array<{ path: string; views: number }>>("GET", `/api/analytics/pages?windowDays=${days}`);
      if (status !== 200) return fail(data);
      return ok({ topPages: data });
    }

    case "get_analytics_alerts": {
      const { status, data } = await apiRequest<Record<string, unknown>>("GET", "/api/analytics/alert-settings");
      if (status !== 200) return fail(data);
      return ok(data);
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
