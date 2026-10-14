import type { Metadata } from "next";
import { OnboardingWizard } from "@/features/onboarding";

export const metadata: Metadata = {
  title: "Онбординг | Mock Interview AI",
  description:
    "Персонализация программы подготовки к техническим собеседованиям",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
