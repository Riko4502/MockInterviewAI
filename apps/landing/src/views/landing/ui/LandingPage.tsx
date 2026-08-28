import { CTA } from "@/widgets/cta";
import { Features } from "@/widgets/features";
import { Footer } from "@/widgets/footer";
import { Hero } from "@/widgets/hero";
import { HowItWorks } from "@/widgets/how-it-works";
import { Navbar } from "@/widgets/navbar";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080e] text-slate-100 selection:bg-violet-500/30 selection:text-white flex flex-col font-sans">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
