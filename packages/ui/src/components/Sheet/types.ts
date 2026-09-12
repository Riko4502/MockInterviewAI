import type { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";

/** Сторона появления выезжающей панели. */
export type SheetSide = "top" | "right" | "bottom" | "left";

/** Пропсы корневого компонента Sheet. */
export type SheetProps = React.ComponentProps<typeof SheetPrimitive.Root>;

/** Пропсы триггера, открывающего панель. */
export type SheetTriggerProps = React.ComponentProps<
  typeof SheetPrimitive.Trigger
>;

/** Пропсы кнопки закрытия панели. */
export type SheetCloseProps = React.ComponentProps<typeof SheetPrimitive.Close>;

/** Пропсы портала панели. */
export type SheetPortalProps = React.ComponentProps<
  typeof SheetPrimitive.Portal
>;

/** Пропсы затемнения фона. */
export type SheetOverlayProps = React.ComponentProps<
  typeof SheetPrimitive.Overlay
>;

/** Пропсы содержимого выезжающей панели. */
export interface SheetContentProps
  extends React.ComponentProps<typeof SheetPrimitive.Content> {
  /**
   * Сторона, с которой появляется панель.
   * @default "right"
   */
  side?: SheetSide;
  /**
   * Показывать ли системную кнопку закрытия.
   * @default true
   */
  showCloseButton?: boolean;
}

/** Пропсы шапки панели. */
export type SheetHeaderProps = React.ComponentProps<"div">;

/** Пропсы подвала панели. */
export type SheetFooterProps = React.ComponentProps<"div">;

/** Пропсы заголовка панели. */
export type SheetTitleProps = React.ComponentProps<typeof SheetPrimitive.Title>;

/** Пропсы описания панели. */
export type SheetDescriptionProps = React.ComponentProps<
  typeof SheetPrimitive.Description
>;
