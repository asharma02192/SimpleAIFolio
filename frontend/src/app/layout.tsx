import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest, Fira_Code, Sora, Source_Sans_3 } from "next/font/google";
import { fetchSettings, serverFetch, getSiteUrl } from "@/lib/config";
import "./globals.css";

interface Snippet {
  id: string;
  name: string;
  location: string;
  code: string;
  order: number;
}

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
  display: "swap",
});

const firaCode = Fira_Code({
  variable: "--font-fira",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600", "700", "800"],
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();
  const title = settings.siteConfig.title || "Portfolio";
  const description = settings.siteConfig.description || settings.siteConfig.tagline;
  const siteUrl = getSiteUrl();

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    metadataBase: new URL(siteUrl),
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: title,
      title,
      description,
      url: siteUrl,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await fetchSettings();
  const theme = settings.theme || "light-minimal";

  let headSnippets: Snippet[] = [];
  let bodySnippets: Snippet[] = [];
  try {
    const snippets = await serverFetch<Snippet[]>("/api/snippets", {
      next: { revalidate: 60 },
    });
    headSnippets = snippets.filter((s) => s.location === "head");
    bodySnippets = snippets.filter((s) => s.location === "body_end");
  } catch {
    // snippets are optional — fail silently
  }

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${bricolage.variable} ${onest.variable} ${firaCode.variable} ${sora.variable} ${sourceSans3.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {headSnippets.map((s) => (
          <div key={s.id} dangerouslySetInnerHTML={{ __html: s.code }} />
        ))}
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        {bodySnippets.map((s) => (
          <div key={s.id} dangerouslySetInnerHTML={{ __html: s.code }} />
        ))}
      </body>
    </html>
  );
}
