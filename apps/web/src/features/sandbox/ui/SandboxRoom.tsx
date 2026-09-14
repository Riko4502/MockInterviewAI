"use client";

import { sessionsControllerCreateSession } from "@packages/api";
import { CodeEditorLazy } from "@packages/editor";
import { Resizable } from "@packages/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { validate as isValidUUID, v4 as uuidv4 } from "uuid";
import { useLiveKitRoom } from "@/features/realtime";
import { authToken } from "@/shared/api";
import { useSandboxRealtime } from "../lib/useSandboxRealtime";
import { useWebRTC } from "../lib/useWebRTC";
import { useSandboxTimer } from "../model/useSandboxState";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxConsolePanel } from "./SandboxConsolePanel";
import { SandboxHeader } from "./SandboxHeader";
import { SandboxTaskPanel } from "./SandboxTaskPanel";
import { SandboxVideoWidget } from "./SandboxVideoWidget";

export function SandboxRoom() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Идентификатор совместной комнаты (строго валидный UUID для бэкенда)
  const [roomId, setRoomId] = useState<string>(() => {
    const fromUrl = searchParams.get("room");
    if (fromUrl && isValidUUID(fromUrl)) return fromUrl;
    return uuidv4();
  });

  // Автоматическое создание сессии на бэкенде для авторизованных пользователей
  useEffect(() => {
    const fromUrl = searchParams.get("room");
    const token = authToken.get();

    if (!fromUrl && token) {
      sessionsControllerCreateSession()
        .then((res) => {
          if (res?.sessionId) {
            setRoomId(res.sessionId);
            const params = new URLSearchParams(searchParams.toString());
            params.set("room", res.sessionId);
            router.replace(`${pathname}?${params.toString()}`);
          }
        })
        .catch((err) => {
          console.warn("[Sandbox] Auto-provision session failed:", err);
        });
    }
  }, [searchParams, pathname, router]);

  const [isInviteCopied, setIsInviteCopied] = useState<boolean>(false);

  const code = useSandboxStore((s) => s.code);
  const setCode = useSandboxStore((s) => s.setCode);
  const language = useSandboxStore((s) => s.language);
  const setLanguage = useSandboxStore((s) => s.setLanguage);
  const theme = useSandboxStore((s) => s.theme);
  const setTaskId = useSandboxStore((s) => s.setTaskId);
  const isVideoOpen = useSandboxStore((s) => s.isVideoOpen);
  const setIsVideoOpen = useSandboxStore((s) => s.setIsVideoOpen);

  useSandboxTimer();

  const webrtcRef = useRef<ReturnType<typeof useWebRTC> | null>(null);
  const livekitRef = useRef<ReturnType<typeof useLiveKitRoom> | null>(null);

  // Реалтайм синхронизация состояния и сигналов
  const realtime = useSandboxRealtime({
    roomId,
    onRemoteCodeUpdate: (remoteCode, remoteLang) => {
      setCode((prev) => (prev === remoteCode ? prev : remoteCode));
      if (remoteLang && remoteLang !== language) {
        setLanguage(remoteLang);
      }
    },
    onRemoteTaskChange: (newTaskId) => {
      setTaskId(newTaskId);
    },
    onRemoteWebRTCSignal: (signal) => {
      // При входящем вызове автоматически открываем видеопанель
      setIsVideoOpen(true);
      switch (signal.type) {
        case "call-started":
          void livekitRef.current?.connect().catch((err) => {
            console.warn(
              "[Sandbox] LiveKit auto-connect on invite failed",
              err,
            );
          });
          break;

        case "call-ended":
          if (
            livekitRef.current?.isConnected ||
            livekitRef.current?.isConnecting
          ) {
            void livekitRef.current?.disconnect();
          }
          webrtcRef.current?.endCall();
          break;

        default:
          void webrtcRef.current?.handleSignal(signal);
          break;
      }
    },
    onRemoteRunResult: () => {
      // Удаленный запуск кода
    },
    onPeerJoined: () => {
      if (livekitRef.current?.isConnected) {
        realtime.broadcastWebRTCSignal({
          type: "call-started",
          senderId: realtime.userId,
        });
      } else if (webrtcRef.current?.isInCall) {
        void webrtcRef.current.startCall();
      }
    },
  });

  // WebRTC P2P видео/аудио звонок
  const webrtc = useWebRTC({
    userId: realtime.userId,
    onSendSignal: (signal) => {
      realtime.broadcastWebRTCSignal(signal);
    },
  });

  // LiveKit SFU видео/аудио интеграция
  const livekit = useLiveKitRoom({
    sessionId: roomId,
  });

  useEffect(() => {
    webrtcRef.current = webrtc;
    livekitRef.current = livekit;
  });

  // Синхронизация изменений локального кода
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      realtime.broadcastCodeUpdate(newCode, language);
    },
    [setCode, realtime, language],
  );

  // Копирование ссылки приглашения
  const handleCopyInvite = useCallback(() => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}${pathname}?room=${roomId}`;
      navigator.clipboard.writeText(url).then(() => {
        setIsInviteCopied(true);
        setTimeout(() => setIsInviteCopied(false), 2500);
      });
    }
  }, [pathname, roomId]);

  const isInCall = livekit.isConnected || webrtc.isInCall;
  const localStream = livekit.localStream || webrtc.localStream;
  const remoteStream = livekit.remoteStream || webrtc.remoteStream;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Верхний тулбар управления */}
      <SandboxHeader
        peerCount={realtime.peerCount}
        isInCall={isInCall}
        onCopyInvite={handleCopyInvite}
        isInviteCopied={isInviteCopied}
      />

      {/* Основная рабочая область со сплиттерами */}
      <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
        <Resizable.Group orientation="horizontal" className="h-full w-full">
          {/* Левая панель: Условие задачи, AI подсказки, Заметки */}
          <Resizable.Panel
            defaultSize="15%"
            minSize="15%"
            maxSize="15%"
            className="min-w-0 min-h-0"
          >
            <SandboxTaskPanel />
          </Resizable.Panel>

          <Resizable.Handle withHandle />

          {/* Правая панель: Редактор кода (сверху) + Консоль (снизу) */}
          <Resizable.Panel
            defaultSize="55%"
            minSize="15%"
            className="min-w-0 min-h-0"
          >
            <Resizable.Group orientation="vertical" className="h-full w-full">
              {/* Верхняя часть: Monaco Редактор */}
              <Resizable.Panel
                defaultSize="60%"
                minSize="20%"
                maxSize="85%"
                className="min-w-0 min-h-0"
              >
                <div className="relative h-full w-full min-w-0 min-h-0 overflow-hidden bg-background">
                  <CodeEditorLazy
                    value={code}
                    onChange={(val) => handleCodeChange(val ?? "")}
                    language={language}
                    theme={theme}
                    collaborators={realtime.collaborators}
                    onCursorChange={realtime.broadcastCursorMove}
                    options={{
                      fontSize: 14,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      tabSize: 2,
                    }}
                  />
                </div>
              </Resizable.Panel>

              <Resizable.Handle withHandle />

              {/* Нижняя часть: Результаты тестов и Консоль */}
              <Resizable.Panel
                defaultSize="40%"
                minSize="15%"
                maxSize="80%"
                className="min-w-0 min-h-0"
              >
                <SandboxConsolePanel />
              </Resizable.Panel>
            </Resizable.Group>
          </Resizable.Panel>
        </Resizable.Group>
      </div>

      {/* Плавающий виджет WebRTC / LiveKit видеосвязи */}
      <SandboxVideoWidget
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        localStream={localStream}
        remoteStream={remoteStream}
        connectionState={
          livekit.isConnected
            ? "connected"
            : livekit.isConnecting
              ? "calling"
              : webrtc.connectionState
        }
        isInCall={isInCall}
        isAudioMuted={
          livekit.isConnected
            ? !livekit.isMicrophoneEnabled
            : webrtc.isAudioMuted
        }
        isVideoOff={
          livekit.isConnected ? !livekit.isCameraEnabled : webrtc.isVideoOff
        }
        isRemoteVideoOff={
          livekit.isConnected
            ? livekit.isRemoteVideoOff
            : webrtc.isRemoteVideoOff
        }
        isRemoteAudioMuted={
          livekit.isConnected
            ? livekit.isRemoteAudioMuted
            : webrtc.isRemoteAudioMuted
        }
        isScreenSharing={
          livekit.isConnected
            ? livekit.isScreenShareEnabled
            : webrtc.isScreenSharing
        }
        callError={livekit.isConnected ? livekit.error : webrtc.callError}
        onStartCall={async () => {
          setIsVideoOpen(true);
          try {
            await livekit.connect();
            realtime.broadcastWebRTCSignal({
              type: "call-started",
              senderId: realtime.userId,
            });
          } catch (err) {
            console.warn(
              "[Sandbox] LiveKit connect failed, falling back to WebRTC P2P",
              err,
            );
            void webrtc.startCall();
          }
        }}
        onEndCall={() => {
          if (livekit.isConnected || livekit.isConnecting) {
            void livekit.disconnect();
          }
          webrtc.endCall();
          realtime.broadcastWebRTCSignal({
            type: "call-ended",
            senderId: realtime.userId,
          });
        }}
        onToggleAudio={() => {
          if (livekit.isConnected) {
            void livekit.toggleMicrophone();
          } else {
            webrtc.toggleAudio();
          }
        }}
        onToggleVideo={() => {
          if (livekit.isConnected) {
            void livekit.toggleCamera();
          } else {
            webrtc.toggleVideo();
          }
        }}
        onToggleScreenShare={() => {
          if (livekit.isConnected) {
            void livekit.toggleScreenShare();
          } else {
            void webrtc.toggleScreenShare();
          }
        }}
        peerName={realtime.otherPeers[0]?.name || "Собеседник"}
        hasPeerOnline={realtime.otherPeers.length > 0}
        onCopyInvite={handleCopyInvite}
        isInviteCopied={isInviteCopied}
      />
    </div>
  );
}
