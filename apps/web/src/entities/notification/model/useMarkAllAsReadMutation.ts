import {
  getNotificationsControllerGetNotificationsQueryKey,
  getNotificationsControllerGetUnreadCountQueryKey,
  useNotificationsControllerMarkAllAsRead,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export const useMarkAllAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useNotificationsControllerMarkAllAsRead({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getNotificationsControllerGetUnreadCountQueryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: getNotificationsControllerGetNotificationsQueryKey(),
          }),
        ]);
      },
    },
  });
};
