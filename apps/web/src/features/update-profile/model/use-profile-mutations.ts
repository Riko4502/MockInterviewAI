"use client";

import {
  getProfileControllerGetMyProfileQueryKey,
  useProfileControllerUpdateMyProfile,
  useProfileControllerUploadAvatar,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useProfileControllerUpdateMyProfile({
    mutation: {
      onSuccess: (profile) => {
        queryClient.setQueryData(
          getProfileControllerGetMyProfileQueryKey(),
          profile,
        );
      },
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();

  return useProfileControllerUploadAvatar({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: getProfileControllerGetMyProfileQueryKey(),
        });
      },
    },
  });
}
