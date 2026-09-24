import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { baseFetch } from "@/shared/api";
import { paths } from "@/shared/config";
import {
  isNeedEmailResponse,
  type TelegramAuthData,
  type TelegramAuthResponse,
} from "./types";

const TELEGRAM_AUTH_ENDPOINT = "/api/v1/auth/telegram";

/**
 * Ключ sessionStorage, под которым сохраняется onboardingToken.
 * Его читает страница завершения регистрации `/register/complete-telegram`.
 */
export const TELEGRAM_ONBOARDING_TOKEN_KEY = "telegramOnboardingToken";

/**
 * Отправляет данные от Telegram Login Widget на бэкенд.
 * Объект передаётся без изменений: бэкенд проверяет подпись `hash`.
 *
 * TODO: заменить на сгенерированный orval-хук, когда эндпоинт
 * `POST /api/v1/auth/telegram` появится в API.
 */
export function telegramAuth(
  data: TelegramAuthData,
): Promise<TelegramAuthResponse> {
  return baseFetch<TelegramAuthResponse>(TELEGRAM_AUTH_ENDPOINT, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * Мутация авторизации через Telegram:
 * - существующий пользователь: сохраняем сессию и переходим в `/dashboard`;
 * - новый пользователь (`NEED_EMAIL`): сохраняем onboardingToken
 *   и переходим на шаг ввода email.
 */
export function useTelegramAuth() {
  const router = useRouter();
  const { startSession } = useSession();

  return useMutation({
    mutationFn: telegramAuth,
    onSuccess: (response) => {
      if (isNeedEmailResponse(response)) {
        sessionStorage.setItem(
          TELEGRAM_ONBOARDING_TOKEN_KEY,
          response.onboardingToken,
        );
        router.push(paths.completeTelegram);
        return;
      }

      startSession(response.accessToken);
      router.replace(paths.dashboard);
    },
  });
}
