import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import { telegramAuth } from "./telegram-auth";
import { isNeedEmailResponse } from "./types";

/**
 * Ключ sessionStorage, под которым сохраняется onboardingToken.
 * Его читает страница завершения регистрации `/register/complete-telegram`.
 */
export const TELEGRAM_ONBOARDING_TOKEN_KEY = "telegramOnboardingToken";

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
