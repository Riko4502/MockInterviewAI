import {
  getDashboardControllerGetDailyChallengeQueryKey,
  getDashboardControllerGetInsightsQueryKey,
  getDashboardControllerGetMatchRequestsQueryKey,
  getDashboardControllerGetReadinessQueryKey,
  getDashboardControllerGetRecentSessionsQueryKey,
  getDashboardControllerGetShowcaseStatusQueryKey,
  getDashboardControllerGetStatsQueryKey,
  getDashboardControllerGetUpcomingQueryKey,
} from "@packages/api";

// Сохраняем ключи Orval, чтобы сгенерированные хуки и дашборд использовали общий кеш.
// Для ключей на основе URL намеренно не используется вводящий в заблуждение префикс "all".
export const DASHBOARD_KEYS = {
  upcoming: getDashboardControllerGetUpcomingQueryKey,
  readiness: getDashboardControllerGetReadinessQueryKey,
  dailyChallenge: getDashboardControllerGetDailyChallengeQueryKey,
  liveMatch: () => ["dashboard", "live-match"] as const,
  liveMatchParameters: () => ["dashboard", "live-match-parameters"] as const,
  matches: getDashboardControllerGetMatchRequestsQueryKey,
  stats: getDashboardControllerGetStatsQueryKey,
  recent: getDashboardControllerGetRecentSessionsQueryKey,
  insights: getDashboardControllerGetInsightsQueryKey,
  showcase: getDashboardControllerGetShowcaseStatusQueryKey,
};
