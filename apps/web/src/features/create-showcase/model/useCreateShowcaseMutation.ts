"use client";
import {
  getDashboardControllerGetReadinessQueryKey,
  getDashboardControllerGetShowcaseStatusQueryKey,
  getShowcaseControllerFindAllQueryKey,
  getShowcaseControllerFindMyQueryKey,
  useShowcaseControllerCreate,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export function useCreateShowcaseMutation() {
  const client = useQueryClient();
  return useShowcaseControllerCreate<unknown>({
    mutation: {
      retry: false,
      onSuccess: () => {
        // Publication has succeeded even if refreshing a cached query fails.
        for (const queryKey of [
          getDashboardControllerGetReadinessQueryKey(),
          getDashboardControllerGetShowcaseStatusQueryKey(),
          getShowcaseControllerFindMyQueryKey(),
          getShowcaseControllerFindAllQueryKey(),
        ]) {
          void client.invalidateQueries({ queryKey });
        }
      },
    },
  });
}
