"use client";

import { Badge, Typography } from "@packages/ui";
import { useSandboxStore } from "../model/useSandboxStore";

export function SandboxTaskDescription() {
  const task = useSandboxStore((s) => s.getCurrentTask());

  return (
    <div className="space-y-6">
      <div>
        <Typography.H2 className="text-xl font-bold tracking-tight text-foreground">
          {task.title}
        </Typography.H2>
        <div className="mt-2 flex items-center gap-2">
          <Badge
            variant={
              task.difficulty === "Easy"
                ? "success"
                : task.difficulty === "Medium"
                  ? "warning"
                  : "error"
            }
          >
            {task.difficulty}
          </Badge>
          <Typography.Muted className="text-xs">
            Категория: {task.category}
          </Typography.Muted>
        </div>
      </div>

      {/* Описание */}
      <Typography.P className="whitespace-pre-line text-foreground/90">
        {task.description}
      </Typography.P>

      {/* Примеры */}
      <div className="space-y-4">
        <Typography.H4 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Примеры:
        </Typography.H4>
        {task.examples.map((example, idx) => (
          <div
            key={`example-${idx}-${example.input.slice(0, 15)}`}
            className="rounded-lg border border-border/80 bg-background/60 p-3.5 font-mono text-xs shadow-2xs"
          >
            <Typography.Muted className="font-semibold">
              Пример {idx + 1}:
            </Typography.Muted>
            <div className="mt-1 text-foreground">
              <span className="text-muted-foreground">Вход: </span>
              {example.input}
            </div>
            <div className="mt-0.5 text-foreground">
              <span className="text-muted-foreground">Вывод: </span>
              {example.output}
            </div>
            {example.explanation && (
              <Typography.Muted className="mt-1 font-sans text-xs italic">
                Пояснение: {example.explanation}
              </Typography.Muted>
            )}
          </div>
        ))}
      </div>

      {/* Ограничения */}
      <div className="space-y-2">
        <Typography.H4 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Ограничения (Constraints):
        </Typography.H4>
        <ul className="list-inside list-disc space-y-1 font-mono text-xs text-muted-foreground">
          {task.constraints.map((c, i) => (
            <li key={`constraint-${i}-${c.slice(0, 10)}`}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
