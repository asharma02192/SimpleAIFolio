import { connection } from "next/server";
import PageWrapper from "@/components/PageWrapper";
import HeroSection from "@/components/home/HeroSection";
import SkillsSection from "@/components/home/SkillsSection";
import RecentWriting from "@/components/home/RecentWriting";
import ProjectsSection from "@/components/home/ProjectsSection";
import { fetchSettings } from "@/lib/config";

export const revalidate = 60;

export default async function HomePage() {
  await connection();
  const settings = await fetchSettings();

  return (
    <PageWrapper settings={settings}>
      <HeroSection settings={settings} />
      <SkillsSection settings={settings} />
      <RecentWriting />
      <ProjectsSection />
    </PageWrapper>
  );
}
