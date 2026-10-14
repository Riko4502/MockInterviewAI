import {
  NotificationCampaignDtoCategory,
  NotificationCampaignDtoTargetType,
} from "@packages/api";
import type { PickerUser } from "@/features/admin-user-multi-picker";

export type CampaignFormState = {
  title: string;
  message: string;
  category: NotificationCampaignDtoCategory;
  url: string;
  target: NotificationCampaignDtoTargetType;
  users: PickerUser[];
  at: string;
  scheduleMode: "NOW" | "SCHEDULED";
};

export type CampaignDialogState = {
  form: CampaignFormState;
  errors: string[];
  isRestoringRecipients: boolean;
  recipientRestoreFailed: boolean;
};

const initialForm: CampaignFormState = {
  title: "",
  message: "",
  category: NotificationCampaignDtoCategory.SYSTEM,
  url: "",
  target: NotificationCampaignDtoTargetType.ALL,
  users: [],
  at: "",
  scheduleMode: "NOW",
};

export const createInitialCampaignDialogState = (): CampaignDialogState => ({
  form: { ...initialForm },
  errors: [],
  isRestoringRecipients: false,
  recipientRestoreFailed: false,
});
