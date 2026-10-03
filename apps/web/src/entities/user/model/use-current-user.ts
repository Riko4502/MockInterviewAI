"use client";

import { useProfileControllerGetMyProfile } from "@packages/api";

export interface UseCurrentUserOptions {
  enabled?: boolean;
}

export function useCurrentUser(options?: UseCurrentUserOptions) {
  return useProfileControllerGetMyProfile({
    query: {
      enabled: options?.enabled ?? true,
    },
  });
}
