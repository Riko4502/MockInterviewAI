"use client";

import {
  CameraIcon,
  LogOutIcon,
  MessageSquareIcon,
  MicIcon,
  ScreenIcon,
  SettingsIcon,
} from "@packages/icons";
import { Button, Popover, Tooltip } from "@packages/ui";
import { cn } from "@packages/utils";
import { useState } from "react";

/** Пропсы нижней панели управления звонком */
export interface CallControlsBarProps {
  /** Включен ли микрофон */
  isMicrophoneEnabled: boolean;
  /** Включена ли камера */
  isCameraEnabled: boolean;
  /** Активна ли демонстрация экрана */
  isScreenSharing: boolean;
  /** Поднята ли рука */
  isHandRaised: boolean;
  /** Открыта ли панель чата */
  isChatOpen: boolean;
  /** Количество непрочитанных сообщений чата */
  unreadMessagesCount?: number;
  /** Является ли текущий пользователь хостом встречи */
  isHost?: boolean;
  /** Переключение микрофона */
  onToggleMicrophone: () => void;
  /** Переключение камеры */
  onToggleCamera: () => void;
  /** Переключение демонстрации экрана */
  onToggleScreenShare: () => void;
  /** Переключение поднятия руки */
  onToggleHand: () => void;
  /** Отправка эмодзи-реакции */
  onSendReaction: (emoji: string) => void;
  /** Открытие/закрытие чата */
  onToggleChat: () => void;
  /** Открытие настроек устройств */
  onOpenSettings: () => void;
  /** Выход из звонка */
  onLeaveCall: () => void;
  /** Завершение звонка для всех участников (только хост) */
  onEndCallForAll?: () => void;
  /** Дополнительные CSS классы панели */
  className?: string;
}

const EMOJI_REACTIONS = ["👍", "❤️", "👏", "🔥", "🎉"] as const;

/**
 * Нижняя панель управления звонком (CallControlsBar).
 *
 * Содержит кнопки быстрого управления аудио, видео, шарингом экрана,
 * поднятием руки, реакциями, чатом, настройками и выходом.
 */
export function CallControlsBar({
  isMicrophoneEnabled,
  isCameraEnabled,
  isScreenSharing,
  isHandRaised,
  isChatOpen,
  unreadMessagesCount = 0,
  isHost = false,
  onToggleMicrophone,
  onToggleCamera,
  onToggleScreenShare,
  onToggleHand,
  onSendReaction,
  onToggleChat,
  onOpenSettings,
  onLeaveCall,
  onEndCallForAll,
  className,
}: CallControlsBarProps) {
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [isLeaveMenuOpen, setIsLeaveMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Панель управления звонком"
      data-slot="call-controls-bar"
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <Tooltip.Provider delayDuration={150}>
        {/* Микрофон */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant={isMicrophoneEnabled ? "secondary" : "destructive"}
              size="icon"
              onClick={onToggleMicrophone}
              aria-label={
                isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"
              }
              className="size-10 rounded-xl"
            >
              <MicIcon size="md" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">
            {isMicrophoneEnabled ? "Выключить микрофон" : "Включить микрофон"}
          </Tooltip.Content>
        </Tooltip>

        {/* Камера */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant={isCameraEnabled ? "secondary" : "destructive"}
              size="icon"
              onClick={onToggleCamera}
              aria-label={
                isCameraEnabled ? "Выключить камеру" : "Включить камеру"
              }
              className="size-10 rounded-xl"
            >
              <CameraIcon size="md" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">
            {isCameraEnabled ? "Выключить камеру" : "Включить камеру"}
          </Tooltip.Content>
        </Tooltip>

        {/* Демонстрация экрана */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="icon"
              onClick={onToggleScreenShare}
              aria-label={
                isScreenSharing
                  ? "Остановить показ экрана"
                  : "Поделиться экраном"
              }
              className={cn(
                "size-10 rounded-xl",
                isScreenSharing && "bg-primary text-primary-foreground",
              )}
            >
              <ScreenIcon size="md" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">
            {isScreenSharing ? "Остановить показ экрана" : "Поделиться экраном"}
          </Tooltip.Content>
        </Tooltip>

        {/* Поднять руку */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant={isHandRaised ? "default" : "secondary"}
              size="icon"
              onClick={onToggleHand}
              aria-label={isHandRaised ? "Опустить руку" : "Поднять руку"}
              className={cn(
                "size-10 rounded-xl text-base",
                isHandRaised && "bg-amber-500 hover:bg-amber-600 text-white",
              )}
            >
              <span>✋</span>
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">
            {isHandRaised ? "Опустить руку" : "Поднять руку"}
          </Tooltip.Content>
        </Tooltip>

        {/* Эмодзи-реакции */}
        <Popover open={isReactionOpen} onOpenChange={setIsReactionOpen}>
          <Popover.Trigger asChild>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Эмодзи-реакции"
              className="size-10 rounded-xl text-base"
            >
              <span>😊</span>
            </Button>
          </Popover.Trigger>
          <Popover.Content
            side="top"
            align="center"
            className="flex gap-1.5 p-1.5 rounded-2xl"
          >
            {EMOJI_REACTIONS.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => {
                  onSendReaction(emoji);
                  setIsReactionOpen(false);
                }}
                className="flex size-9 items-center justify-center rounded-xl text-xl hover:bg-accent transition-transform hover:scale-125"
                title={`Реакция ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </Popover.Content>
        </Popover>

        {/* Чат */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant={isChatOpen ? "default" : "secondary"}
              size="icon"
              onClick={onToggleChat}
              aria-label="Чат встречи"
              className="relative size-10 rounded-xl"
            >
              <MessageSquareIcon size="md" />
              {unreadMessagesCount > 0 && !isChatOpen && (
                <output
                  aria-label={`Непрочитанных сообщений: ${unreadMessagesCount}`}
                  className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-md animate-pulse"
                >
                  {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
                </output>
              )}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">Чат встречи</Tooltip.Content>
        </Tooltip>

        {/* Настройки устройств */}
        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button
              variant="secondary"
              size="icon"
              onClick={onOpenSettings}
              aria-label="Настройки звука и видео"
              className="size-10 rounded-xl"
            >
              <SettingsIcon size="md" />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content side="top">Настройки</Tooltip.Content>
        </Tooltip>

        {/* Кнопка выхода / завершения */}
        {isHost && onEndCallForAll ? (
          <Popover open={isLeaveMenuOpen} onOpenChange={setIsLeaveMenuOpen}>
            <Popover.Trigger asChild>
              <Button
                variant="destructive"
                size="icon"
                aria-label="Выйти или завершить звонок"
                className="size-10 rounded-xl ml-2"
              >
                <LogOutIcon size="md" />
              </Button>
            </Popover.Trigger>
            <Popover.Content
              side="top"
              align="end"
              className="w-56 p-2 space-y-1"
            >
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs font-normal"
                onClick={() => {
                  setIsLeaveMenuOpen(false);
                  onLeaveCall();
                }}
              >
                Покинуть встречу
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  setIsLeaveMenuOpen(false);
                  onEndCallForAll();
                }}
              >
                Завершить встречу для всех
              </Button>
            </Popover.Content>
          </Popover>
        ) : (
          <Tooltip>
            <Tooltip.Trigger asChild>
              <Button
                variant="destructive"
                size="icon"
                onClick={onLeaveCall}
                aria-label="Покинуть встречу"
                className="size-10 rounded-xl ml-2"
              >
                <LogOutIcon size="md" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content side="top">Покинуть встречу</Tooltip.Content>
          </Tooltip>
        )}
      </Tooltip.Provider>
    </nav>
  );
}
