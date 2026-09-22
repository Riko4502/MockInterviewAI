import { baseFetch } from "@/shared/api";
import type { TelegramAuthData, TelegramAuthResponse } from "./types";

const TELEGRAM_AUTH_ENDPOINT = "/api/v1/auth/telegram";

/**
 * Отправляет данные от Telegram Login Widget на бэкенд.
 *
 * Бэкенд проверяет подпись и возвращает либо `accessToken`
 * (существующий пользователь), либо `onboardingToken`
 * (новый пользователь, нужен шаг ввода email).
 * Refresh token приходит в HttpOnly cookie.
 *
 * !!!TODO: заменить на сгенерированный orval-хук, когда эндпоинт
 * появится в API!!!
 */
export function telegramAuth(
  data: TelegramAuthData,
): Promise<TelegramAuthResponse> {
  return baseFetch<TelegramAuthResponse>(TELEGRAM_AUTH_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
