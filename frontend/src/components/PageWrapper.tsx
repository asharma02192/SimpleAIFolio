import { fetchSettings, type PublicSettings } from "@/lib/config";
import AnnouncementBar from "@/components/AnnouncementBar";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

export default async function PageWrapper({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings?: PublicSettings;
}) {
  const resolvedSettings = settings ?? await fetchSettings();

  return (
    <>
      <AnnouncementBar announcement={resolvedSettings.announcement} />
      <Navigation siteTitle={resolvedSettings.siteConfig.title} logoUrl={resolvedSettings.siteConfig.logoUrl} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer siteConfig={resolvedSettings.siteConfig} />
    </>
  );
}
