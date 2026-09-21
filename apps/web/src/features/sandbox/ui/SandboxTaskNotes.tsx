"use client";

import { Textarea, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";

export function SandboxTaskNotes() {
  const { t } = useTranslation("interview");
  const notes = useSandboxStore((s) => s.notes);
  const setNotes = useSandboxStore((s) => s.setNotes);

  return (
    <div className="flex h-full flex-col space-y-3">
      <Typography.Muted className="text-xs">
        {t("sandbox.notes.title")}
      </Typography.Muted>
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("sandbox.notes.placeholder")}
        className="flex-1 resize-none font-mono text-xs leading-relaxed"
      />
      <span className="text-[10px] text-muted-foreground">
        {t("sandbox.notes.disclaimer")}
      </span>
    </div>
  );
}
