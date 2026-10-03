import { useAuthControllerTelegramComplete } from "@packages/api";
import { useRouter } from "next/navigation";
import { useSession } from "@/entities/session";
import { paths } from "@/shared/config";
import { TELEGRAM_ONBOARDING_TOKEN_KEY } from "./useTelegramAuth";

/**
 * Мутация завершения регистрации через Telegram (шаг ввода email).
 *
 * После успеха удаляет onboardingToken из sessionStorage,
 * сохраняет сессию и переходит в `/dashboard`.
 */
export function useCompleteTelegram() {
  const router = useRouter();
  const { startSession } = useSession();

  return useAuthControllerTelegramComplete({
    mutation: {
      onSuccess: (response) => {
        sessionStorage.removeItem(TELEGRAM_ONBOARDING_TOKEN_KEY);
        startSession(response.accessToken);
        router.replace(paths.dashboard);
      },
    },
  });
}
