import { useNotificationsControllerGetUnreadCount } from "@packages/api";

export const useUnreadCountQuery = () => {
  return useNotificationsControllerGetUnreadCount();
};
