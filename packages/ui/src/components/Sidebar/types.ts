import type { ButtonProps } from "@components/Button";
import type { InputProps } from "@components/Input";
import type { SeparatorProps } from "@components/Separator";
import type { TooltipContentProps } from "@components/Tooltip";
import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { sidebarMenuButtonVariants } from "./constants";

/** Состояние боковой панели: развёрнута или свёрнута. */
export type SidebarState = "expanded" | "collapsed";

/** Сторона размещения боковой панели. */
export type SidebarSide = "left" | "right";

/** Визуальный вариант боковой панели. */
export type SidebarVariant = "sidebar" | "floating" | "inset";

/** Режим сворачивания боковой панели. */
export type SidebarCollapsible = "offcanvas" | "icon" | "none";

/** Стилистический вариант пункта меню. */
export type SidebarMenuButtonVariant = NonNullable<
  VariantProps<typeof sidebarMenuButtonVariants>["variant"]
>;

/** Размер пункта меню. */
export type SidebarMenuButtonSize = NonNullable<
  VariantProps<typeof sidebarMenuButtonVariants>["size"]
>;

/** Значение контекста боковой панели. */
export interface SidebarContextValue {
  state: SidebarState;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  openMobile: boolean;
  setOpenMobile: React.Dispatch<React.SetStateAction<boolean>>;
  isMobile: boolean;
  toggleSidebar: () => void;
}

/** CSS-переменные ширины боковой панели. */
export type SidebarCSSProperties = React.CSSProperties &
  Record<`--${string}`, string | number | undefined>;

/** Пропсы провайдера контекста боковой панели. */
export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  /**
   * Начальное состояние: открыта ли панель.
   * @default true
   */
  defaultOpen?: boolean;
  /** Контролируемое состояние открытия (desktop). */
  open?: boolean;
  /** Обработчик изменения контролируемого состояния. */
  onOpenChange?: (open: boolean) => void;
}

/** Пропсы корневой боковой панели. */
export interface SidebarProps extends React.ComponentProps<"div"> {
  /**
   * Сторона размещения.
   * @default "left"
   */
  side?: SidebarSide;
  /**
   * Визуальный вариант.
   * @default "sidebar"
   */
  variant?: SidebarVariant;
  /**
   * Режим сворачивания.
   * @default "offcanvas"
   */
  collapsible?: SidebarCollapsible;
}

/** Пропсы кнопки открытия/закрытия боковой панели. */
export type SidebarTriggerProps = ButtonProps;

/** Пропсы рельсы для сворачивания панели. */
export type SidebarRailProps = React.ComponentProps<"button">;

/** Пропсы основной области контента рядом с панелью. */
export type SidebarInsetProps = React.ComponentProps<"main">;

/** Пропсы поля поиска внутри панели. */
export type SidebarInputProps = InputProps;

/** Пропсы шапки панели. */
export type SidebarHeaderProps = React.ComponentProps<"div">;

/** Пропсы подвала панели. */
export type SidebarFooterProps = React.ComponentProps<"div">;

/** Пропсы разделителя внутри панели. */
export type SidebarSeparatorProps = SeparatorProps;

/** Пропсы прокручиваемого содержимого панели. */
export type SidebarContentProps = React.ComponentProps<"div">;

/** Пропсы группы пунктов меню. */
export type SidebarGroupProps = React.ComponentProps<"div">;

/** Пропсы подписи группы. */
export interface SidebarGroupLabelProps extends React.ComponentProps<"div"> {
  /** Рендерить дочерний элемент вместо `div`. */
  asChild?: boolean;
}

/** Пропсы действия группы. */
export interface SidebarGroupActionProps
  extends React.ComponentProps<"button"> {
  /** Рендерить дочерний элемент вместо `button`. */
  asChild?: boolean;
}

/** Пропсы содержимого группы. */
export type SidebarGroupContentProps = React.ComponentProps<"div">;

/** Пропсы списка меню. */
export type SidebarMenuProps = React.ComponentProps<"ul">;

/** Пропсы пункта меню. */
export type SidebarMenuItemProps = React.ComponentProps<"li">;

/** Пропсы кнопки пункта меню. */
export interface SidebarMenuButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof sidebarMenuButtonVariants> {
  /** Рендерить дочерний элемент вместо `button`. */
  asChild?: boolean;
  /** Подсветка активного пункта. */
  isActive?: boolean;
  /** Подсказка, которая показывается в свёрнутом режиме. */
  tooltip?: string | TooltipContentProps;
}

/** Пропсы дополнительного действия пункта меню. */
export interface SidebarMenuActionProps extends React.ComponentProps<"button"> {
  /** Рендерить дочерний элемент вместо `button`. */
  asChild?: boolean;
  /** Показывать действие только при наведении. */
  showOnHover?: boolean;
}

/** Пропсы бейджа пункта меню. */
export type SidebarMenuBadgeProps = React.ComponentProps<"div">;

/** Пропсы скелетона пункта меню. */
export interface SidebarMenuSkeletonProps extends React.ComponentProps<"div"> {
  /** Показывать ли заглушку иконки. */
  showIcon?: boolean;
}

/** Пропсы вложенного списка меню. */
export type SidebarMenuSubProps = React.ComponentProps<"ul">;

/** Пропсы вложенного пункта меню. */
export type SidebarMenuSubItemProps = React.ComponentProps<"li">;

/** Пропсы кнопки вложенного пункта меню. */
export interface SidebarMenuSubButtonProps extends React.ComponentProps<"a"> {
  /** Рендерить дочерний элемент вместо `a`. */
  asChild?: boolean;
  /**
   * Размер вложенного пункта.
   * @default "md"
   */
  size?: "sm" | "md";
  /** Подсветка активного пункта. */
  isActive?: boolean;
}
