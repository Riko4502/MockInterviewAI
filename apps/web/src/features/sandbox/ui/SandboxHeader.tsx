import type { LanguageId } from "@packages/editor";
import { SandboxHeaderActions } from "./SandboxHeaderActions";
import { SandboxHeaderTaskSelector } from "./SandboxHeaderTaskSelector";
import { SandboxHeaderTimer } from "./SandboxHeaderTimer";

export interface SandboxHeaderProps {
  onLanguageChange?: (lang: LanguageId) => void;
  onResetCode?: () => void;
  onTaskChange?: (taskId: string) => void;
  onRunCode?: () => void;
}

export function SandboxHeader({
  onLanguageChange,
  onResetCode,
  onTaskChange,
  onRunCode,
}: SandboxHeaderProps = {}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur-md">
      <SandboxHeaderTaskSelector onTaskChange={onTaskChange} />

      <SandboxHeaderTimer />

      <SandboxHeaderActions
        onLanguageChange={onLanguageChange}
        onResetCode={onResetCode}
        onRunCode={onRunCode}
      />
    </header>
  );
}
