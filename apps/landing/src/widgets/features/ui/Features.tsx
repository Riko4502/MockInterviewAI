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
      className="relative py-24 md:py-36 bg-transparent overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <SectionHeader
          badge={landing.features.badge}
          title={landing.features.title}
          subtitle={landing.features.subtitle}
        />

        {/* Bento Grid with Dynamic Ambient Glows */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7">
            <FeatureCollaboration />
          </div>
          <div className="md:col-span-5">
            <FeatureVoice />
          </div>
          <div className="md:col-span-5">
            <FeatureSandbox />
          </div>
          <div className="md:col-span-7">
            <FeatureAnalytics />
          </div>
        </div>
      </div>
    </section>
  );
}
