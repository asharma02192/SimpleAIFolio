import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface Subscriber {
  id: string;
  email: string;
  active: boolean;
  createdAt: string;
}

export const newsletterTools: Tool[] = [
  {
    name: "list_subscribers",
    description: "List all newsletter subscribers with email, active status, and subscription date.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_subscriber",
    description: "Add an email address to the newsletter. If already subscribed (inactive), reactivates them.",
    inputSchema: {
      type: "object",
      required: ["email"],
      properties: {
        email: { type: "string", description: "Email address to subscribe" },
      },
    },
  },
  {
    name: "remove_subscriber",
    description: "Remove a subscriber by ID. Permanently deletes the subscriber record.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Subscriber ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleNewsletterTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_subscribers": {
      const { status, data } = await apiRequest<Subscriber[]>("GET", "/api/admin/newsletter");
      if (status !== 200) return fail(data);
      const active = data.filter((s) => s.active).length;
      return ok({ subscribers: data, total: data.length, active });
    }

    case "add_subscriber": {
      const { status, data } = await apiRequest<{ subscribed: boolean; id: string }>("POST", "/api/newsletter/subscribe", { email: args.email }, false);
      if (status !== 200) return fail(data);
      return ok({ success: true, subscribed: data.subscribed, id: data.id });
    }

    case "remove_subscriber": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/admin/newsletter/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
