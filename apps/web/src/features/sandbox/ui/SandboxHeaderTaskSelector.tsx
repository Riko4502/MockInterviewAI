"use client";

import { UsersIcon } from "@packages/icons";
import { Badge, Button, Select, Typography } from "@packages/ui";
import { useSandboxStore } from "../model/useSandboxStore";

interface SandboxHeaderTaskSelectorProps {
  peerCount: number;
  onCopyInvite: () => void;
  isInviteCopied: boolean;
}

export function SandboxHeaderTaskSelector({
  peerCount,
  onCopyInvite,
  isInviteCopied,
}: SandboxHeaderTaskSelectorProps) {
  const tasks = useSandboxStore((s) => s.tasks);
  const currentTaskId = useSandboxStore((s) => s.currentTaskId);
  const setTaskId = useSandboxStore((s) => s.setTaskId);

  const currentTask = tasks.find((t) => t.id === currentTaskId);

  return (
    <div className="flex items-center gap-3">
      <Typography.Muted className="text-xs font-semibold">
        Задача:
      </Typography.Muted>

      <Select value={currentTaskId} onValueChange={setTaskId}>
        <Select.Trigger className="h-9 w-[260px]">
          <Select.Value placeholder="Выберите задачу" />
        </Select.Trigger>
        <Select.Content>
          {tasks.map((task) => (
            <Select.Item key={task.id} value={task.id}>
              {task.title}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>

      {currentTask && (
        <Badge
          variant={
            currentTask.difficulty === "Easy"
              ? "success"
              : currentTask.difficulty === "Medium"
                ? "warning"
                : "error"
          }
        >
          {currentTask.difficulty}
        </Badge>
      )}

      {/* Кнопка приглашения собеседника */}
      <Button
        variant={isInviteCopied ? "primary" : "outline"}
        size="sm"
        onClick={onCopyInvite}
        className={`h-8 gap-1.5 px-2.5 text-xs transition-all ${
          isInviteCopied ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""
        }`}
        title="Скопировать ссылку для совместного решения и созвона"
      >
        <UsersIcon className="size-3.5" />
        {isInviteCopied ? "Ссылка скопирована! ✓" : "Пригласить собеседника"}
      </Button>

      {/* Индикатор онлайна (фиксированная стабильная плашка) */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 text-xs text-muted-foreground tabular-nums">
        <span
          className={`size-2 shrink-0 rounded-full transition-colors duration-300 ${
            peerCount > 1 ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
        <span className="font-mono text-[11px] whitespace-nowrap">
          {peerCount > 1 ? `Онлайн: ${peerCount}` : "1 участник"}
        </span>
      </div>
    </div>
  );
}
