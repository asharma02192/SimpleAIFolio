import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
}

export const categoryTools: Tool[] = [
  {
    name: "list_categories",
    description: "List all categories with their post counts. Sorted alphabetically.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_category",
    description: "Create a new category. Name and slug are required.",
    inputSchema: {
      type: "object",
      required: ["name", "slug"],
      properties: {
        name: { type: "string", description: "Category display name" },
        slug: { type: "string", description: "URL-safe slug (e.g. 'web-development')" },
        description: { type: "string", description: "Optional category description" },
      },
    },
  },
  {
    name: "update_category",
    description: "Update a category by ID. Only provided fields will be changed.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Category ID (UUID)" },
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string" },
      },
    },
  },
  {
    name: "delete_category",
    description: "Delete a category by ID. Posts in this category will have their category unset.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Category ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleCategoryTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_categories": {
      const { status, data } = await apiRequest<Category[]>("GET", "/api/categories", undefined, false);
      if (status !== 200) return fail(data);
      const categories = data.map((c) => ({ id: c.id, name: c.name, slug: c.slug, description: c.description, postCount: c.postCount }));
      return ok({ categories });
    }

    case "create_category": {
      const body: Record<string, unknown> = { name: args.name, slug: args.slug };
      if (args.description !== undefined) body.description = args.description;
      const { status, data } = await apiRequest<Category>("POST", "/api/categories", body);
      if (status !== 201) return fail(data);
      return ok({ success: true, category: { id: data.id, name: data.name, slug: data.slug } });
    }

    case "update_category": {
      const { id, confirm: _, ...updates } = args;
      const { status, data } = await apiRequest<Category>("PUT", `/api/categories/${args.id}`, updates);
      if (status !== 200) return fail(data);
      return ok({ success: true, category: { id: data.id, name: data.name, slug: data.slug } });
    }

    case "delete_category": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/categories/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
