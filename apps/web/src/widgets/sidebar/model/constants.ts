import {
  BellIcon,
  BookIcon,
  CameraIcon,
  CodeIcon,
  LayoutDashboardIcon,
  TrendUpIcon,
  UsersIcon,
} from "@packages/icons";
import { paths } from "@/shared/config";
import type { NavGroup, NavItem } from "./types";

export const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "navigation.workspace",
    items: [
      {
        labelKey: "navigation.dashboard",
        href: paths.dashboard,
        icon: LayoutDashboardIcon,
      },
      {
        labelKey: "navigation.interviews",
        href: paths.interviews,
        icon: CameraIcon,
      },
      {
        labelKey: "navigation.findPartners",
        href: paths.partners,
        icon: UsersIcon,
      },
      {
        labelKey: "navigation.sandbox",
        href: paths.sandbox,
        icon: CodeIcon,
      },
      {
        labelKey: "navigation.notifications",
        href: paths.notifications,
        icon: BellIcon,
      },
    ],
  },
  {
    labelKey: "navigation.analytics",
    items: [
      {
        labelKey: "navigation.statistics",
        href: paths.statistics,
        icon: TrendUpIcon,
      },
      {
        labelKey: "navigation.resources",
        href: paths.resources,
        icon: BookIcon,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
