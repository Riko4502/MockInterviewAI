import type { UserProfileDto } from "@packages/api";
import type { ExperienceLevel, Specialization } from "@packages/dto";

export type OnboardingRole = Specialization;
export type OnboardingLevel = ExperienceLevel;

export type TargetCompanyId = "bigtech" | "fintech" | "startup" | "enterprise";

export type PracticeFormatId = "ai" | "peer" | "sandbox";

export type TimelineId = "now" | "soon" | "passive";

export interface OnboardingState {
  role: OnboardingRole;
  level: OnboardingLevel;
  companies: TargetCompanyId[];
  timeline: TimelineId;
  format: PracticeFormatId;
  isCompleted: boolean;
  completedAt?: string;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  role: "FRONTEND",
  level: "MIDDLE",
  companies: ["bigtech", "fintech"],
  timeline: "soon",
  format: "ai",
  isCompleted: false,
};

export function getInitialOnboardingState(
  user?: UserProfileDto | null,
): OnboardingState {
  if (!user) {
    return DEFAULT_ONBOARDING_STATE;
  }

  return {
    role: (user.targetRole as OnboardingRole) || DEFAULT_ONBOARDING_STATE.role,
    level:
      (user.targetLevel as OnboardingLevel) || DEFAULT_ONBOARDING_STATE.level,
    companies:
      user.targetCompanies && user.targetCompanies.length > 0
        ? (user.targetCompanies as TargetCompanyId[])
        : DEFAULT_ONBOARDING_STATE.companies,
    timeline:
      (user.targetTimeline as TimelineId) || DEFAULT_ONBOARDING_STATE.timeline,
    format:
      (user.preferredFormat as PracticeFormatId) ||
      DEFAULT_ONBOARDING_STATE.format,
    isCompleted: user.onboardingCompleted ?? false,
    completedAt: user.onboardingAt ?? undefined,
  };
}
