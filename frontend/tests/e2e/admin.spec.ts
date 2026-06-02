import { test, expect } from "@playwright/test";
import { API_URL, fetchJson, loginViaUi } from "./helpers";

type Category = { id: string; name: string; slug: string };
type Tag = { id: string; name: string; slug: string };

test("admin posts page redirects when logged out", async ({ page }) => {
  await page.goto("/admin/posts");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Admin Login" })).toBeVisible();
});

test("admin login works and posts page loads after login", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/posts");
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
});

test("duplicate category create shows an error and keeps the form open", async ({ page, request }) => {
  const categories = await fetchJson<Category[]>(request, `${API_URL}/api/categories`);
  test.skip(categories.length === 0, "Requires at least one existing category");

  await loginViaUi(page);
  await page.goto("/admin/categories");
  await page.getByRole("button", { name: "+ New Category" }).click();
  await page.locator("#category-name").fill(categories[0].name);
  await page.locator("#category-slug").fill(categories[0].slug);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("main").getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Category" })).toBeVisible();
  await expect(page.locator("#category-name")).toHaveValue(categories[0].name);
});

test("duplicate tag create shows an error and keeps the form open", async ({ page, request }) => {
  const tags = await fetchJson<Tag[]>(request, `${API_URL}/api/tags`);
  test.skip(tags.length === 0, "Requires at least one existing tag");

  await loginViaUi(page);
  await page.goto("/admin/tags");
  await page.getByRole("button", { name: "+ New Tag" }).click();
  await page.locator("#tag-name").fill(tags[0].name);
  await page.locator("#tag-slug").fill(tags[0].slug);
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.locator("main").getByText(/already exists/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "New Tag" })).toBeVisible();
  await expect(page.locator("#tag-name")).toHaveValue(tags[0].name);
});

test("invalid settings JSON shows an error and blocks false save", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/settings");
  await page.locator("#settings-skill-groups").fill("{\"invalid\": true");
  await page.getByRole("button", { name: "Save All" }).click();

  await expect(page.locator("main").getByText(/must be valid json|expected ',' or '}'|json array/i).first()).toBeVisible();
  await expect(page.locator("#settings-skill-groups")).toHaveValue("{\"invalid\": true");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("post editor requires a title", async ({ page }) => {
  await loginViaUi(page);
  await page.goto("/admin/posts/new");
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.locator("main").getByText("Title is required")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/posts\/new$/);
});
