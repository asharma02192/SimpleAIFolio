import { test, expect } from "@playwright/test";
import { API_URL, fetchAdminToken, fetchJson } from "./helpers";

type PostSummary = {
  slug: string;
  status: string;
};

test("public home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Portfolio|Home/i);
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
});

test("blog listing loads and draft posts do not appear publicly", async ({ page, request }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Writing" })).toBeVisible();

  const token = await fetchAdminToken(request);
  const adminPosts = await fetchJson<{ data: PostSummary[] }>(request, `${API_URL}/api/posts?status=all&perPage=100`, token);
  const draftSlugs = adminPosts.data.filter((post) => post.status === "DRAFT").map((post) => post.slug);
  const listingText = await page.locator("main").innerText();

  for (const slug of draftSlugs) {
    await expect(page.locator("main")).not.toContainText(slug);
    expect(listingText).not.toContain(slug);
  }
});

test("sitemap excludes draft and demo slugs", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();

  expect(body).toContain("/about");
  expect(body).toContain("/blog");
  expect(body).not.toContain("ai-code-generation-2026");

  const token = await fetchAdminToken(request);
  const adminPosts = await fetchJson<{ data: PostSummary[] }>(request, `${API_URL}/api/posts?status=all&perPage=100`, token);
  const draftSlugs = adminPosts.data.filter((post) => post.status === "DRAFT").map((post) => post.slug);
  for (const slug of draftSlugs) {
    expect(body).not.toContain(`/blog/${slug}`);
  }
});

test("feed excludes draft and demo slugs", async ({ request }) => {
  const response = await request.get("/feed.xml");
  expect(response.ok()).toBeTruthy();
  const body = await response.text();

  expect(body).toContain("<rss");
  expect(body).not.toContain("ai-code-generation-2026");

  const token = await fetchAdminToken(request);
  const adminPosts = await fetchJson<{ data: PostSummary[] }>(request, `${API_URL}/api/posts?status=all&perPage=100`, token);
  const draftSlugs = adminPosts.data.filter((post) => post.status === "DRAFT").map((post) => post.slug);
  for (const slug of draftSlugs) {
    expect(body).not.toContain(`/blog/${slug}`);
  }
});
