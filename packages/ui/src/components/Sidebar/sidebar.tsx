"use client";

import { Button } from "@components/Button";
import { Input } from "@components/Input";
import { Separator } from "@components/Separator";
import { Sheet } from "@components/Sheet";
import { Skeleton } from "@components/Skeleton";
import { Tooltip } from "@components/Tooltip";
import { useIsMobile } from "@hooks/use-is-mobile";
import { MenuIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Slot } from "radix-ui";
import * as React from "react";
import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_KEYBOARD_SHORTCUT,
  SIDEBAR_STYLES,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON,
  SIDEBAR_WIDTH_MOBILE,
  sidebarMenuButtonVariants,
} from "./constants";
import type {
  SidebarContentProps,
  SidebarContextValue,
  SidebarCSSProperties,
  SidebarFooterProps,
  SidebarGroupActionProps,
  SidebarGroupContentProps,
  SidebarGroupLabelProps,
  SidebarGroupProps,
  SidebarHeaderProps,
  SidebarInputProps,
  SidebarInsetProps,
  SidebarMenuActionProps,
  SidebarMenuBadgeProps,
  SidebarMenuButtonProps,
  SidebarMenuItemProps,
  SidebarMenuProps,
  SidebarMenuSkeletonProps,
  SidebarMenuSubButtonProps,
  SidebarMenuSubItemProps,
  SidebarMenuSubProps,
  SidebarProps,
  SidebarProviderProps,
  SidebarRailProps,
  SidebarSeparatorProps,
  SidebarTriggerProps,
} from "./types";

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

/**
 * Хук доступа к состоянию боковой панели.
 * Должен вызываться внутри `Sidebar.Provider`.
 */
export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar должен использоваться внутри Sidebar.Provider");
  }

  return context;
}

/** Провайдер состояния боковой панели. */
function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;

  const setOpen = React.useCallback<SidebarContextValue["setOpen"]>(
    (value) => {
      const openState = typeof value === "function" ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        setUncontrolledOpen(openState);
      }

      // biome-ignore lint/suspicious/noDocumentCookie: persist sidebar open state on the client
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [open, setOpenProp],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile((current) => !current);
      return;
    }

    setOpen((current) => !current);
  }, [isMobile, setOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  const providerStyle: SidebarCSSProperties = {
    "--sidebar-width": SIDEBAR_WIDTH,
    "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
    ...style,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={providerStyle}
        className={cn(SIDEBAR_STYLES.provider, className)}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

/** Корневая боковая панель. */
function SidebarRoot({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(SIDEBAR_STYLES.sidebar, className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    const mobileStyle: SidebarCSSProperties = {
      "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
    };

    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <Sheet.Content
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className={SIDEBAR_STYLES.mobileContent}
          style={mobileStyle}
          side={side}
          showCloseButton={false}
        >
          <Sheet.Header className="sr-only">
            <Sheet.Title>Боковая панель</Sheet.Title>
            <Sheet.Description>
              Навигация приложения на мобильном экране.
            </Sheet.Description>
          </Sheet.Header>
          <div className="flex h-full w-full flex-col">{children}</div>
        </Sheet.Content>
      </Sheet>
    );
  }

  const isFloatingOrInset = variant === "floating" || variant === "inset";

  return (
    <div
      className={SIDEBAR_STYLES.peer}
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      <div
        data-slot="sidebar-gap"
        className={cn(
          SIDEBAR_STYLES.gap,
          isFloatingOrInset
            ? SIDEBAR_STYLES.gapFloating
            : SIDEBAR_STYLES.gapDefault,
        )}
      />
      <div
        data-slot="sidebar-container"
        data-side={side}
        className={cn(
          SIDEBAR_STYLES.container,
          isFloatingOrInset
            ? SIDEBAR_STYLES.containerFloating
            : SIDEBAR_STYLES.containerDefault,
          className,
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className={SIDEBAR_STYLES.inner}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Кнопка переключения видимости боковой панели. */
function SidebarTrigger({ className, onClick, ...props }: SidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon-sm"
      className={className}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <MenuIcon />
      <span className="sr-only">Переключить боковую панель</span>
    </Button>
  );
}

/** Рельса по краю панели для сворачивания. */
function SidebarRail({ className, ...props }: SidebarRailProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Переключить боковую панель"
      tabIndex={-1}
      title="Переключить боковую панель"
      onClick={toggleSidebar}
      className={cn(SIDEBAR_STYLES.rail, className)}
      {...props}
    />
  );
}

/** Основная область контента рядом с панелью. */
function SidebarInset({ className, ...props }: SidebarInsetProps) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(SIDEBAR_STYLES.inset, className)}
      {...props}
    />
  );
}

/** Поле ввода внутри боковой панели. */
function SidebarInput({ className, ...props }: SidebarInputProps) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn(SIDEBAR_STYLES.input, className)}
      {...props}
    />
  );
}

/** Шапка боковой панели. */
function SidebarHeader({ className, ...props }: SidebarHeaderProps) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn(SIDEBAR_STYLES.header, className)}
      {...props}
    />
  );
}

/** Подвал боковой панели. */
function SidebarFooter({ className, ...props }: SidebarFooterProps) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn(SIDEBAR_STYLES.footer, className)}
      {...props}
    />
  );
}

