import PageWrapper from "@/components/PageWrapper";
import HeroSection from "@/components/home/HeroSection";
import SkillsSection from "@/components/home/SkillsSection";
import RecentWriting from "@/components/home/RecentWriting";
import ProjectsSection from "@/components/home/ProjectsSection";

export default function HomePage() {
  return (
    <PageWrapper>
      <HeroSection />
      <SkillsSection />
      <RecentWriting />
      <ProjectsSection />
    </PageWrapper>
  );
}
