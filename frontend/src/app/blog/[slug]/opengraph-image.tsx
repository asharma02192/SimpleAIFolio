import { ImageResponse } from "next/og";
import { serverFetch, logPublicFetchError, fetchSettings } from "@/lib/config";
import type { Post } from "@/types";

export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await fetchSettings();
  const siteName = settings.siteConfig.title;

  let title = "Blog Post";
  let category = "";

  try {
    const post = await serverFetch<Post>(`/api/posts/${slug}`);
    title = post.title || "Blog Post";
    category = post.category?.name || "";
  } catch (error) {
    logPublicFetchError(`failed to generate og image for post ${slug}`, error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#1a1a2e",
          padding: "80px",
        }}
      >
        {category && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              color: "#e94560",
              textTransform: "uppercase",
              letterSpacing: "3px",
              marginBottom: "24px",
              padding: "8px 24px",
              border: "2px solid #e94560",
              borderRadius: "8px",
            }}
          >
            {category}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "56px",
            fontWeight: 700,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: "1000px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            color: "#e94560",
            marginTop: "48px",
            letterSpacing: "2px",
          }}
        >
          {siteName}
        </div>
      </div>
    ),
    { ...size }
  );
}
