"use client";

import { defaultLocale, type Locale, locales } from "@packages/i18n";
import { GlobeIcon } from "@packages/icons";
import { Button, DropdownMenu } from "@packages/ui";
import { cn } from "@packages/utils";
import { useTranslation } from "react-i18next";
import { usePreferences } from "@/entities/user";

export interface LanguageSwitcherProps {
  /** Дополнительные CSS классы */
  className?: string;
}

const LOCALE_LABELS: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t } = useTranslation("common");
  const { locale, changeLocale } = usePreferences();

  const currentLocale = locales.includes(locale as Locale)
    ? (locale as Locale)
    : defaultLocale;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={t("actions.switchLanguage")}
          className={cn(
            "h-8 rounded-full px-2.5 gap-1.5 bg-white/5 hover:bg-white/10 dark:bg-white/5 dark:hover:bg-white/10 border-border dark:border-white/10 text-foreground text-xs font-medium transition-all",
            className,
          )}
        >
          <GlobeIcon className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{currentLocale.toUpperCase()}</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-[120px]">
        {locales.map((loc) => (
          <DropdownMenu.Item
            key={loc}
            onSelect={() => changeLocale(loc)}
            className={cn(
              "flex items-center justify-between cursor-pointer",
              loc === currentLocale && "font-semibold text-primary",
            )}
          >
            <span>{LOCALE_LABELS[loc] ?? loc.toUpperCase()}</span>
            <span className="text-xs text-muted-foreground uppercase">
              {loc}
            </span>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
