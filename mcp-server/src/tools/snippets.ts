import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface Snippet {
  id: string;
  name: string;
  location: string;
  code: string;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const snippetTools: Tool[] = [
  {
    name: "list_snippets",
    description: "List all tracking/analytics script snippets (e.g. Google Analytics, GTM, Facebook Pixel). Includes disabled ones. Snippets are injected into the frontend based on their location (head or body_end).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_snippet",
    description: "Create a new tracking script snippet. The code will be injected into all pages at the specified location.",
    inputSchema: {
      type: "object",
      required: ["name", "code"],
      properties: {
        name: { type: "string", description: "Human-readable name (e.g. 'Google Analytics 4')" },
        code: { type: "string", description: "The script code (HTML/JS) to inject" },
        location: { type: "string", enum: ["head", "body_end"], default: "head", description: "Where to inject: 'head' (in <head>) or 'body_end' (before </body>)" },
        enabled: { type: "boolean", default: true, description: "Whether the snippet is active" },
        order: { type: "number", default: 0, description: "Sort order (lower = earlier)" },
      },
    },
  },
  {
    name: "update_snippet",
    description: "Update a script snippet. Commonly used to toggle enabled, change code, or reorder. Only provided fields will be changed.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Snippet ID (UUID)" },
        name: { type: "string" },
        code: { type: "string" },
        location: { type: "string", enum: ["head", "body_end"] },
        enabled: { type: "boolean" },
        order: { type: "number" },
      },
    },
  },
  {
    name: "delete_snippet",
    description: "Delete a tracking script snippet by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Snippet ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleSnippetTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_snippets": {
      const { status, data } = await apiRequest<Snippet[]>("GET", "/api/admin/snippets");
      if (status !== 200) return fail(data);
      return ok({ snippets: data, total: data.length, active: data.filter((s) => s.enabled).length });
    }

    case "create_snippet": {
      const body: Record<string, unknown> = { name: args.name, code: args.code };
      if (args.location !== undefined) body.location = args.location;
      if (args.enabled !== undefined) body.enabled = args.enabled;
      if (args.order !== undefined) body.order = args.order;
      const { status, data } = await apiRequest<Snippet>("POST", "/api/admin/snippets", body);
      if (status !== 201) return fail(data);
      return ok({ success: true, snippet: { id: data.id, name: data.name, location: data.location, enabled: data.enabled } });
    }

    case "update_snippet": {
      const { id, confirm: _, ...updates } = args;
      const body: Record<string, unknown> = {};
      for (const k of ["name", "code", "location", "enabled", "order"]) {
        if (updates[k] !== undefined) body[k] = updates[k];
      }
      const { status, data } = await apiRequest<Snippet>("PUT", `/api/admin/snippets/${id}`, body);
      if (status !== 200) return fail(data);
      return ok({ success: true, snippet: { id: data.id, name: data.name, enabled: data.enabled } });
    }

    case "delete_snippet": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/admin/snippets/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
