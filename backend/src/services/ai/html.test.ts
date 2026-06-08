import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeGeneratedHtml, toSafeUrl } from "./html";

test("sanitizeGeneratedHtml strips blocked tags, handlers, and unsafe hrefs", () => {
  const html = [
    '<script>alert("x")</script>',
    '<p onclick="evil()">Hello</p>',
    '<a href="javascript:alert(1)">Bad</a>',
    '<a href="//evil.example.com/path">Protocol relative</a>',
    '<a href="https://example.com/post">Good</a>',
  ].join("");

  const safe = sanitizeGeneratedHtml(html);

  assert.doesNotMatch(safe, /script/i);
  assert.doesNotMatch(safe, /onclick/i);
  assert.match(safe, /href="#"/);
  assert.match(safe, /https:\/\/example\.com\/post/);
  assert.doesNotMatch(safe, /\/\/evil\.example\.com/);
});

test("sanitizeGeneratedHtml removes unsafe image sources and keeps safe ones", () => {
  const html = [
    '<img src="//evil.example.com/x.png" alt="bad">',
    '<img src="javascript:alert(1)" alt="bad">',
    '<img src="/uploads/good.png" alt="good">',
  ].join("");

  const safe = sanitizeGeneratedHtml(html);

  assert.doesNotMatch(safe, /evil\.example\.com/);
  assert.doesNotMatch(safe, /javascript:/i);
  assert.match(safe, /src="\/uploads\/good\.png"/);
});

test("toSafeUrl rejects protocol-relative and credential-bearing links", () => {
  assert.equal(toSafeUrl("//evil.example.com"), "#");
  assert.equal(toSafeUrl("https://user:pass@example.com/private"), "#");
  assert.equal(toSafeUrl("/safe-path"), "/safe-path");
  assert.equal(toSafeUrl("https://example.com/path"), "https://example.com/path");
});
