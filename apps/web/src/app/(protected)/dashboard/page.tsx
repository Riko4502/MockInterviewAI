import { DashboardOnboardingBanner } from "@/features/onboarding";
import {
  DashboardAiInsights,
  DashboardDailyChallenge,
  DashboardFrame,
  DashboardHero,
  DashboardMatchRequests,
  DashboardQuickActions,
  DashboardReadinessChecklist,
  DashboardRecentSessions,
  DashboardShowcaseBanner,
  DashboardStatsGrid,
  DashboardUpcomingSession,
  QuickMediaCheckWidget,
} from "@/widgets/dashboard";

export default function DashboardPage() {
  return (
    <DashboardFrame
      header={
        <>
          <DashboardOnboardingBanner />
          <DashboardHero />
          <DashboardQuickActions />
        </>
      }
      primary={
        <>
          <DashboardReadinessChecklist />
          <DashboardUpcomingSession />
          <DashboardDailyChallenge />
          <DashboardStatsGrid />
          <DashboardAiInsights />
          <DashboardRecentSessions />
        </>
      }
      secondary={
        <>
          <DashboardMatchRequests />
          <DashboardShowcaseBanner />
          <QuickMediaCheckWidget />
        </>
      }
    />
  );
}
