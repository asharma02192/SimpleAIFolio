import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export const contactTools: Tool[] = [
  {
    name: "list_messages",
    description: "List all contact form submissions, newest first. Each message includes name, email, subject, body, read status, and date.",
    inputSchema: {
      type: "object",
      properties: {
        unreadOnly: { type: "boolean", description: "Filter to only unread messages", default: false },
      },
    },
  },
  {
    name: "mark_message_read",
    description: "Mark a contact message as read. Toggle unread by passing read=false.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Message ID (UUID)" },
        read: { type: "boolean", description: "true to mark read (default), false to mark unread", default: true },
      },
    },
  },
  {
    name: "delete_message",
    description: "Delete a contact message by ID.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Message ID (UUID)" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleContactTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_messages": {
      const { status, data } = await apiRequest<ContactMessage[]>("GET", "/api/admin/contact");
      if (status !== 200) return fail(data);
      const messages = args.unreadOnly ? data.filter((m) => !m.read) : data;
      return ok({ messages, total: messages.length, unread: data.filter((m) => !m.read).length });
    }

    case "mark_message_read": {
      if (args.read === false) {
        return fail("Marking as unread is not supported by the current API. Messages can only be marked as read.");
      }
      const { status, data } = await apiRequest<ContactMessage>("PUT", `/api/admin/contact/${args.id}/read`);
      if (status !== 200) return fail(data);
      return ok({ success: true, messageId: data.id, read: data.read });
    }

    case "delete_message": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/admin/contact/${args.id}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, id: args.id });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
