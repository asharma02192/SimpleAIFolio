import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface ExperienceEntry {
  id: string;
  role: string;
  period: string;
  description: string | null;
  order: number;
}

export const experienceTools: Tool[] = [
  {
    name: "list_experience",
    description: "List all experience/timeline entries, ordered by sort order.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_experience",
    description: "Add a new experience/timeline entry (e.g. job role, education, certification).",
    inputSchema: {
      type: "object",
      required: ["role"],
      properties: {
        role: { type: "string", description: "Job title or role name" },
        period: { type: "string", description: "Time period (e.g. '2023 — Present')" },
        description: { type: "string", description: "Description of responsibilities and achievements" },
        order: { type: "number", description: "Display order (lower = first)", default: 0 },
      },
    },
  },
  {
    name: "update_experience",
    description: "Update an experience entry by ID. Only provided fields will be changed.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Experience ID (UUID)" },
        role: { type: "string" },
        period: { type: "string" },
        description: { type: "string" },
        order: { type: "number" },
      },
    },
  },
  {
    name: "delete_experience",
    description: "Delete an experience entry by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Experience ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleExperienceTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_experience": {
      const { status, data } = await apiRequest<ExperienceEntry[]>("GET", "/api/experience", undefined, false);
      if (status !== 200) return fail(data);
      return ok({ experience: data });
    }

    case "create_experience": {
      const body: Record<string, unknown> = { role: args.role };
      if (args.period !== undefined) body.period = args.period;
      if (args.description !== undefined) body.description = args.description;
      if (args.order !== undefined) body.order = args.order;
      const { status, data } = await apiRequest<ExperienceEntry>("POST", "/api/experience", body);
      if (status !== 201) return fail(data);
      return ok({ success: true, experience: { id: data.id, role: data.role, period: data.period } });
    }

    case "update_experience": {
      const { id, confirm: _, ...updates } = args;
      const { status, data } = await apiRequest<ExperienceEntry>("PUT", `/api/experience/${id}`, updates);
      if (status !== 200) return fail(data);
      return ok({ success: true, experience: { id: data.id, role: data.role } });
    }

    case "delete_experience": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/experience/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
