"use client";

import { UsersIcon } from "@packages/icons";
import { Badge } from "@packages/ui";
import { cn } from "@packages/utils";
import { useState } from "react";
import type {
  MeetingParticipantState,
  MeetingReactionItem,
} from "@/entities/meeting-participant";
import {
  CallControlsBar,
  type ChatMessageData,
  DeviceSettingsDialog,
  MeetingChatSidebar,
  ScreenShareConflictDialog,
} from "@/features/meeting-call";
import { ScreenShareStage } from "./ScreenShareStage";
import { VideoGrid } from "./VideoGrid";

/** Пропсы главного рабочего пространства звонка */
export interface MeetingRoomWorkspaceProps {
  /** Заголовок встречи (отображается в верхней шапке) */
  roomTitle?: string;
  /** Защищена ли комната паролем */
  isPrivate?: boolean;
  /** Является ли локальный участник хостом встречи */
  isHost?: boolean;
  /** Список всех участников комнаты */
  participants: MeetingParticipantState[];
  /** Локальный участник */
  localParticipant: MeetingParticipantState | null;
  /** Участник, который сейчас демонстрирует экран (если есть) */
  screenShareParticipant: MeetingParticipantState | null;
  /** Сообщения текстового чата DataChannel */
  messages: ChatMessageData[];
  /** Всплывающие эмодзи-реакции */
  reactions: MeetingReactionItem[];
  /** Количество непрочитанных сообщений чата */
  unreadMessagesCount?: number;
  /** Включен ли локальный микрофон */
  isMicrophoneEnabled: boolean;
  /** Включена ли локальная вебкамера */
  isCameraEnabled: boolean;
  /** Активна ли демонстрация экрана у локального участника */
  isScreenSharing: boolean;
  /** Поднята ли рука у локального участника */
  isHandRaised: boolean;

  /** Callback переключения микрофона */
  onToggleMicrophone: () => Promise<void> | void;
  /** Callback переключения камеры */
  onToggleCamera: () => Promise<void> | void;
  /** Callback переключения демонстрации экрана */
  onToggleScreenShare: () => Promise<void> | void;
  /** Callback поднятия/опускания руки */
  onToggleHand: () => Promise<boolean> | undefined;
  /** Callback отправки эмодзи-реакции */
  onSendReaction: (emoji: string) => Promise<boolean> | undefined;
  /** Callback отправки сообщения в чат */
  onSendMessage: (text: string) => Promise<boolean> | undefined;
  /** Callback сброса счетчика непрочитанных при открытии чата */
  onResetUnreadCount?: () => void;
  /** Callback выхода из комнаты */
  onLeaveCall: () => Promise<void> | void;
  /** Callback завершения встречи для всех участников (для хоста) */
  onEndCallForAll?: () => Promise<void> | void;
  /** Callback смены микрофона */
  onSwitchAudioInput?: (deviceId: string) => Promise<void> | void;
  /** Callback смены камеры */
  onSwitchVideoInput?: (deviceId: string) => Promise<void> | void;
  /** Callback смены динамиков */
  onSwitchAudioOutput?: (deviceId: string) => Promise<void> | void;
  /** Текущий выбранный микрофон */
  currentAudioInputId?: string;
  /** Текущая выбранная камера */
  currentVideoInputId?: string;
  /** Текущие выбранные динамики */
  currentAudioOutputId?: string;
  /** Дополнительные CSS классы */
  className?: string;
}

/**
 * Главный экран активной видеовстречи (MeetingRoomWorkspace).
 *
 * Собирает воедино:
 * 1. Верхнюю информационную шапку со статусом шифрования и числом участников.
 * 2. Адаптивную область отображения (авто-переключение между VideoGrid и ScreenShareStage).
 * 3. Нижнюю плавающую панель контролов CallControlsBar.
 * 4. Правый сайдбар чата MeetingChatSidebar.
 * 5. Диалоги настроек устройств и разрешения конфликта демонстрации экрана.
 */
