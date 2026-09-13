import type { VariantProps } from "@packages/utils";
import type { Dialog as DrawerPrimitive } from "radix-ui";
import type * as React from "react";
import type { drawerContentVariants } from "./constants";

export type DrawerProps = React.ComponentProps<typeof DrawerPrimitive.Root> & {
  /** Уникальное имя шторки для автоматической привязки к `useDrawer`. */
  name?: string;
};

export type DrawerTriggerProps = React.ComponentProps<
  typeof DrawerPrimitive.Trigger
>;

export type DrawerPortalProps = React.ComponentProps<
  typeof DrawerPrimitive.Portal
>;

export type DrawerOverlayProps = React.ComponentProps<
  typeof DrawerPrimitive.Overlay
>;

export type DrawerContentProps = React.ComponentProps<
  typeof DrawerPrimitive.Content
> &
  VariantProps<typeof drawerContentVariants> & {
    /** Отображать ли визуальный индикатор свайпа (ручку). */
    showHandle?: boolean;
    /** Отображать ли кнопку закрытия (крестик). */
    showCloseButton?: boolean;
  };

export type DrawerHeaderProps = React.ComponentProps<"div">;

export type DrawerFooterProps = React.ComponentProps<"div">;

export type DrawerTitleProps = React.ComponentProps<
  typeof DrawerPrimitive.Title
>;

export type DrawerDescriptionProps = React.ComponentProps<
  typeof DrawerPrimitive.Description
>;

export type DrawerCloseProps = React.ComponentProps<
  typeof DrawerPrimitive.Close
>;

export type DrawerHandleProps = React.ComponentProps<"div">;
