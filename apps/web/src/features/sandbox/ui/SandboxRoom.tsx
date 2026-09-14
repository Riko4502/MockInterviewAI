"use client";

import { CodeEditorLazy, type LanguageId } from "@packages/editor";
import { Resizable } from "@packages/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveKitRoom } from "@/features/realtime";
import { useSandboxRealtime } from "../lib/useSandboxRealtime";
import { useWebRTC } from "../lib/useWebRTC";
import { useSandboxState } from "../model/useSandboxState";
import { SandboxConsolePanel } from "./SandboxConsolePanel";
import { SandboxHeader } from "./SandboxHeader";
import { SandboxTaskPanel } from "./SandboxTaskPanel";
import { SandboxVideoWidget } from "./SandboxVideoWidget";

function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    str,
  );
}

export function SandboxRoom() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Идентификатор совместной комнаты (строго валидный UUID для бэкенда)
  const [roomId, setRoomId] = useState<string>(() => {
    const fromUrl = searchParams.get("room");
    if (fromUrl && isValidUUID(fromUrl)) return fromUrl;
    return generateUUID();
  });

  // Автоматическая синхронизация URL с room
  useEffect(() => {
    const currentRoom = searchParams.get("room");
    if (!currentRoom || !isValidUUID(currentRoom)) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("room", roomId);
      router.replace(`${pathname}?${params.toString()}`);
    } else if (currentRoom !== roomId) {
      setRoomId(currentRoom);
    }
  }, [searchParams, roomId, pathname, router]);

  const [isVideoOpen, setIsVideoOpen] = useState<boolean>(false);
  const [isInviteCopied, setIsInviteCopied] = useState<boolean>(false);

  const {
    tasks,
    currentTask,
    currentTaskId,
    setCurrentTaskId,
    language,
    setLanguage,
    theme,
    setTheme,
    code,
    setCode,
    resetCode,
    leftTab,
    setLeftTab,
    consoleTab,
    setConsoleTab,
    notes,
    setNotes,
    revealedHints,
    revealNextHint,
    timerSeconds,
    isTimerRunning,
    toggleTimer,
    resetTimer,
    isRunning,
    runResult,
    runCode,
  } = useSandboxState();

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
      setCurrentTaskId(newTaskId);
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

  // Синхронизация выбора задачи
  const handleTaskChange = useCallback(
    (taskId: string) => {
      setCurrentTaskId(taskId);
      realtime.broadcastTaskChange(taskId);
    },
    [setCurrentTaskId, realtime],
  );

  // Синхронизация смены языка
  const handleLanguageChange = useCallback(
    (newLang: LanguageId) => {
      setLanguage(newLang);
    },
    [setLanguage],
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
        tasks={tasks}
        currentTaskId={currentTaskId}
        onTaskChange={handleTaskChange}
        language={language}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
        timerSeconds={timerSeconds}
        isTimerRunning={isTimerRunning}
        onToggleTimer={toggleTimer}
        onResetTimer={resetTimer}
        onResetCode={resetCode}
        onRunCode={runCode}
        isRunning={isRunning}
        isVideoOpen={isVideoOpen}
        onToggleVideo={() => setIsVideoOpen((prev) => !prev)}
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
            <SandboxTaskPanel
              task={currentTask}
              activeTab={leftTab}
              onTabChange={setLeftTab}
              notes={notes}
              onNotesChange={setNotes}
              revealedHints={revealedHints}
              onRevealNextHint={revealNextHint}
            />
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
                <SandboxConsolePanel
                  activeTab={consoleTab}
                  onTabChange={setConsoleTab}
                  runResult={runResult}
                  isRunning={isRunning}
                  onRunCode={runCode}
                />
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
