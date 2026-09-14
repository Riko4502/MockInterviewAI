"use client";

import {
  CameraIcon,
  CloseIcon,
  EyeIcon,
  EyeOffIcon,
  MicIcon,
  ScreenIcon,
} from "@packages/icons";
import { Button } from "@packages/ui";
import type { ConnectionState } from "../lib/useWebRTC";

interface SandboxVideoWidgetControlsProps {
  localStream: MediaStream | null;
  isInCall: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  connectionState: ConnectionState;
  hasPeerOnline: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

export function SandboxVideoWidgetControls({
  localStream,
  isInCall,
  isAudioMuted,
  isVideoOff,
  isScreenSharing,
  connectionState,
  hasPeerOnline,
  onStartCall,
  onEndCall,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
}: SandboxVideoWidgetControlsProps) {
  return (
    <div className="flex items-center justify-between border-t border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {isInCall || localStream ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onEndCall}
            className="h-8 gap-1.5 px-3 text-xs shadow-xs"
            title="Завершить видеозвонок"
          >
            <CloseIcon className="size-3.5" />
            Завершить
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={onStartCall}
            disabled={connectionState === "calling"}
            className="h-8 gap-1.5 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700 shadow-xs"
            title="Позвонить собеседнику по WebRTC"
          >
            <CameraIcon className="size-3.5" />
            {connectionState === "calling" ? "Вызов..." : "Позвонить"}
          </Button>
        )}

        {(isInCall || localStream) && (
          <>
            <Button
              variant={isAudioMuted ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleAudio}
              className="h-8 gap-1 px-2 text-xs"
              title={isAudioMuted ? "Включить микрофон" : "Выключить микрофон"}
            >
              <MicIcon className="size-3.5" />
              {isAudioMuted ? "Мут" : "Вкл"}
            </Button>

            <Button
              variant={isVideoOff ? "destructive" : "outline"}
              size="sm"
              onClick={onToggleVideo}
              className="h-8 px-2 text-xs"
              title={isVideoOff ? "Включить камеру" : "Выключить камеру"}
            >
              {isVideoOff ? (
                <EyeOffIcon className="size-3.5" />
              ) : (
                <EyeIcon className="size-3.5" />
              )}
            </Button>

            <Button
              variant={isScreenSharing ? "primary" : "outline"}
              size="sm"
              onClick={onToggleScreenShare}
              className={`h-8 gap-1 px-2 text-xs ${
                isScreenSharing
                  ? "bg-indigo-600 text-white hover:bg-indigo-700"
                  : ""
              }`}
              title="Демонстрация экрана"
            >
              <ScreenIcon className="size-3.5" />
              Экран
            </Button>
          </>
        )}
      </div>

      <span className="text-[11px] font-medium text-muted-foreground">
        {isInCall ? "🟢 В звонке" : hasPeerOnline ? "Собеседник ждет" : "Один"}
      </span>
    </div>
  );
}
