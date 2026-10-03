"use client";

import {
  type DashboardMatchRequestsResponseDto,
  getDashboardControllerToggleLiveMatchMutationKey,
  type LiveMatchToggleDto,
  useDashboardControllerToggleLiveMatch,
  useMatchmakingControllerAccept,
  useMatchmakingControllerReject,
  useShowcaseControllerBump,
} from "@packages/api";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { DASHBOARD_KEYS } from "./query-keys";
import type { LiveMatchState } from "./types";

type LiveMatchParameters = Pick<LiveMatchToggleDto, "specialization" | "level">;

export function useLiveMatchParametersQuery() {
  return useQuery<LiveMatchParameters | null>({
    queryKey: DASHBOARD_KEYS.liveMatchParameters(),
    queryFn: skipToken,
    initialData: null,
  });
}

interface LiveMatchContext {
  previousParameters: LiveMatchParameters | null;
  previous: LiveMatchState | null;
}

// Контракт GET-запроса статуса отсутствует: null означает неизвестное состояние, а не предполагаемый IDLE.
export function useLiveMatchStateQuery() {
  return useQuery<LiveMatchState | null>({
    queryKey: DASHBOARD_KEYS.liveMatch(),
    queryFn: skipToken,
    initialData: null,
  });
}

export function useLiveMatchMutation() {
  const client = useQueryClient();
  const key = DASHBOARD_KEYS.liveMatch();

  return useDashboardControllerToggleLiveMatch<unknown, LiveMatchContext>({
    mutation: {
      retry: false,
      onMutate: async ({ data }) => {
        // Отклоняем одновременные переключения из разных экземпляров хука до отправки HTTP-запроса.
        // Переключение в очереди также сразу вызвало бы onMutate и нарушило откат.
        if (
          client.isMutating({
            mutationKey: getDashboardControllerToggleLiveMatchMutationKey(),
            exact: true,
          }) > 1
        ) {
          throw new Error("A live match toggle is already pending");
        }
        await client.cancelQueries({ queryKey: key, exact: true });
        const previous =
          client.getQueryData<LiveMatchState | null>(key) ?? null;
        client.setQueryData<LiveMatchState>(key, {
          status: data.isSearching ? "SEARCHING" : "IDLE",
        });
        const previousParameters =
          client.getQueryData<LiveMatchParameters | null>(
            DASHBOARD_KEYS.liveMatchParameters(),
          ) ?? null;
        client.setQueryData<LiveMatchParameters>(
          DASHBOARD_KEYS.liveMatchParameters(),
          { specialization: data.specialization, level: data.level },
        );
        return { previous, previousParameters };
      },
      onError: (_error, _variables, context) => {
        if (context) {
          client.setQueryData(key, context.previous);
          client.setQueryData(
            DASHBOARD_KEYS.liveMatchParameters(),
            context.previousParameters,
          );
        }
      },
      onSuccess: (state) => {
        client.setQueryData(key, state);
        // В отличие от принятия заявки с витрины, поиск собеседника создаёт сессию.
        if (state.status === "MATCHED") {
          void client.invalidateQueries({
            queryKey: DASHBOARD_KEYS.upcoming(),
          });
        }
      },
    },
  });
}

export function useAcceptMatchMutation() {
  const client = useQueryClient();
  return useMatchmakingControllerAccept<unknown>({
    mutation: {
      retry: false,
      onSuccess: async (_data, { id }) => {
        await client.cancelQueries({ queryKey: DASHBOARD_KEYS.matches() });
        // Подтверждаем только эту заявку, сохраняя параллельные операции и варианты списка.
        client.setQueriesData<DashboardMatchRequestsResponseDto>(
          { queryKey: DASHBOARD_KEYS.matches() },
          (previous) => {
            if (!previous?.items?.some((item) => item.id === id))
              return previous;
            return {
              ...previous,
              items: previous.items.filter((item) => item.id !== id),
              totalPendingCount: Math.max(0, previous.totalPendingCount - 1),
            };
          },
        );
        await client.invalidateQueries({ queryKey: DASHBOARD_KEYS.matches() });
      },
    },
  });
}

export function useRejectMatchMutation() {
  const client = useQueryClient();
  return useMatchmakingControllerReject<unknown>({
    mutation: {
      retry: false,
      onSuccess: async (_data, { id }) => {
        await client.cancelQueries({ queryKey: DASHBOARD_KEYS.matches() });
        // Подтверждаем только эту заявку, сохраняя параллельные операции и варианты списка.
        client.setQueriesData<DashboardMatchRequestsResponseDto>(
          { queryKey: DASHBOARD_KEYS.matches() },
          (previous) => {
            if (!previous?.items?.some((item) => item.id === id))
              return previous;
            return {
              ...previous,
              items: previous.items.filter((item) => item.id !== id),
              totalPendingCount: Math.max(0, previous.totalPendingCount - 1),
            };
          },
        );
        await client.invalidateQueries({ queryKey: DASHBOARD_KEYS.matches() });
      },
    },
  });
}

export function useShowcaseBumpMutation() {
  const client = useQueryClient();
  return useShowcaseControllerBump<unknown>({
    mutation: {
      retry: false,
      onSuccess: () =>
        client.invalidateQueries({ queryKey: DASHBOARD_KEYS.showcase() }),
    },
  });
}
