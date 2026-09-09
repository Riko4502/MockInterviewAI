/**
 * Статические навигационные ссылки для виджета Navbar (FR-040, SC-011, T021).
 * Не содержат вызовов t(), React или хуков. Ключи локализации резолвятся
 * внутри компонентов через useTranslation("landing").
 */

export const NAV_LINKS = [
  {
    href: "#how-it-works",
    labelKey: "nav.howItWorks",
  },
  {
    href: "#features",
    labelKey: "nav.features",
  },
] as const;

export type NavLinkItem = (typeof NAV_LINKS)[number];
