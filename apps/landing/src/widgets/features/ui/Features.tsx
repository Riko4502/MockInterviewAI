"use client";

import { useLandingTranslations } from "@/shared/lib";
import { SectionHeader } from "@/shared/ui";
import { FeatureAnalytics } from "./FeatureAnalytics";
import { FeatureCollaboration } from "./FeatureCollaboration";
import { FeatureSandbox } from "./FeatureSandbox";
import { FeatureVoice } from "./FeatureVoice";

export function Features() {
  const { landing } = useLandingTranslations();

  return (
    <section
      id="features"
      className="relative py-24 md:py-36 bg-[#090b13] border-t border-white/10 overflow-hidden"
    >
      {/* Glow Backdrop */}
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-violet-600/10 blur-[150px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-indigo-600/10 blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <SectionHeader
          badge={landing.features.badge}
          title={landing.features.title}
          subtitle={landing.features.subtitle}
        />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <FeatureCollaboration />
          <FeatureVoice />
          <FeatureSandbox />
          <FeatureAnalytics />
        </div>
      </div>
    </section>
  );
}
