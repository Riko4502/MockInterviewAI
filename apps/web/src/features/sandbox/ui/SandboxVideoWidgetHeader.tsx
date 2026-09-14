"use client";

import { CloseIcon, MaximizeIcon, MinimizeIcon } from "@packages/icons";
import { Badge } from "@packages/ui";
import type { ConnectionState } from "../lib/useWebRTC";

interface SandboxVideoWidgetHeaderProps {
  isInCall: boolean;
  hasPeerOnline: boolean;
  remoteStream: MediaStream | null;
  connectionState: ConnectionState;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
}

export function SandboxVideoWidgetHeader({
  isInCall,
  hasPeerOnline,
  remoteStream,
  connectionState,
  isMinimized,
  onToggleMinimize,
  onClose,
}: SandboxVideoWidgetHeaderProps) {
  const isConnected = Boolean(remoteStream || (isInCall && hasPeerOnline));
  const isCalling = isInCall || connectionState === "calling";

  return (
    <div className="flex h-11 items-center justify-between border-b border-border/80 bg-muted/40 px-3.5">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span
            className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${
              isConnected
                ? "bg-emerald-400"
                : isCalling
                  ? "bg-amber-400"
                  : "bg-zinc-400"
            }`}
          />
          <span
            className={`relative inline-flex size-2.5 rounded-full ${
              isConnected
                ? "bg-emerald-500"
                : isCalling
                  ? "bg-amber-500"
                  : "bg-zinc-500"
            }`}
          />
        </span>
        <span className="text-xs font-semibold text-foreground">
          {isConnected
            ? "Видеозвонок онлайн"
            : isCalling
              ? "Вызов..."
              : "Видеосвязь"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge
          variant={isConnected ? "success" : isInCall ? "neutral" : "outline"}
          className="text-[10px] px-1.5 py-0"
        >
          {isConnected
            ? "В звонке 🟢"
            : isInCall
              ? "Ожидание видео..."
              : hasPeerOnline
                ? "Собеседник в сети"
                : "Ожидание собеседника"}
        </Badge>

        <button
          type="button"
          onClick={onToggleMinimize}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={isMinimized ? "Развернуть" : "Свернуть"}
        >
          {isMinimized ? (
            <MaximizeIcon className="size-3.5" />
          ) : (
            <MinimizeIcon className="size-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-rose-500/20 hover:text-rose-400"
          title="Закрыть панель видео"
        >
          <CloseIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
