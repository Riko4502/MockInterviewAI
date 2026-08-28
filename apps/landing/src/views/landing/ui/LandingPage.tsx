import { DynamicBackground, GlobalSpotlight } from "@/shared/ui";
import { LiveActivityToast } from "@/widgets/activity-toast";
import { CTA } from "@/widgets/cta";
import { Features } from "@/widgets/features";
import { Footer } from "@/widgets/footer";
import { Hero } from "@/widgets/hero";
import { HowItWorks } from "@/widgets/how-it-works";
import { Navbar } from "@/widgets/navbar";

export function LandingPage() {
  return (
    <div className="min-h-screen text-slate-100 selection:bg-violet-500/30 selection:text-white flex flex-col font-sans relative">
      {/* Dynamic Cosmic Animated Background */}
      <DynamicBackground />

      {/* Global Full-Page Spotlight Torch Effect */}
      <GlobalSpotlight />

      <Navbar />
      <main className="flex-1 relative z-10">
        <Hero />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
      <LiveActivityToast />
    </div>
  );
}
