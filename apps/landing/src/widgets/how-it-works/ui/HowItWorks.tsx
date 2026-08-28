"use client";

import { useLandingTranslations } from "@/shared/lib";
import { SectionHeader } from "@/shared/ui";
import { StepAiInterview } from "./StepAiInterview";
import { StepLiveCoding } from "./StepLiveCoding";
import { StepScorecard } from "./StepScorecard";
import { StepTrackSelect } from "./StepTrackSelect";

export function HowItWorks() {
  const { landing } = useLandingTranslations();

  return (
    <section
      id="how-it-works"
      className="relative py-24 md:py-36 bg-transparent overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <SectionHeader
          badge={landing.howItWorks.badge}
          title={landing.howItWorks.title}
          subtitle={landing.howItWorks.subtitle}
          className="mb-20 md:mb-28"
        />

        {/* Steps Stack */}
        <div className="space-y-24 md:space-y-32 relative">
          <StepTrackSelect />
          <StepAiInterview />
          <StepLiveCoding />
          <StepScorecard />
        </div>
      </div>
    </section>
  );
}
