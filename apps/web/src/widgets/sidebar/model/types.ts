import type { IconProps } from "@packages/icons";
import type { ComponentType } from "react";

export type NavIcon = ComponentType<IconProps>;

export type NavLabelKey =
  | "navigation.dashboard"
  | "navigation.sandbox"
  | "navigation.notifications"
  | "navigation.interviews"
  | "navigation.findPartners"
  | "navigation.statistics"
  | "navigation.resources";

export type NavItem = {
  labelKey: NavLabelKey;
  href: string;
  icon: NavIcon;
};
