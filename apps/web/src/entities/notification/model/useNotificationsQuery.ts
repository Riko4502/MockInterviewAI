import { useNotificationsControllerGetNotifications } from "@packages/api";

type UseNotificationsQueryParams = {
  page: number;
  limit: number;
  enabled?: boolean;
};

export const useNotificationsQuery = ({
  page,
  limit,
  enabled = true,
}: UseNotificationsQueryParams) => {
  return useNotificationsControllerGetNotifications(
    {
      page,
      limit,
    },
    {
      query: {
        enabled,
      },
    },
  );
};
