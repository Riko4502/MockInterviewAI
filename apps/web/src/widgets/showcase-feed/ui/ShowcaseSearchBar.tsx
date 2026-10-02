"use client";

import { CloseIcon, InfoIcon, SearchIcon } from "@packages/icons";
import { Button, Input, Tooltip } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export interface ShowcaseSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ShowcaseSearchBar({
  value,
  onChange,
  className,
}: ShowcaseSearchBarProps) {
  const { t } = useTranslation("showcase");
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [localValue, value, onChange]);

  return (
    <div className={`relative flex items-center ${className || ""}`}>
      <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
        <SearchIcon className="size-4" />
      </div>

      <Input
        value={localValue}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setLocalValue(e.target.value)
        }
        placeholder={t("filters.searchPlaceholder")}
        className="pl-9 pr-16 h-10 rounded-xl bg-card border-border/70 shadow-2xs text-xs sm:text-sm"
      />

      <div className="absolute right-2.5 flex items-center gap-1">
        {localValue ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => {
              setLocalValue("");
              onChange("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <CloseIcon className="size-3.5" />
          </Button>
        ) : null}

        <Tooltip>
          <Tooltip.Trigger asChild>
            <span className="text-muted-foreground/70 hover:text-foreground cursor-help p-1 inline-flex items-center">
              <InfoIcon className="size-3.5" />
            </span>
          </Tooltip.Trigger>
          <Tooltip.Content side="top" className="max-w-xs text-xs space-y-1">
            <p className="font-semibold text-foreground">
              {t("filters.searchTipTitle")}
            </p>
            <p>
              <code className="text-primary font-mono">+react</code> —{" "}
              {t("filters.searchTipMustContain")} react
            </p>
            <p>
              <code className="text-destructive font-mono">-vue</code> —{" "}
              {t("filters.searchTipExclude")} vue
            </p>
            <p>{t("filters.searchTipFree")}</p>
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}
