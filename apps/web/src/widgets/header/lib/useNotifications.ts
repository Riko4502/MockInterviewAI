import {
  getNotificationsControllerGetNotificationsQueryKey,
  getNotificationsControllerGetUnreadCountQueryKey,
  useNotificationsControllerGetNotifications,
  useNotificationsControllerGetUnreadCount,
  useNotificationsControllerMarkAllAsRead,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export const useNotifications = (enabled: boolean) => {
  const queryClient = useQueryClient();

  const { data: unreadCountData } = useNotificationsControllerGetUnreadCount();

  const { data: notificationsData } =
    useNotificationsControllerGetNotifications(
      {
        page: 1,
        limit: 5,
      },
      {
        query: {
          enabled,
        },
      },
    );

  const { mutate: markAllAsRead, isPending: isMarkingAllAsRead } =
    useNotificationsControllerMarkAllAsRead({
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

  return {
    notifications: notificationsData?.items ?? [],
    unreadCount: unreadCountData?.count ?? 0,
    markAllAsRead,
    isMarkingAllAsRead,
  };
};
