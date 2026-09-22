import type { AccessTokenResponseDto } from "@packages/api";

/**
 * Данные пользователя, которые Telegram Login Widget передаёт в callback
 * после подтверждения входа.
 * 
 * Имена полей оставлены в snake_case, как их присылает Telegram
 
 */
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/** Ответ для нового пользователя: нужен шаг ввода email */
export interface TelegramNeedEmailResponse {
  status: "NEED_EMAIL";
  onboardingToken: string;
}

/**
 * Ответ `POST /api/v1/auth/telegram` (см. docs/tasks/auth-telegram.md):
 * - существующий пользователь получает `accessToken`;
 * - новый пользователь получает `onboardingToken` для шага ввода email.
 *
 * !!! заменить на типы из orval, когда эндпоинт появится в API!!!
 */
export type TelegramAuthResponse =
  | AccessTokenResponseDto
  | TelegramNeedEmailResponse;

/** Проверяет, что бэкенд запросил шаг ввода email. */
export function isNeedEmailResponse(
  response: TelegramAuthResponse,
): response is TelegramNeedEmailResponse {
  return "status" in response && response.status === "NEED_EMAIL";
}

declare global {
  interface Window {
    /** Глобальный callback, который вызывает скрипт telegram-widget.js. */
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}
