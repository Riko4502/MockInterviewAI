import { paths } from "@/shared/config";

export function isNavItemActive(pathname: string, href: string) {
  return (
    pathname === href || (href !== paths.dashboard && pathname.startsWith(href))
  );
}
