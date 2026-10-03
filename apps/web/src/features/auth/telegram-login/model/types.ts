import type { TelegramAuthDto } from "@packages/api";

/**
 * Глобальный callback для Telegram Login Widget.
 * Скрипт telegram-widget.js вызывает его по имени из атрибута `data-onauth`.
 */
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramAuthDto) => void;
  }
}
