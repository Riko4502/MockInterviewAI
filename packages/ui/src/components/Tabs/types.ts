import type { VariantProps } from "@packages/utils";
import type { Tabs as TabsPrimitive } from "radix-ui";
import type * as React from "react";
import type { tabsListVariants, tabsTriggerVariants } from "./constants";

export type TabsVariant = NonNullable<
  VariantProps<typeof tabsListVariants>["variant"]
>;

export type TabsSize = NonNullable<
  VariantProps<typeof tabsListVariants>["size"]
>;

/**
 * Значение контекста компонента Tabs.
 */
export interface TabsContextValue {
  variant: TabsVariant;
  size: TabsSize;
  orientation?: "horizontal" | "vertical";
}

/**
 * Свойства корневого контейнера Tabs.
 */
export interface TabsProps
  extends React.ComponentProps<typeof TabsPrimitive.Root> {
  /**
   * Стилистический вариант отображения вкладок.
   * @default "default"
   */
  variant?: TabsVariant;
  /**
   * Размер вкладок.
   * @default "default"
   */
  size?: TabsSize;
}

/**
 * Свойства панели списка вкладок (Tabs.List).
 */
export interface TabsListProps
  extends React.ComponentProps<typeof TabsPrimitive.List>,
    VariantProps<typeof tabsListVariants> {}

/**
 * Свойства кнопки переключения вкладки (Tabs.Trigger).
 */
export interface TabsTriggerProps
  extends React.ComponentProps<typeof TabsPrimitive.Trigger>,
    VariantProps<typeof tabsTriggerVariants> {}

/**
 * Свойства панели содержимого вкладки (Tabs.Content).
 */
export type TabsContentProps = React.ComponentProps<
  typeof TabsPrimitive.Content
>;
