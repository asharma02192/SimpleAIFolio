import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

export const settingsTools: Tool[] = [
  {
    name: "get_settings",
    description: "Get all public site settings (site name, tagline, nav links, theme, social URLs, etc.). Returns a flat key-value object.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_settings",
    description: "Update site settings. Pass a key-value object of settings to update. Common keys: siteName, tagline, siteUrl, navLinks, theme, socialLinks, footerText.",
    inputSchema: {
      type: "object",
      properties: {
        updates: {
          type: "object",
          description: "Object of setting key-value pairs to update. Values can be strings, numbers, booleans, arrays, or objects.",
          additionalProperties: true,
        },
      },
    },
  },
  {
    name: "publish_scheduled",
    description: "Trigger the scheduler to publish all posts whose scheduledAt time has passed. Returns the number of posts published.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleSettingsTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "get_settings": {
      const { status, data } = await apiRequest<Record<string, unknown>>("GET", "/api/settings", undefined, false);
      if (status !== 200) return fail(data);
      return ok({ settings: data });
    }

    case "update_settings": {
      const updates = args.updates || {};
      if (typeof updates !== "object" || Object.keys(updates as object).length === 0) {
        return fail("Provide at least one setting to update in the 'updates' object");
      }
      const { status, data } = await apiRequest("PUT", "/api/settings", updates);
      if (status !== 200) return fail(data);
      return ok({ success: true, updated: Object.keys(updates as object) });
    }

    case "publish_scheduled": {
      const { status, data } = await apiRequest<{ published: number }>("POST", "/api/admin/publish-due");
      if (status !== 200) return fail(data);
      return ok({ success: true, published: data.published });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
