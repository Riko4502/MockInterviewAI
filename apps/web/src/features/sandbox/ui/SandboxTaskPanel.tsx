"use client";

import { BookIcon, EditIcon, WandIcon } from "@packages/icons";
import { Tabs } from "@packages/ui";
import type { InterviewTask } from "../model/types";
import { SandboxTaskDescription } from "./SandboxTaskDescription";
import { SandboxTaskHints } from "./SandboxTaskHints";
import { SandboxTaskNotes } from "./SandboxTaskNotes";

interface SandboxTaskPanelProps {
  task: InterviewTask;
  activeTab: "description" | "hints" | "notes";
  onTabChange: (tab: "description" | "hints" | "notes") => void;
  notes: string;
  onNotesChange: (notes: string) => void;
  revealedHints: number;
  onRevealNextHint: () => void;
}

export function SandboxTaskPanel({
  task,
  activeTab,
  onTabChange,
  notes,
  onNotesChange,
  revealedHints,
  onRevealNextHint,
}: SandboxTaskPanelProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/40">
      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          onTabChange(val as "description" | "hints" | "notes")
        }
        className="flex h-full flex-col overflow-hidden"
      >
        <div className="flex h-11 shrink-0 items-center border-b border-border bg-card/70 px-3">
          <Tabs.List size="sm" className="bg-muted/60 p-0.5">
            <Tabs.Trigger value="description" className="gap-1.5 text-xs">
              <BookIcon className="size-3.5" />
              Условие
            </Tabs.Trigger>

            <Tabs.Trigger value="hints" className="gap-1.5 text-xs">
              <WandIcon className="size-3.5 text-purple-400" />
              AI Подсказки
              {revealedHints > 0 && (
                <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold text-purple-400">
                  {revealedHints}/{task.hints.length}
                </span>
              )}
            </Tabs.Trigger>

            <Tabs.Trigger value="notes" className="gap-1.5 text-xs">
              <EditIcon className="size-3.5" />
              Заметки
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content
          value="description"
          className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed"
        >
          <SandboxTaskDescription task={task} />
        </Tabs.Content>

        <Tabs.Content
          value="hints"
          className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed"
        >
          <SandboxTaskHints
            task={task}
            revealedHints={revealedHints}
            onRevealNextHint={onRevealNextHint}
          />
        </Tabs.Content>

        <Tabs.Content value="notes" className="flex-1 overflow-y-auto p-5">
          <SandboxTaskNotes notes={notes} onNotesChange={onNotesChange} />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
