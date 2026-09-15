import { useNotificationsControllerGetNotifications } from "@packages/api";

export const useNotificationsQuery = (enabled: boolean) => {
  return useNotificationsControllerGetNotifications(
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
};
