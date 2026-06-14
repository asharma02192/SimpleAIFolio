import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { apiRequest, API_URL, getToken } from "../client.js";
import { ok, fail } from "./helpers.js";
import type { ToolResult } from "./helpers.js";

interface MediaFile {
  url: string;
  thumbnail: string;
  name: string;
}

export const mediaTools: Tool[] = [
  {
    name: "list_media",
    description: "List all uploaded media files (images). Returns URLs and thumbnails.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "upload_media",
    description: "Upload an image to the media library. The image is converted to WebP and a thumbnail is generated. Pass either a base64 string or a file path/URL.",
    inputSchema: {
      type: "object",
      required: ["base64"],
      properties: {
        base64: { type: "string", description: "Base64-encoded image data (with or without data URI prefix)" },
        filename: { type: "string", description: "Original filename including extension (e.g. 'photo.jpg'). Defaults to 'upload.png'." },
      },
    },
  },
  {
    name: "delete_media",
    description: "Delete a media file by filename.",
    inputSchema: {
      type: "object",
      required: ["filename"],
      properties: {
        filename: { type: "string", description: "Filename in the uploads directory (e.g. 'abc123.webp')" },
        confirm: { type: "boolean", description: "Must be true to confirm deletion", default: false },
      },
    },
  },
];

export async function handleMediaTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case "list_media": {
      const { status, data } = await apiRequest<MediaFile[]>("GET", "/api/media");
      if (status !== 200) return fail(data);
      return ok({ media: data });
    }

    case "upload_media": {
      let base64 = String(args.base64 || "");
      const filename = String(args.filename || "upload.png");
      const mimeMatch = base64.match(/^data:(image\/[a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
      base64 = base64.replace(/^data:image\/[a-z]+;base64,/, "");

      const token = await getToken();
      if (!token) return fail("Not authenticated");

      const buffer = Buffer.from(base64, "base64");
      const boundary = "----MCPBoundary" + Math.random().toString(36).slice(2);
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
        buffer,
        `\r\n--${boundary}--\r\n`,
      ];
      const body = Buffer.concat(parts.map((p) => (typeof p === "string" ? Buffer.from(p) : p)));

      const url = new URL("/api/media/upload", API_URL);
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      const text = await res.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { data = text; }

      if (res.status !== 201) return fail(data);
      return ok(data);
    }

    case "delete_media": {
      if (!args.confirm) return fail("Set confirm=true to confirm deletion");
      const { status, data } = await apiRequest("DELETE", `/api/media/${args.filename}`);
      if (status !== 204) return fail(data);
      return ok({ success: true, deleted: true, filename: args.filename });
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}
