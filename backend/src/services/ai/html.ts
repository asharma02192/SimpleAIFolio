function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripUnsafeUrlCharacters(value: string) {
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
}

export function toSafeUrl(href: string) {
  const value = stripUnsafeUrlCharacters(href);
  const lower = value.toLowerCase();

  if (lower.startsWith("/") && !lower.startsWith("//")) {
    return value;
  }

  if (lower.startsWith("#")) {
    return value;
  }

  if (lower.startsWith("mailto:")) {
    return value.includes("\n") || value.includes("\r") ? "#" : value;
  }

  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return "#";
  }

  return "#";
}

function toSafeImageUrl(src: string) {
  const value = stripUnsafeUrlCharacters(src);
  const lower = value.toLowerCase();

  if (lower.startsWith("/") && !lower.startsWith("//")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password) {
      return parsed.toString();
    }
  } catch {
    return "";
  }

  return "";
}

const BLOCKED_TAGS = /<\/?(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base)\b[^>]*>/gi;
const BLOCKED_TAG_BLOCKS = /<(script|style|iframe|object|embed|form|textarea|select)\b[^>]*>[\s\S]*?<\/\1>/gi;
const ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "div",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "span",
  "strong",
  "u",
  "ul",
]);

export function sanitizeGeneratedHtml(html: string) {
  const withoutBlockedContent = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(BLOCKED_TAG_BLOCKS, "")
    .replace(BLOCKED_TAGS, "");

  return withoutBlockedContent.replace(/<\/?([a-zA-Z0-9:-]+)([^>]*)>/g, (match, rawTagName: string, rawAttrs: string) => {
    const tagName = rawTagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tagName)) {
      return "";
    }

    if (match.startsWith("</")) {
      return `</${tagName}>`;
    }

    if (tagName === "br" || tagName === "hr") {
      return `<${tagName}>`;
    }

    const attrs: string[] = [];
    const attrRegex = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1].toLowerCase();
      const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

      if (attrName.startsWith("on") || attrName === "style") {
        continue;
      }

      if (tagName === "a" && attrName === "href") {
        const safeHref = toSafeUrl(attrValue);
        attrs.push(`href="${escapeHtml(safeHref)}"`);
        if (safeHref.startsWith("http://") || safeHref.startsWith("https://")) {
          attrs.push('target="_blank"', 'rel="noopener noreferrer"');
        }
        continue;
      }

      if (tagName === "a" && attrName === "title") {
        attrs.push(`title="${escapeHtml(attrValue)}"`);
        continue;
      }

      if (tagName === "img" && attrName === "src") {
        const safeSrc = toSafeImageUrl(attrValue);
        if (!safeSrc) {
          return "";
        }
        attrs.push(`src="${escapeHtml(safeSrc)}"`);
        continue;
      }

      if (tagName === "img" && (attrName === "alt" || attrName === "title")) {
        attrs.push(`${attrName}="${escapeHtml(attrValue)}"`);
      }
    }

    if (tagName === "img" && !attrs.some((attr) => attr.startsWith("src="))) {
      return "";
    }

    const attrString = attrs.length > 0 ? ` ${attrs.join(" ")}` : "";
    return `<${tagName}${attrString}>`;
  });
}
