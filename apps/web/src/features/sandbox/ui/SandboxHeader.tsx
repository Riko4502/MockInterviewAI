"use client";

import { SandboxHeaderActions } from "./SandboxHeaderActions";
import { SandboxHeaderTaskSelector } from "./SandboxHeaderTaskSelector";
import { SandboxHeaderTimer } from "./SandboxHeaderTimer";

export interface SandboxHeaderProps {
  peerCount: number;
  isInCall: boolean;
  onCopyInvite: () => void;
  isInviteCopied: boolean;
}

export function SandboxHeader({
  peerCount,
  isInCall,
  onCopyInvite,
  isInviteCopied,
}: SandboxHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 backdrop-blur-md">
      <SandboxHeaderTaskSelector
        peerCount={peerCount}
        onCopyInvite={onCopyInvite}
        isInviteCopied={isInviteCopied}
      />

      <SandboxHeaderTimer />

      <SandboxHeaderActions isInCall={isInCall} />
    </header>
  );
}
