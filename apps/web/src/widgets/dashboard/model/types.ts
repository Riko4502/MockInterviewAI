import type {
  DailyChallengeResponseDto,
  DashboardInsightsResponseDto,
  DashboardMatchRequestsResponseDto,
  DashboardReadinessResponseDto,
  DashboardStatsResponseDto,
  LiveMatchStatusResponseDto,
  RecentSessionsResponseDto,
  ShowcaseStatusResponseDto,
  UpcomingSessionResponseDto,
} from "@packages/api";

// Проекции дашборда сохраняют серверные поля без дублирования контрактов передачи данных.
export type UpcomingSession = NonNullable<
  UpcomingSessionResponseDto["session"]
>;
export type ReadinessChecklist = DashboardReadinessResponseDto;
export type ReadinessStep = ReadinessChecklist["steps"][number];
export type DailyChallenge = DailyChallengeResponseDto;
export type LiveMatchState = LiveMatchStatusResponseDto;
export type MatchRequest = DashboardMatchRequestsResponseDto["items"][number];
export type DashboardStats = DashboardStatsResponseDto;
export type RecentSession = RecentSessionsResponseDto["items"][number];
export type AiInsight = DashboardInsightsResponseDto["insights"][number];
export type ShowcaseStatus = ShowcaseStatusResponseDto;
