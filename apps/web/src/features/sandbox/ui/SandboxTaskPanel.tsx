"use client";

import { BookIcon, EditIcon, WandIcon } from "@packages/icons";
import { Tabs } from "@packages/ui";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import { type SandboxLeftTab, useSandboxStore } from "../model/useSandboxStore";
import { SandboxTaskDescription } from "./SandboxTaskDescription";
import { SandboxTaskHints } from "./SandboxTaskHints";
import { SandboxTaskNotes } from "./SandboxTaskNotes";

export function SandboxTaskPanel() {
  const { t } = useTranslation("interview");
  const activeTab = useSandboxStore((s) => s.leftTab);
  const setLeftTab = useSandboxStore((s) => s.setLeftTab);
  const task = useSandboxStore((s) => s.getCurrentTask());
  const revealedHints = useSandboxStore((s) => s.revealedHints);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card/40">
      <Tabs
        value={activeTab}
        onValueChange={(val) => setLeftTab(val as SandboxLeftTab)}
        className="flex h-full flex-col overflow-hidden"
      >
        <div className="flex h-11 shrink-0 items-center border-b border-border bg-card/70 px-3">
          <Tabs.List size="sm" className="bg-muted/60 p-0.5">
            <Tabs.Trigger value="description" className="gap-1.5 text-xs">
              <BookIcon className="size-3.5" />
              {t("sandbox.tabs.description")}
            </Tabs.Trigger>

            <Tabs.Trigger value="hints" className="gap-1.5 text-xs">
              <WandIcon className="size-3.5 text-purple-400" />
              {t("sandbox.tabs.hints")}
              {revealedHints > 0 && (
                <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold text-purple-400">
                  {revealedHints}/{task.hints.length}
                </span>
              )}
            </Tabs.Trigger>

            <Tabs.Trigger value="notes" className="gap-1.5 text-xs">
              <EditIcon className="size-3.5" />
              {t("sandbox.tabs.notes")}
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        <Tabs.Content
          value="description"
          className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed"
        >
          <SandboxTaskDescription />
        </Tabs.Content>

        <Tabs.Content
          value="hints"
          className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed"
        >
          <SandboxTaskHints />
        </Tabs.Content>

        <Tabs.Content value="notes" className="flex-1 overflow-y-auto p-5">
          <SandboxTaskNotes />
        </Tabs.Content>
      </Tabs>
    </div>
  );
}
