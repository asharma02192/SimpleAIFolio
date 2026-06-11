import { expect, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@myplweb.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:3201";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3200";

let cachedAdminToken: string | null = null;

async function requestAdminToken() {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });

  expect(response.ok).toBeTruthy();
  const data = (await response.json()) as { token: string };
  cachedAdminToken = data.token;
  return cachedAdminToken;
}

export async function loginViaUi(page: Page) {
  await page.goto("/admin");

  if (await page.getByText("Dashboard", { exact: true }).isVisible().catch(() => false)) {
    return;
  }

  const token = await requestAdminToken();
  await page.context().addCookies([
    {
      name: "admin_token",
      value: token,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/admin");
  await expect(page.getByText("Operational visibility", { exact: false })).toBeVisible();
}

export async function fetchAdminToken(request: APIRequestContext) {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  cachedAdminToken = data.token as string;
  return cachedAdminToken;
}

export async function fetchJson<T>(request: APIRequestContext, url: string, token?: string): Promise<T> {
  const response = await request.get(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<T>;
}

export { API_URL };
