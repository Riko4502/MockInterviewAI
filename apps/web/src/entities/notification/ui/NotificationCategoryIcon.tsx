import type { NotificationsListDtoItemsItemCategory } from "@packages/api";
import { CalendarIcon, MessageSquareIcon, SettingsIcon } from "@packages/icons";

const ICONS: Record<
  NotificationsListDtoItemsItemCategory,
  typeof CalendarIcon
> = {
  INTERVIEW: CalendarIcon,
  MESSAGE: MessageSquareIcon,
  SYSTEM: SettingsIcon,
};

export const NotificationCategoryIcon = ({
  category,
  className,
}: {
  category: NotificationsListDtoItemsItemCategory;
  className?: string;
}) => {
  const Icon = ICONS[category];

  return <Icon className={className} data-category={category} />;
};
