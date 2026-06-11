import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

type RevalidateType = "post" | "settings" | "project" | "experience" | "taxonomy";

function isAuthorized(request: NextRequest) {
  const expected = process.env.REVALIDATE_SECRET?.trim();
  const provided = request.headers.get("x-revalidate-secret")?.trim();
  return Boolean(expected && provided && expected === provided);
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    type?: RevalidateType;
    slug?: string | null;
    previousSlug?: string | null;
  };

  const type = body.type;
  if (!type) {
    return NextResponse.json({ error: "Missing revalidation type" }, { status: 400 });
  }

  const paths = new Set<string>();

  switch (type) {
    case "post":
      paths.add("/");
      paths.add("/blog");
      paths.add("/feed.xml");
      paths.add("/sitemap.xml");
      unique([body.slug, body.previousSlug]).forEach((slug) => {
        paths.add(`/blog/${slug}`);
      });
      break;
    case "project":
      paths.add("/");
      paths.add("/projects");
      paths.add("/sitemap.xml");
      break;
    case "experience":
      paths.add("/about");
      break;
    case "taxonomy":
      paths.add("/");
      paths.add("/blog");
      paths.add("/sitemap.xml");
      break;
    case "settings":
    default:
      paths.add("/");
      paths.add("/about");
      paths.add("/blog");
      paths.add("/projects");
      paths.add("/feed.xml");
      paths.add("/sitemap.xml");
      break;
  }

  [...paths].forEach((path) => revalidatePath(path));

  return NextResponse.json({
    revalidated: true,
    type,
    paths: [...paths],
  });
}
