import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount: number;
}

export const tagTools: Tool[] = [
  {
    name: "list_tags",
    description: "List all tags with their post counts. Sorted alphabetically.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_tag",
    description: "Create a new tag. Name and slug are required.",
    inputSchema: {
      type: "object",
      required: ["name", "slug"],
      properties: {
        name: { type: "string", description: "Tag display name" },
        slug: { type: "string", description: "URL-safe slug (e.g. 'typescript')" },
      },
    },
  },
  {
    name: "update_tag",
    description: "Update a tag by ID. Only provided fields will be changed.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Tag ID (UUID)" },
        name: { type: "string" },
        slug: { type: "string" },
      },
    },
  },
  {
    name: "delete_tag",
    description: "Delete a tag by ID. Posts using this tag will have it unlinked.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Tag ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleTagTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_tags": {
      const { status, data } = await apiRequest<Tag[]>("GET", "/api/tags", undefined, false);
      if (status !== 200) return fail(data);
      const tags = data.map((t) => ({ id: t.id, name: t.name, slug: t.slug, postCount: t.postCount }));
      return ok({ tags });
    }

    case "create_tag": {
      const { status, data } = await apiRequest<Tag>("POST", "/api/tags", { name: args.name, slug: args.slug });
      if (status !== 201) return fail(data);
      return ok({ success: true, tag: { id: data.id, name: data.name, slug: data.slug } });
    }

    case "update_tag": {
      const { id, ...updates } = args;
      const { status, data } = await apiRequest<Tag>("PUT", `/api/tags/${id}`, updates);
      if (status !== 200) return fail(data);
      return ok({ success: true, tag: { id: data.id, name: data.name, slug: data.slug } });
    }

    case "delete_tag": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/tags/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
