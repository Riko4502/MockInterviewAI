import {
  type NotificationsControllerGetNotificationsParams,
  useNotificationsControllerGetNotifications,
} from "@packages/api";

type UseNotificationsQueryParams = {
  page: number;
  limit: number;
  enabled?: boolean;
  category?: NotificationsControllerGetNotificationsParams["category"];
};

export const useNotificationsQuery = ({
  page,
  limit,
  category,
  enabled = true,
}: UseNotificationsQueryParams) => {
  return useNotificationsControllerGetNotifications(
    {
      page,
      limit,
      category,
    },
    {
      query: {
        enabled,
      },
    },
  );
};
