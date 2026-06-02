import type { Metadata } from "next";
import { Bricolage_Grotesque, Onest, Fira_Code } from "next/font/google";
import { fetchSettings, getSiteUrl } from "@/lib/config";
import "./globals.css";

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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSettings();
  const title = settings.siteConfig.title || "Amit";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${onest.variable} ${firaCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
