import { expect, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@myplweb.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const API_URL = process.env.PLAYWRIGHT_API_URL || "http://localhost:3201";

export async function loginViaUi(page: Page) {
  await page.goto("/admin");

  if (await page.getByRole("heading", { name: "Dashboard" }).isVisible().catch(() => false)) {
    return;
  }

  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

export async function fetchAdminToken(request: APIRequestContext) {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    },
  });

  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  return data.token as string;
}

export async function fetchJson<T>(request: APIRequestContext, url: string, token?: string): Promise<T> {
  const response = await request.get(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<T>;
}

export { API_URL };
