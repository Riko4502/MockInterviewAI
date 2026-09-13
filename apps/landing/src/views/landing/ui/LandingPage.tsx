import type { Locale } from "@packages/i18n";
import { I18nClientProvider } from "@/shared/lib/i18n/I18nClientProvider";
import { DynamicBackground, GlobalSpotlight } from "@/shared/ui";
import { LiveActivityToast } from "@/widgets/activity-toast";
import { CTA } from "@/widgets/cta";
import { Features } from "@/widgets/features";
import { Footer } from "@/widgets/footer";
import { Hero } from "@/widgets/hero";
import { HowItWorks } from "@/widgets/how-it-works";
import { Navbar } from "@/widgets/navbar";

export interface LandingPageProps {
  locale?: Locale;
}

export function LandingPage({ locale = "ru" }: LandingPageProps) {
  return (
    <I18nClientProvider locale={locale}>
      <div className="min-h-screen text-slate-100 selection:bg-violet-500/30 selection:text-white flex flex-col font-sans relative">
        {/* Dynamic Cosmic Animated Background */}
        <DynamicBackground />

        {/* Global Full-Page Spotlight Torch Effect */}
        <GlobalSpotlight />

        <Navbar locale={locale} />
        <main className="flex-1 relative z-10">
          <Hero />
          <HowItWorks />
          <Features />
          <CTA />
        </main>
        <Footer />
        <LiveActivityToast />
      </div>
    </I18nClientProvider>
  );
}
