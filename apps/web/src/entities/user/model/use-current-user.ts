"use client";

import { useProfileControllerGetMyProfile } from "@packages/api";

export function useCurrentUser() {
  return useProfileControllerGetMyProfile();
}
