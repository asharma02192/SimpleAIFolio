import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "../globals.css";

export const metadata: Metadata = {
  title: "Admin",
  robots: "noindex, nofollow",
};

async function validateAdminSession(token: string) {
  const base = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const res = await fetch(`${base}/api/auth/me`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return res.ok;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-admin-pathname") || "/admin";

  if (pathname !== "/admin") {
    const token = (await cookies()).get("admin_token")?.value;
    if (!token) {
      redirect("/admin");
    }

    const isValid = await validateAdminSession(token);
    if (!isValid) {
      redirect("/admin");
    }
  }

  return <>{children}</>;
}
