import { FolderOpenIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { EMPTY_STYLES, emptyVariants } from "./constants";
import type {
  EmptyActionProps,
  EmptyContentProps,
  EmptyDescriptionProps,
  EmptyMediaProps,
  EmptyProps,
  EmptyTitleProps,
} from "./types";

/**
 * Корневой контейнер пустого состояния (Empty).
 */
function EmptyRoot({
  className,
  variant = "default",
  size = "default",
  title,
  description,
  media,
  action,
  children,
  ...props
}: EmptyProps) {
  const hasShorthand =
    title !== undefined ||
    description !== undefined ||
    media !== undefined ||
    action !== undefined;

  return (
    <div
      data-slot="empty"
      data-variant={variant}
      data-size={size}
      className={cn(emptyVariants({ variant, size }), className)}
      {...props}
    >
      {children ? (
        children
      ) : hasShorthand ? (
        <>
          <EmptyMedia>{media ?? <FolderOpenIcon />}</EmptyMedia>
          {title && <EmptyTitle>{title}</EmptyTitle>}
          {description && <EmptyDescription>{description}</EmptyDescription>}
          {action && <EmptyAction>{action}</EmptyAction>}
        </>
      ) : (
        <>
          <EmptyMedia>
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>Нет данных</EmptyTitle>
          <EmptyDescription>
            В данный момент список пуст или информация отсутствует.
          </EmptyDescription>
        </>
      )}
    </div>
  );
}

/**
 * Слот для иконки, иллюстрации или медиа-элемента.
 */
function EmptyMedia({ className, ...props }: EmptyMediaProps) {
  return (
    <div
      data-slot="empty-media"
      className={cn(EMPTY_STYLES.media, className)}
      {...props}
    />
  );
}

/**
 * Заголовок пустого состояния.
 */
function EmptyTitle({ className, ...props }: EmptyTitleProps) {
  return (
    <h3
      data-slot="empty-title"
      className={cn(EMPTY_STYLES.title, className)}
      {...props}
    />
  );
}

/**
 * Описание / поясняющий текст пустого состояния.
 */
function EmptyDescription({ className, ...props }: EmptyDescriptionProps) {
  return (
    <p
      data-slot="empty-description"
      className={cn(EMPTY_STYLES.description, className)}
      {...props}
    />
  );
}

/**
 * Слот для кнопок действий (например, создание записи, сброс фильтра).
 */
function EmptyAction({ className, ...props }: EmptyActionProps) {
  return (
    <div
      data-slot="empty-action"
      className={cn(EMPTY_STYLES.action, className)}
      {...props}
    />
  );
}

/**
 * Произвольный дополнительный контент.
 */
function EmptyContent({ className, ...props }: EmptyContentProps) {
  return (
    <div
      data-slot="empty-content"
      className={cn(EMPTY_STYLES.content, className)}
      {...props}
    />
  );
}

export const Empty = Object.assign(EmptyRoot, {
  Media: EmptyMedia,
  Title: EmptyTitle,
  Description: EmptyDescription,
  Action: EmptyAction,
  Content: EmptyContent,
});
