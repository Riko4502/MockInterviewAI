import { cn } from "@packages/utils";
import { ALERT_STYLES, alertVariants } from "./constants";
import type {
  AlertDescriptionProps,
  AlertProps,
  AlertTitleProps,
} from "./types";

/**
 * Компонент предупреждения / баннера (Alert).
 *
 * Составной API: `Alert` (корень) + `Alert.Title` + `Alert.Description`.
 * Поддерживает варианты: `default`, `destructive`, `warning`, `info`, `success`.
 */
function AlertRoot({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: AlertTitleProps) {
  return (
    <h5
      data-slot="alert-title"
      className={cn(ALERT_STYLES.title, className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: AlertDescriptionProps) {
  return (
    <div
      data-slot="alert-description"
      className={cn(ALERT_STYLES.description, className)}
      {...props}
    />
  );
}

export const Alert = Object.assign(AlertRoot, {
  Title: AlertTitle,
  Description: AlertDescription,
});
