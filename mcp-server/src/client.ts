const API_URL = process.env.MCP_API_URL || "http://localhost:3201";
const AUTH_EMAIL = process.env.MCP_AUTH_EMAIL || "";
const AUTH_PASSWORD = process.env.MCP_AUTH_PASSWORD || "";
const ENV_TOKEN = process.env.MCP_API_TOKEN || "";
const MCP_CONFIG_URL = process.env.MCP_MCP_CONFIG_URL || "";
const API_TIMEOUT_MS = Number(process.env.MCP_API_TIMEOUT_MS || "120000");

let cachedToken: string | null = ENV_TOKEN || null;
let tokenExpiry = 0;

let cachedRemoteApiKey: string | null = null;
let remoteApiKeyExpiry = 0;
const REMOTE_KEY_TTL = 60_000;

export async function getRemoteApiKey(): Promise<string | null> {
  if (cachedRemoteApiKey && Date.now() < remoteApiKeyExpiry) return cachedRemoteApiKey;
  if (!MCP_CONFIG_URL) return null;

  try {
    const res = await fetch(MCP_CONFIG_URL);
    if (res.ok) {
      const data = (await res.json()) as { apiKey?: string };
      if (data.apiKey) {
        cachedRemoteApiKey = data.apiKey;
        remoteApiKeyExpiry = Date.now() + REMOTE_KEY_TTL;
        return cachedRemoteApiKey;
      }
    }
  } catch { /* fall through to env var */ }

  return process.env.MCP_REMOTE_API_KEY || null;
}

export function clearRemoteApiKey(): void {
  cachedRemoteApiKey = null;
  remoteApiKeyExpiry = 0;
}

async function login(): Promise<string> {
  const url = new URL("/api/auth/login", API_URL);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

export async function getToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  if (ENV_TOKEN) {
    cachedToken = ENV_TOKEN;
    tokenExpiry = Date.now() + 6 * 24 * 60 * 60 * 1000;
    return cachedToken;
  }

  if (!AUTH_EMAIL || !AUTH_PASSWORD) return null;

  try {
    cachedToken = await login();
    tokenExpiry = Date.now() + 6 * 24 * 60 * 60 * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  cachedToken = null;
  tokenExpiry = 0;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = true,
): Promise<ApiResponse<T>> {
  const token = requireAuth ? await getToken() : null;
  if (requireAuth && !token) {
    throw new Error("Not authenticated. Set MCP_AUTH_EMAIL and MCP_AUTH_PASSWORD or MCP_API_TOKEN in environment.");
  }

  const url = new URL(path, API_URL);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const payload = body !== undefined ? JSON.stringify(body) : undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (res.status === 401 && requireAuth && !ENV_TOKEN) {
      clearToken();
    }

    return { status: res.status, data: data as T };
  } finally {
    clearTimeout(timeout);
  }
}

export { API_URL };
