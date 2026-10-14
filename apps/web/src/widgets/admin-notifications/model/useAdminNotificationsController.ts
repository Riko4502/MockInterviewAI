"use client";

import { useCampaignActionsController } from "./useCampaignActionsController";
import { useCampaignDialogsController } from "./useCampaignDialogsController";
import { useCampaignListController } from "./useCampaignListController";

export function useAdminNotificationsController() {
  const campaignList = useCampaignListController();
  const campaignDialogs = useCampaignDialogsController();
  const campaignActions = useCampaignActionsController();

  return { campaignList, campaignDialogs, campaignActions };
}
