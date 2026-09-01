"use client";

import { cn } from "@packages/utils";
import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";
import {
  TABS_CONTENT_STYLES,
  tabsListVariants,
  tabsTriggerVariants,
} from "./constants";
import type {
  TabsContentProps,
  TabsContextValue,
  TabsListProps,
  TabsProps,
  TabsTriggerProps,
} from "./types";

const TabsContext = React.createContext<TabsContextValue>({
  variant: "default",
  size: "default",
  orientation: "horizontal",
});

/**
 * Корневой контейнер компонента вкладок (Tabs).
 */
function TabsRoot({
  variant = "default",
  size = "default",
  orientation = "horizontal",
  className,
  children,
  ...props
}: TabsProps) {
  const contextValue = React.useMemo(
    () => ({ variant, size, orientation }),
    [variant, size, orientation],
  );

  return (
    <TabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        data-slot="tabs-root"
        data-variant={variant}
        data-size={size}
        orientation={orientation}
        className={cn(
          "w-full",
          orientation === "vertical" && "flex gap-4 items-start",
          className,
        )}
        {...props}
      >
        {children}
      </TabsPrimitive.Root>
    </TabsContext.Provider>
  );
}

/**
 * Панель списка переключателей вкладок (Tabs.List).
 */
function TabsList({
  variant: customVariant,
  size: customSize,
  className,
  ...props
}: TabsListProps) {
  const context = React.useContext(TabsContext);
  const variant = customVariant ?? context.variant;
  const size = customSize ?? context.size;

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      data-size={size}
      className={cn(tabsListVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/**
 * Интерактивная кнопка вкладки (Tabs.Trigger).
 */
function TabsTrigger({
  variant: customVariant,
  size: customSize,
  className,
  ...props
}: TabsTriggerProps) {
  const context = React.useContext(TabsContext);
  const variant = customVariant ?? context.variant;
  const size = customSize ?? context.size;

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={variant}
      data-size={size}
      className={cn(tabsTriggerVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/**
 * Панель содержимого активной вкладки (Tabs.Content).
 */
function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(TABS_CONTENT_STYLES, className)}
      {...props}
    />
  );
}

export const Tabs = Object.assign(TabsRoot, {
  List: TabsList,
  Trigger: TabsTrigger,
  Content: TabsContent,
});
