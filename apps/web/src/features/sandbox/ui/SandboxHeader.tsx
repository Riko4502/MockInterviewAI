import type { LanguageId } from "@packages/editor";
import { SandboxHeaderActions } from "./SandboxHeaderActions";
import { SandboxHeaderTaskSelector } from "./SandboxHeaderTaskSelector";
import { SandboxHeaderTimer } from "./SandboxHeaderTimer";

export interface SandboxHeaderProps {
  onLanguageChange?: (lang: LanguageId) => void;
  onResetCode?: () => void;
}

export function SandboxHeader({
  onLanguageChange,
  onResetCode,
}: SandboxHeaderProps = {}) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur-md">
      <SandboxHeaderTaskSelector />

      <SandboxHeaderTimer />

      <SandboxHeaderActions
        onLanguageChange={onLanguageChange}
        onResetCode={onResetCode}
      />
    </header>
  );
}
