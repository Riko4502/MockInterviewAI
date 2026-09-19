"use client";

import { UsersIcon } from "@packages/icons";
import { Badge, Button, Select, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { useSandboxMedia } from "../model/SandboxMediaContext";
import { useSandboxStore } from "../model/useSandboxStore";

export interface SandboxHeaderTaskSelectorProps {
  onTaskChange?: (taskId: string) => void;
}

export function SandboxHeaderTaskSelector({
  onTaskChange,
}: SandboxHeaderTaskSelectorProps = {}) {
  const { t } = useTranslation("interview");
  const { peerCount, onCopyInvite, isInviteCopied } = useSandboxMedia();
  const tasks = useSandboxStore((s) => s.tasks);
  const currentTaskId = useSandboxStore((s) => s.currentTaskId);
  const setTaskId = useSandboxStore((s) => s.setTaskId);

  const handleTaskChange = (taskId: string) => {
    if (onTaskChange) {
      onTaskChange(taskId);
    } else {
      setTaskId(taskId);
    }
  };

  const currentTask = tasks.find((t) => t.id === currentTaskId);

  return (
    <div className="flex items-center gap-3">
      <Typography.Muted className="text-xs font-semibold">
        {t("sandbox.header.taskLabel")}
      </Typography.Muted>

      <Select value={currentTaskId} onValueChange={handleTaskChange}>
        <Select.Trigger className="h-9 w-[260px]">
          <Select.Value placeholder={t("sandbox.header.taskPlaceholder")} />
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
        title={t("sandbox.header.inviteTooltip")}
      >
        <UsersIcon className="size-3.5" />
        {isInviteCopied
          ? t("sandbox.header.inviteCopied")
          : t("sandbox.header.inviteButton")}
      </Button>

      {/* Индикатор онлайна (фиксированная стабильная плашка) */}
      <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 text-xs text-muted-foreground tabular-nums">
        <span
          className={`size-2 shrink-0 rounded-full transition-colors duration-300 ${
            peerCount > 1 ? "bg-emerald-500" : "bg-zinc-400"
          }`}
        />
        <span className="font-mono text-[11px] whitespace-nowrap">
          {peerCount > 1
            ? t("sandbox.header.onlineCount", { count: peerCount })
            : t("sandbox.header.singleParticipant")}
        </span>
      </div>
    </div>
  );
}
