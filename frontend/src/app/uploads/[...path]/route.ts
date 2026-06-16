import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const backendUrl =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001";
  const filePath = path.join("/");

  try {
    const response = await fetch(`${backendUrl}/uploads/${filePath}`);

    if (!response.ok) {
      return new NextResponse("Not found", { status: 404 });
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type");
    const contentLength = response.headers.get("content-length");
    const cacheControl = response.headers.get("cache-control");
    if (contentType) headers.set("content-type", contentType);
    if (contentLength) headers.set("content-length", contentLength);
    if (cacheControl) headers.set("cache-control", cacheControl);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new NextResponse(response.body, { status: 200, headers });
  } catch {
    return new NextResponse("Failed to fetch upload", { status: 502 });
  }
}
