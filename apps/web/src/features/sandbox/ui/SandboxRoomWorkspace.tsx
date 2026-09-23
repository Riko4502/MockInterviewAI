"use client";

import { CodeEditorLazy, type LanguageId } from "@packages/editor";
import { Resizable } from "@packages/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { baseFetch } from "@/shared/api/base";
import { getColorForUser } from "../lib/mapPeerToCollaborator";
import { RealtimeYjsProvider } from "../lib/RealtimeYjsProvider";
import { useSandboxRealtime } from "../lib/useSandboxRealtime";
import { SandboxMediaProvider } from "../model/SandboxMediaContext";
import type { RunResult } from "../model/types";
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
  const setIsRunning = useSandboxStore((s) => s.setIsRunning);
  const setRunResult = useSandboxStore((s) => s.setRunResult);

  useSandboxTimer();

  // Yjs CRDT: Изолированные Y.Text и Awareness активной задачи (Phase 6: T029, T031)
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [yAwareness, setYAwareness] = useState<Awareness | null>(null);

  // Реалтайм синхронизация состояния и сигналов
  const realtime = useSandboxRealtime({
    roomId,
    onRemoteCodeUpdate: (remoteCode, remoteLang) => {
      applyRemoteCodeUpdate(remoteCode, remoteLang);
    },
    onRemoteTaskChange: (newTaskId, newLang) => {
      setTaskId(newTaskId);
      if (newLang) {
        setLanguage(newLang);
      }
    },
    onRemoteWebRTCSignal: (signal) => {
      if (signal?.type === "call-started" || signal?.type === "offer") {
        setIsVideoOpen(true);
      }
    },
    onRemoteRunResult: (result) => {
      setRunResult(result);
      setIsRunning(false);
    },
  });

  // Идентификатор активного документа задачи
  const taskKey = `${currentTaskId || "default"}:${language}`;
  const initialTaskKeyRef = useRef(taskKey);

  const sendEnvelopeRef = useRef(realtime.sendEnvelope);
  sendEnvelopeRef.current = realtime.sendEnvelope;

  const subscribeEnvelopeRef = useRef(realtime.subscribeEnvelope);
  subscribeEnvelopeRef.current = realtime.subscribeEnvelope;

  const providerRef = useRef<RealtimeYjsProvider | null>(null);

  // Инициализация единого провайдера сессии с поддержкой изолированных задач (T029, T031)
  useEffect(() => {
    const initialKey = initialTaskKeyRef.current;
    const userColor = getColorForUser(realtime.userId);
    const provider = new RealtimeYjsProvider({
      taskKey: initialKey,
      sessionId: roomId,
      user: {
        userId: realtime.userId || "anonymous",
        name: realtime.userName || "Participant",
        color: userColor,
      },
      sendEnvelope: (envelope) => sendEnvelopeRef.current?.(envelope),
    });
    providerRef.current = provider;

    const taskContext = provider.getOrCreateTask(initialKey);
    setYText(taskContext.doc.getText("monaco"));
    setYAwareness(taskContext.awareness);

    const unsubscribe = subscribeEnvelopeRef.current?.((envelope) => {
      provider.handleMessage(envelope);
    });

    return () => {
      unsubscribe?.();
      provider.destroy();
      providerRef.current = null;
      setYText(null);
      setYAwareness(null);
    };
  }, [roomId, realtime.userId, realtime.userName]);

  // Переключение активного контекста задачи при смене taskKey (T031)
  useEffect(() => {
    if (!providerRef.current) return;
    const taskContext = providerRef.current.switchTask(taskKey);
    setYText(taskContext.doc.getText("monaco"));
    setYAwareness(taskContext.awareness);
  }, [taskKey]);

  // Синхронизация состояния подключения провайдера при обрыве и восстановлении WebSocket
  useEffect(() => {
    if (!providerRef.current) return;
    if (realtime.wsConnected) {
      providerRef.current.connect();
    } else {
      providerRef.current.disconnect();
    }
  }, [realtime.wsConnected]);

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
      realtime.broadcastTaskChange(newTaskId, language);
    },
    [setTaskId, realtime, language],
  );

  const handleLanguageChange = useCallback(
    (newLang: LanguageId) => {
      setLanguage(newLang);
      realtime.broadcastTaskChange(currentTaskId, newLang);
    },
    [setLanguage, realtime, currentTaskId],
  );

  const handleResetCode = useCallback(() => {
    resetCode();
    const currentTask = useSandboxStore.getState().getCurrentTask();
    const starter = currentTask.starterCode[language] ?? "";
    realtime.broadcastCodeUpdate(starter, language);
  }, [resetCode, realtime, language]);

  // Неизменяемый срез yText.toString() для запуска тестов в Code Runner (T033)
  const handleRunCode = useCallback(async () => {
    // Архитектурный принцип Phase 7:
    // Источником актуального текста является yText.toString() для активного taskKey,
    // формирующий моментальный неизменяемый строковый срез перед отправкой в Code Runner.
    const codeSnapshot = yText ? yText.toString() : code;

    setIsRunning(true);

    try {
      const result = await baseFetch<RunResult>("/api/v1/code/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: codeSnapshot,
          taskKey,
          taskId: currentTaskId,
          language,
        }),
      });

      setRunResult(result);
      realtime.broadcastRunResult(result);
    } catch (error) {
      const fallbackResult: RunResult = {
        success: false,
        totalTests: 0,
        passedTests: 0,
        results: [],
        logs: [
          error instanceof Error ? error.message : "Code execution failed",
        ],
        totalTimeMs: 0,
      };
      setRunResult(fallbackResult);
      realtime.broadcastRunResult(fallbackResult);
    } finally {
      setIsRunning(false);
    }
  }, [
    yText,
    code,
    taskKey,
    currentTaskId,
    language,
    setIsRunning,
    setRunResult,
    realtime,
  ]);

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
          onRunCode={handleRunCode}
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
                      awareness={yAwareness ?? undefined}
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
