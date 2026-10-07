"use client";

import { Switch } from "@packages/ui";
import { type Control, Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import type { ShowcaseFormValues } from "../model/showcase-form-schema";

export interface ShowcaseCardSettingsProps {
  control: Control<ShowcaseFormValues>;
}

export function ShowcaseCardSettings({ control }: ShowcaseCardSettingsProps) {
  const { t } = useTranslation("showcase");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-muted/20 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor="switch-urgent"
            className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
          >
            <span>⚡ {t("form.urgentLabel")}</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t("form.urgentDescription")}
          </p>
        </div>
        <Controller
          control={control}
          name="isUrgent"
          render={({ field }) => (
            <Switch
              id="switch-urgent"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>

      <div className="border-t border-border/40 pt-2.5 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <label
            htmlFor="switch-auto-renew"
            className="text-xs font-semibold text-foreground cursor-pointer"
          >
            {t("form.autoRenewLabel")}
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t("form.autoRenewDescription")}
          </p>
        </div>
        <Controller
          control={control}
          name="autoRenew"
          render={({ field }) => (
            <Switch
              id="switch-auto-renew"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </div>
  );
}
