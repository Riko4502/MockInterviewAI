"use client";

import {
  type DashboardControllerGetMatchRequestsParams,
  type DashboardControllerGetRecentSessionsParams,
  useDashboardControllerGetDailyChallenge,
  useDashboardControllerGetInsights,
  useDashboardControllerGetMatchRequests,
  useDashboardControllerGetReadiness,
  useDashboardControllerGetRecentSessions,
  useDashboardControllerGetShowcaseStatus,
  useDashboardControllerGetStats,
  useDashboardControllerGetUpcoming,
} from "@packages/api";

export interface DashboardQueryOptions {
  enabled?: boolean;
}

export function useUpcomingSessionQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetUpcoming({
    query: { enabled: options?.enabled ?? true },
  });
}

export function useReadinessQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetReadiness({
    query: { enabled: options?.enabled ?? true },
  });
}

export function useDailyChallengeQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetDailyChallenge({
    query: { enabled: options?.enabled ?? true },
  });
}

export function useMatchRequestsQuery(
  params?: DashboardControllerGetMatchRequestsParams,
  options?: DashboardQueryOptions,
) {
  return useDashboardControllerGetMatchRequests(params, {
    query: { enabled: options?.enabled ?? true },
  });
}

export function useDashboardStatsQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetStats({
    query: { enabled: options?.enabled ?? true },
  });
}

export function useRecentSessionsQuery(
  params?: DashboardControllerGetRecentSessionsParams,
  options?: DashboardQueryOptions,
) {
  return useDashboardControllerGetRecentSessions(params, {
    query: { enabled: options?.enabled ?? true },
  });
}

export function useAiInsightsQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetInsights({
    query: { enabled: options?.enabled ?? true },
  });
}

export function useShowcaseStatusQuery(options?: DashboardQueryOptions) {
  return useDashboardControllerGetShowcaseStatus({
    query: { enabled: options?.enabled ?? true },
  });
}

// Имя для совместимости со списком проверки; используются те же сгенерированный запрос и кеш.
export const useReadinessChecklist = useReadinessQuery;

// Публичное доменное имя для того же сгенерированного запроса задачи дня.
export const useDailyChallenge = useDailyChallengeQuery;

// Публичное имя для сгенерированного запроса ближайшей сессии.
export const useUpcomingSession = useUpcomingSessionQuery;

export const useMatchRequests = useMatchRequestsQuery;
export const useShowcaseStatus = useShowcaseStatusQuery;

export const useDashboardStats = useDashboardStatsQuery;
export const useAiInsights = useAiInsightsQuery;
export const useRecentSessions = useRecentSessionsQuery;