/** Разделитель внутри боковой панели. */
function SidebarSeparator({ className, ...props }: SidebarSeparatorProps) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn(SIDEBAR_STYLES.separator, className)}
      {...props}
    />
  );
}

/** Прокручиваемое содержимое боковой панели. */
function SidebarContent({ className, ...props }: SidebarContentProps) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(SIDEBAR_STYLES.content, className)}
      {...props}
    />
  );
}

/** Группа пунктов меню. */
function SidebarGroup({ className, ...props }: SidebarGroupProps) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn(SIDEBAR_STYLES.group, className)}
      {...props}
    />
  );
}

/** Подпись группы меню. */
function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: SidebarGroupLabelProps) {
  const Comp = asChild ? Slot.Root : "div";

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(SIDEBAR_STYLES.groupLabel, className)}
      {...props}
    />
  );
}

/** Действие в шапке группы. */
function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: SidebarGroupActionProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(SIDEBAR_STYLES.groupAction, className)}
      {...props}
    />
  );
}

/** Содержимое группы меню. */
function SidebarGroupContent({
  className,
  ...props
}: SidebarGroupContentProps) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn(SIDEBAR_STYLES.groupContent, className)}
      {...props}
    />
  );
}

/** Список пунктов меню. */
function SidebarMenu({ className, ...props }: SidebarMenuProps) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn(SIDEBAR_STYLES.menu, className)}
      {...props}
    />
  );
}

/** Пункт меню. */
function SidebarMenuItem({ className, ...props }: SidebarMenuItemProps) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn(SIDEBAR_STYLES.menuItem, className)}
      {...props}
    />
  );
}

/** Кнопка пункта меню. */
function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive || undefined}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) {
    return button;
  }

  const tooltipProps =
    typeof tooltip === "string" ? { children: tooltip } : tooltip;

  return (
    <Tooltip>
      <Tooltip.Trigger>{button}</Tooltip.Trigger>
      <Tooltip.Content
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  );
}

/** Дополнительное действие пункта меню. */
function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: SidebarMenuActionProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        SIDEBAR_STYLES.menuAction,
        showOnHover && SIDEBAR_STYLES.menuActionHover,
        className,
      )}
      {...props}
    />
  );
}

/** Бейдж пункта меню. */
function SidebarMenuBadge({ className, ...props }: SidebarMenuBadgeProps) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(SIDEBAR_STYLES.menuBadge, className)}
      {...props}
    />
  );
}

/** Скелетон пункта меню. */
function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: SidebarMenuSkeletonProps) {
  const [width] = React.useState(
    () => `${Math.floor(Math.random() * 40) + 50}%`,
  );
  const skeletonStyle: SidebarCSSProperties = {
    "--skeleton-width": width,
  };

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(SIDEBAR_STYLES.menuSkeleton, className)}
      {...props}
    >
      {showIcon ? (
        <Skeleton
          className={SIDEBAR_STYLES.menuSkeletonIcon}
          data-sidebar="menu-skeleton-icon"
        />
      ) : null}
      <Skeleton
        className={SIDEBAR_STYLES.menuSkeletonText}
        data-sidebar="menu-skeleton-text"
        style={skeletonStyle}
      />
    </div>
  );
}

/** Вложенный список меню. */
function SidebarMenuSub({ className, ...props }: SidebarMenuSubProps) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(SIDEBAR_STYLES.menuSub, className)}
      {...props}
    />
  );
}

/** Вложенный пункт меню. */
function SidebarMenuSubItem({ className, ...props }: SidebarMenuSubItemProps) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn(SIDEBAR_STYLES.menuSubItem, className)}
      {...props}
    />
  );
}

/** Кнопка вложенного пункта меню. */
function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: SidebarMenuSubButtonProps) {
  const Comp = asChild ? Slot.Root : "a";

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive || undefined}
      className={cn(SIDEBAR_STYLES.menuSubButton, className)}
      {...props}
    />
  );
}

/**
 * Боковая панель навигации (Sidebar).
 *
 * Составной компонент: оборачивается в `Sidebar.Provider`,
 * на мобильных экранах открывается как Sheet.
 */
export const Sidebar = Object.assign(SidebarRoot, {
  Provider: SidebarProvider,
  Trigger: SidebarTrigger,
  Rail: SidebarRail,
  Inset: SidebarInset,
  Input: SidebarInput,
  Header: SidebarHeader,
  Footer: SidebarFooter,
  Separator: SidebarSeparator,
  Content: SidebarContent,
  Group: SidebarGroup,
  GroupLabel: SidebarGroupLabel,
  GroupAction: SidebarGroupAction,
  GroupContent: SidebarGroupContent,
  Menu: SidebarMenu,
  MenuItem: SidebarMenuItem,
  MenuButton: SidebarMenuButton,
  MenuAction: SidebarMenuAction,
  MenuBadge: SidebarMenuBadge,
  MenuSkeleton: SidebarMenuSkeleton,
  MenuSub: SidebarMenuSub,
  MenuSubItem: SidebarMenuSubItem,
  MenuSubButton: SidebarMenuSubButton,
});
