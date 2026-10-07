"use client";

import { SearchIcon, UsersIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface ShowcaseEmptyStateProps {
  isFiltered?: boolean;
  onResetFilters?: () => void;
  onCreateCard?: () => void;
  className?: string;
}

export function ShowcaseEmptyState({
  isFiltered = false,
  onResetFilters,
  onCreateCard,
  className,
}: ShowcaseEmptyStateProps) {
  const { t } = useTranslation("showcase");

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center ${
        className || ""
      }`}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground shadow-xs mb-4">
        {isFiltered ? (
          <SearchIcon className="size-6 text-muted-foreground" />
        ) : (
          <UsersIcon className="size-6 text-muted-foreground" />
        )}
      </div>

      <h3 className="text-base font-bold text-foreground">
        {t("filters.emptyCatalogTitle")}
      </h3>

      <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
        {isFiltered ? t("filters.emptyCatalogDescription") : t("subtitle")}
      </p>

      <div className="mt-5 flex items-center gap-2.5">
        {isFiltered && onResetFilters && (
          <Button variant="outline" size="sm" onClick={onResetFilters}>
            {t("filters.reset")}
          </Button>
        )}

        {onCreateCard && (
          <Button variant="default" size="sm" onClick={onCreateCard}>
            {t("createCard")}
          </Button>
        )}
      </div>
    </div>
  );
}
