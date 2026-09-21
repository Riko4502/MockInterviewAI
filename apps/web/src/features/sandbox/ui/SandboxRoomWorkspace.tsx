"use client";

import { CodeEditorLazy, type LanguageId } from "@packages/editor";
import { Resizable } from "@packages/ui";
import { useCallback, useEffect, useState } from "react";
import * as Y from "yjs";
import { RealtimeYjsProvider } from "../lib/RealtimeYjsProvider";
import { useSandboxRealtime } from "../lib/useSandboxRealtime";
import { SandboxMediaProvider } from "../model/SandboxMediaContext";
import { useSandboxTimer } from "../model/useSandboxState";
import { useSandboxStore } from "../model/useSandboxStore";
import { SandboxConsolePanel } from "./SandboxConsolePanel";
import { SandboxHeader } from "./SandboxHeader";
import { SandboxTaskPanel } from "./SandboxTaskPanel";
import { SandboxVideoWidget } from "./SandboxVideoWidget";

export interface SandboxRoomWorkspaceProps {
  roomId: string;
  role: string | null;
  pathname: string;
  inviteToken?: string;
}

export function SandboxRoomWorkspace({
  roomId,
  role,
  pathname,
  inviteToken,
}: SandboxRoomWorkspaceProps) {
  const code = useSandboxStore((s) => s.code);
  const setCode = useSandboxStore((s) => s.setCode);
  const language = useSandboxStore((s) => s.language);
  const setLanguage = useSandboxStore((s) => s.setLanguage);
  const applyRemoteCodeUpdate = useSandboxStore((s) => s.applyRemoteCodeUpdate);
  const resetCode = useSandboxStore((s) => s.resetCode);
  const theme = useSandboxStore((s) => s.theme);
  const setTaskId = useSandboxStore((s) => s.setTaskId);
  const currentTaskId = useSandboxStore((s) => s.currentTaskId);
  const setIsVideoOpen = useSandboxStore((s) => s.setIsVideoOpen);

  useSandboxTimer();

  // Yjs CRDT: Инициализация Y.Doc и Y.Text активного документа (Phase 3: T018)
  const [yDoc] = useState(() => new Y.Doc());
  const [yText, setYText] = useState<Y.Text | null>(null);

  // Реалтайм синхронизация состояния и сигналов
  const realtime = useSandboxRealtime({
    roomId,
    onRemoteCodeUpdate: (remoteCode, remoteLang) => {
      applyRemoteCodeUpdate(remoteCode, remoteLang);
    },
    onRemoteTaskChange: (newTaskId) => {
      setTaskId(newTaskId);
    },
    onRemoteWebRTCSignal: (signal) => {
      if (signal?.type === "call-started" || signal?.type === "offer") {
        setIsVideoOpen(true);
      }
    },
  });

  // Подключение RealtimeYjsProvider к сессионному сокету (T018)
  const taskKey = `${currentTaskId || "default"}:${language}`;

  useEffect(() => {
    const text = yDoc.getText("monaco");
    setYText(text);

    const provider = new RealtimeYjsProvider({
      doc: yDoc,
      taskKey,
      sessionId: roomId,
      sendEnvelope: realtime.sendEnvelope,
    });

    const unsubscribe = realtime.subscribeEnvelope?.((envelope) => {
      provider.handleMessage(envelope);
    });

    return () => {
      unsubscribe?.();
      provider.destroy();
    };
  }, [
    yDoc,
    taskKey,
    roomId,
    realtime.sendEnvelope,
    realtime.subscribeEnvelope,
  ]);

  // Корректное освобождение Y.Doc при размонтировании рабочей области
  useEffect(() => {
    return () => {
      yDoc.destroy();
    };
  }, [yDoc]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      realtime.broadcastCodeUpdate(newCode, language);
    },
    [setCode, realtime, language],
  );

  const handleTaskChange = useCallback(
    (newTaskId: string) => {
      setTaskId(newTaskId);
      realtime.broadcastTaskChange(newTaskId);
    },
    [setTaskId, realtime],
  );

  const handleLanguageChange = useCallback(
    (newLang: LanguageId) => {
      const newCode = setLanguage(newLang);
      realtime.broadcastCodeUpdate(newCode, newLang);
    },
    [setLanguage, realtime],
  );

  const handleResetCode = useCallback(() => {
    resetCode();
    const currentTask = useSandboxStore.getState().getCurrentTask();
    const starter = currentTask.starterCode[language] ?? "";
    realtime.broadcastCodeUpdate(starter, language);
  }, [resetCode, realtime, language]);

  return (
    <SandboxMediaProvider
      roomId={roomId}
      pathname={pathname}
      inviteToken={inviteToken}
      realtime={realtime}
    >
      <div
        data-testid="sandbox-room"
        data-room-id={roomId}
        data-role={role}
        className="flex h-full w-full flex-col overflow-hidden bg-background"
      >
        {/* Верхний тулбар управления */}
        <SandboxHeader
          onLanguageChange={handleLanguageChange}
          onResetCode={handleResetCode}
          onTaskChange={handleTaskChange}
        />

        {/* Основная рабочая область со сплиттерами */}
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <Resizable.Group orientation="horizontal" className="h-full w-full">
            {/* Левая панель: Условие задачи, AI подсказки, Заметки */}
            <Resizable.Panel
              defaultSize="15%"
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
                      yText={yText ?? undefined}
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
        <SandboxVideoWidget />
      </div>
    </SandboxMediaProvider>
  );
}
