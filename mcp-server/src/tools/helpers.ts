export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function ok(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function fail(data: unknown): ToolResult {
  const msg = typeof data === "object" && data !== null && "error" in data
    ? String((data as Record<string, unknown>).error)
    : typeof data === "string" && data
      ? data
      : "Request failed";
  return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
}