export function MeetingRoomWorkspace({
  roomTitle = "System Design Mock",
  isPrivate = false,
  isHost = false,
  participants,
  localParticipant,
  screenShareParticipant,
  messages,
  reactions,
  unreadMessagesCount = 0,
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenSharing,
  isHandRaised,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHand,
  onSendReaction,
  onSendMessage,
  onResetUnreadCount,
  onLeaveCall,
  onEndCallForAll,
  onSwitchAudioInput,
  onSwitchVideoInput,
  onSwitchAudioOutput,
  currentAudioInputId,
  currentVideoInputId,
  currentAudioOutputId,
  className,
}: MeetingRoomWorkspaceProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScreenConflictOpen, setIsScreenConflictOpen] = useState(false);

  // Переключение сайдбара чата со сбросом непрочитанных сообщений
  const handleToggleChat = () => {
    const nextState = !isChatOpen;
    setIsChatOpen(nextState);
    if (nextState) {
      onResetUnreadCount?.();
    }
  };

  // Проверка на конфликт перед стартом демонстрации экрана
  const handleInitiateScreenShare = () => {
    if (isScreenSharing) {
      onToggleScreenShare();
      return;
    }

    if (screenShareParticipant && !screenShareParticipant.isLocal) {
      setIsScreenConflictOpen(true);
      return;
    }

    onToggleScreenShare();
  };

  const handleConfirmScreenConflict = () => {
    setIsScreenConflictOpen(false);
    onToggleScreenShare();
  };

  return (
    <div
      data-slot="meeting-room-workspace"
      className={cn(
        "relative flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground select-none",
        className,
      )}
    >
      {/* Верхняя информационная панель встречи */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 bg-card/60 px-4 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold tracking-tight text-foreground truncate max-w-[200px] sm:max-w-xs">
            {roomTitle}
          </h1>
          <Badge
            variant="secondary"
            className="flex items-center gap-1 text-[11px] font-normal"
          >
            <UsersIcon size="xs" />
            <span>{participants.length}</span>
          </Badge>
          {isPrivate && (
            <Badge
              variant="outline"
              className="text-[10px] text-muted-foreground border-border/60"
            >
              🔒 Защищено
            </Badge>
          )}
        </div>
      </header>

      {/* Центральное рабочее пространство созвона + Сайдбар чата */}
      <main className="relative flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2 pb-20">
          {screenShareParticipant ? (
            <ScreenShareStage
              screenShareParticipant={screenShareParticipant}
              allParticipants={participants}
              reactions={reactions}
              onStopScreenShare={
                screenShareParticipant.isLocal ? onToggleScreenShare : undefined
              }
              className="size-full"
            />
          ) : (
            <VideoGrid
              participants={participants}
              reactions={reactions}
              className="size-full"
            />
          )}
        </div>

        {/* Выдвижной сайдбар чата справа */}
        <MeetingChatSidebar
          open={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={messages}
          currentUserId={localParticipant?.identity}
          onSendMessage={onSendMessage}
        />
      </main>

      {/* Нижняя плавающая панель управления звонком */}
      <div className="absolute inset-x-0 bottom-4 z-40 flex justify-center pointer-events-none px-4">
        <div className="pointer-events-auto">
          <CallControlsBar
            isMicrophoneEnabled={isMicrophoneEnabled}
            isCameraEnabled={isCameraEnabled}
            isScreenSharing={isScreenSharing}
            isHandRaised={isHandRaised}
            isChatOpen={isChatOpen}
            unreadMessagesCount={unreadMessagesCount}
            isHost={isHost}
            onToggleMicrophone={onToggleMicrophone}
            onToggleCamera={onToggleCamera}
            onToggleScreenShare={handleInitiateScreenShare}
            onToggleHand={onToggleHand}
            onSendReaction={onSendReaction}
            onToggleChat={handleToggleChat}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onLeaveCall={onLeaveCall}
            onEndCallForAll={onEndCallForAll}
          />
        </div>
      </div>

      {/* Диалог настроек устройств */}
      <DeviceSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        currentAudioInputId={currentAudioInputId}
        currentVideoInputId={currentVideoInputId}
        currentAudioOutputId={currentAudioOutputId}
        onAudioInputSelect={onSwitchAudioInput}
        onVideoInputSelect={onSwitchVideoInput}
        onAudioOutputSelect={onSwitchAudioOutput}
      />

      {/* Диалог подтверждения перехвата демонстрации экрана */}
      <ScreenShareConflictDialog
        open={isScreenConflictOpen}
        activeSharerName={screenShareParticipant?.name || "Участник"}
        onConfirm={handleConfirmScreenConflict}
        onCancel={() => setIsScreenConflictOpen(false)}
      />
    </div>
  );
}
