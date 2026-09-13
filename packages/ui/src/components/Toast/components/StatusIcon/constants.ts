import type { ToastStatus } from "@model/ToastProvider/types";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
} from "@packages/icons";

export const STATUS_CONFIG: Partial<
  Record<
    ToastStatus,
    {
      Icon: typeof CheckIcon;
      className: string;
    }
  >
> = {
  success: {
    Icon: CheckIcon,
    className: "bg-success/15 text-success",
  },
  destructive: {
    Icon: AlertCircleIcon,
    className: "bg-destructive/15 text-destructive",
  },
  error: {
    Icon: AlertCircleIcon,
    className: "bg-destructive/15 text-destructive",
  },
  warning: {
    Icon: AlertTriangleIcon,
    className: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
  },
  info: {
    Icon: InfoIcon,
    className: "bg-chart-4/15 text-chart-4",
  },
};
