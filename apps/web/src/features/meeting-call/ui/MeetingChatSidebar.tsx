"use client";

import { CloseIcon, CopyIcon } from "@packages/icons";
import { Button, Textarea } from "@packages/ui";
import { cn } from "@packages/utils";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChatMessageData } from "../model/types";

/** Пропсы сайдбара текстового чата */
export interface MeetingChatSidebarProps {
  /** Открыта ли панель чата */
  open: boolean;
  /** Callback закрытия панели */
  onClose: () => void;
  /** Список сообщений звонка */
  messages: ChatMessageData[];
  /** Идентификатор локального участника (для подсветки своих сообщений) */
  currentUserId?: string;
  /** Callback отправки нового сообщения */
  onSendMessage: (text: string) => void;
  /** Дополнительные CSS классы контейнера */
  className?: string;
}

/** Рендерит текст сообщения с кликабельными ссылками */
function renderMessageText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          // biome-ignore lint/suspicious/noArrayIndexKey: parts array from static split
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80 break-all transition-colors"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/** Форматирует временную метку сообщения в формат ЧЧ:ММ */
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/**
 * Выдвижная панель текстового чата созвона (LiveKit DataChannel).
 * Поддерживает автоскролл, кликабельные ссылки, копирование текста и отправку по Enter.
 */
export function MeetingChatSidebar({
  open,
  onClose,
  messages,
  currentUserId,
  onSendMessage,
  className,
}: MeetingChatSidebarProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Автоскролл к последнему сообщению при поступлении новых сообщений
  useEffect(() => {
    if (open && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInputText("");
  }, [inputText, onSendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  if (!open) return null;

  return (
    <aside
      data-slot="meeting-chat-sidebar"
      aria-label="Чат встречи"
      className={cn(
        "flex h-full w-80 md:w-96 flex-col border-l border-border bg-card/95 backdrop-blur-md shadow-xl transition-all duration-300 z-30",
        className,
      )}
    >
      {/* Шапка чата */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Чат встречи
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Закрыть чат"
          className="text-muted-foreground hover:text-foreground"
        >
          <CloseIcon size="sm" />
        </Button>
      </div>

      {/* Список сообщений */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <p>В этом звонке сообщений пока нет.</p>
            <p className="mt-1">Напишите что-нибудь первое!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = currentUserId && msg.senderId === currentUserId;

            return (
              <div
                key={msg.id}
                className={cn(
                  "group relative rounded-xl p-3 text-xs transition-colors",
                  isMe
                    ? "ml-4 bg-primary/10 border border-primary/20 text-foreground"
                    : "mr-4 bg-muted/60 border border-border/60 text-foreground",
                )}
              >
                {/* Автор и время */}
                <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/90">
                    {msg.senderName} {isMe && "(Вы)"}
                  </span>
                  <span className="text-[10px]">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>

                {/* Текст сообщения */}
                <p className="whitespace-pre-wrap leading-relaxed select-text">
                  {renderMessageText(msg.text)}
                </p>

                {/* Кнопка копирования при наведении */}
                <button
                  type="button"
                  onClick={() => copyToClipboard(msg.text)}
                  title="Скопировать текст"
                  className="absolute right-2 top-2 hidden rounded-md p-1 bg-background/80 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:block group-hover:opacity-100"
                >
                  <CopyIcon size="xs" />
                </button>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Поле ввода сообщения */}
      <div className="border-t border-border p-3 bg-background/50">
        <div className="relative flex flex-col gap-2">
          <Textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение... (Enter — отправить, Shift+Enter — перенос)"
            rows={2}
            className="resize-none pr-14 text-xs"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!inputText.trim()}
              onClick={handleSend}
              className="h-7 px-3 text-xs"
            >
              Отправить
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
