import {
  BellIcon,
  BookIcon,
  CodeIcon,
  HelpIcon,
  PlayIcon,
  TrendUpIcon,
  UsersIcon,
} from "@packages/icons";
import { paths } from "@/shared/config";
import type { NavItem } from "./types";

export const NAV_ITEMS: NavItem[] = [
  { labelKey: "navigation.dashboard", href: paths.dashboard, icon: HelpIcon },
  {
    labelKey: "navigation.sandbox",
    href: paths.sandbox,
    icon: PlayIcon,
  },
  {
    labelKey: "navigation.notifications",
    href: paths.notifications,
    icon: BellIcon,
  },
  {
    labelKey: "navigation.interviews",
    href: paths.interviews,
    icon: CodeIcon,
  },
  {
    labelKey: "navigation.findPartners",
    href: paths.partners,
    icon: UsersIcon,
  },
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
];
