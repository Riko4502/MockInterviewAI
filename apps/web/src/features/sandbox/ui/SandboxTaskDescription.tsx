"use client";

import { Badge, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxStore } from "../model/useSandboxStore";
import { DIFFICULTY_LOCALIZATION } from "./constants";

export function SandboxTaskDescription() {
  const { t } = useTranslation("interview");
  const task = useSandboxStore((s) => s.getCurrentTask());

  const { difficulty, category, title, description, examples, constraints } =
    task;

  return (
    <div className="space-y-6">
      <div>
        <Typography.H2 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </Typography.H2>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={DIFFICULTY_LOCALIZATION[difficulty]}>
            {difficulty}
          </Badge>
          <Typography.Muted className="text-xs">
            {t("sandbox.task.category", { category })}
          </Typography.Muted>
        </div>
      </div>

      {/* Описание */}
      <Typography.P className="whitespace-pre-line text-foreground/90">
        {description}
      </Typography.P>

      {/* Примеры */}
      <div className="space-y-4">
        <Typography.H4 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {t("sandbox.task.examples")}
        </Typography.H4>
        {examples.map(({ input, output, explanation }, idx) => (
          <div
            key={`example-${idx}-${input.slice(0, 15)}`}
            className="rounded-lg border border-border/80 bg-background/60 p-3.5 font-mono text-xs shadow-2xs"
          >
            <Typography.Muted className="font-semibold">
              {t("sandbox.task.example", { number: idx + 1 })}
            </Typography.Muted>
            <div className="mt-1 text-foreground">
              <span className="text-muted-foreground">
                {t("sandbox.task.input")}{" "}
              </span>
              {input}
            </div>
            <div className="mt-0.5 text-foreground">
              <span className="text-muted-foreground">
                {t("sandbox.task.output")}{" "}
              </span>
              {output}
            </div>
            {explanation && (
              <Typography.Muted className="mt-1 font-sans text-xs italic">
                {t("sandbox.task.explanation", { explanation })}
              </Typography.Muted>
            )}
          </div>
        ))}
      </div>

      {/* Ограничения */}
      <div className="space-y-2">
        <Typography.H4 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          {t("sandbox.task.constraints")}
        </Typography.H4>
        <ul className="list-inside list-disc space-y-1 font-mono text-xs text-muted-foreground">
          {constraints.map((c, i) => (
            <li key={`constraint-${i}-${c.slice(0, 10)}`}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
