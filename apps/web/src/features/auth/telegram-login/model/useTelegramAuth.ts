import { useAuthControllerTelegramAuth } from "@packages/api";
import { useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";

/**
 * Ключ sessionStorage, под которым сохраняется onboardingToken.
 * Его читает страница завершения регистрации `/register/complete-telegram`.
 */
export const TELEGRAM_ONBOARDING_TOKEN_KEY = "telegramOnboardingToken";

/**
 * Мутация авторизации через Telegram:
 * - AUTHENTICATED: сохраняем сессию и переходим в `/dashboard`;
 * - NEED_EMAIL: сохраняем onboardingToken и переходим на шаг ввода email.
 */
export function useTelegramAuth() {
  const router = useRouter();
  const { startSession } = useSession();

  return useAuthControllerTelegramAuth({
    mutation: {
      onSuccess: (response) => {
        if (response.status === "NEED_EMAIL") {
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
    },
  });
}
