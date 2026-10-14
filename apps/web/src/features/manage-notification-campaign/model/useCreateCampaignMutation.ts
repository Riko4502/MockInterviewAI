import { useNotificationCampaignsControllerCreate } from "@packages/api";

export function useCreateCampaignMutation() {
  return useNotificationCampaignsControllerCreate();
}
