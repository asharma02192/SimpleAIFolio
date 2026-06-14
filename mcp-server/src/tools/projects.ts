import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface Project {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  thumbnail: string | null;
  featured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const projectTools: Tool[] = [
  {
    name: "list_projects",
    description: "List all portfolio projects, sorted by featured first then order.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_project",
    description: "Get a single project by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Project ID (UUID)" },
      },
    },
  },
  {
    name: "create_project",
    description: "Create a new portfolio project. Title and description are required.",
    inputSchema: {
      type: "object",
      required: ["title", "description"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        techStack: { type: "array", items: { type: "string" }, description: "Array of technologies (e.g. ['React', 'Node.js'])" },
        liveUrl: { type: "string", description: "Live demo URL" },
        githubUrl: { type: "string", description: "GitHub repo URL" },
        thumbnail: { type: "string", description: "Thumbnail image path/URL" },
        featured: { type: "boolean", description: "Whether this project is featured", default: false },
        order: { type: "number", description: "Display order (lower = first)", default: 0 },
      },
    },
  },
  {
    name: "update_project",
    description: "Update any field of a project. Only provided fields will be changed.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Project ID (UUID)" },
        title: { type: "string" },
        description: { type: "string" },
        techStack: { type: "array", items: { type: "string" } },
        liveUrl: { type: "string" },
        githubUrl: { type: "string" },
        thumbnail: { type: "string" },
        featured: { type: "boolean" },
        order: { type: "number" },
      },
    },
  },
  {
    name: "delete_project",
    description: "Delete a project by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Project ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleProjectTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_projects": {
      const { status, data } = await apiRequest<Project[]>("GET", "/api/projects", undefined, false);
      if (status !== 200) return fail(data);
      const projects = data.map((p) => ({ id: p.id, title: p.title, description: p.description, techStack: p.techStack, liveUrl: p.liveUrl, githubUrl: p.githubUrl, featured: p.featured, order: p.order }));
      return ok({ projects });
    }

    case "get_project": {
      const { status, data } = await apiRequest<Project[]>("GET", "/api/projects", undefined, false);
      if (status !== 200) return fail(data);
      const project = data.find((p) => p.id === args.id);
      if (!project) return fail("Project not found");
      return ok(project);
    }

    case "create_project": {
      const body: Record<string, unknown> = {};
      for (const k of ["title", "description", "techStack", "liveUrl", "githubUrl", "thumbnail", "featured", "order"]) {
        if (args[k] !== undefined) body[k] = args[k];
      }
      const { status, data } = await apiRequest<Project>("POST", "/api/projects", body);
      if (status !== 201) return fail(data);
      return ok({ success: true, project: { id: data.id, title: data.title } });
    }

    case "update_project": {
      const { id, confirm: _, ...updates } = args;
      const body: Record<string, unknown> = {};
      for (const k of ["title", "description", "techStack", "liveUrl", "githubUrl", "thumbnail", "featured", "order"]) {
        if (updates[k] !== undefined) body[k] = updates[k];
      }
      const { status, data } = await apiRequest<Project>("PUT", `/api/projects/${args.id}`, body);
      if (status !== 200) return fail(data);
      return ok({ success: true, project: { id: data.id, title: data.title } });
    }

    case "delete_project": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/projects/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
