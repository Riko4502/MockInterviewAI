"use client";

import { Button, Typography } from "@packages/ui";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { TELEGRAM_ONBOARDING_TOKEN_KEY } from "../model/useTelegramAuth";
import { CompleteTelegramForm } from "./CompleteTelegramForm";

/**
 * Читает onboardingToken из sessionStorage на клиенте и показывает
 * форму ввода email или сообщение, если токена нет.
 */
export function CompleteTelegramPageClient() {
  const { t } = useTranslation("auth");
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(sessionStorage.getItem(TELEGRAM_ONBOARDING_TOKEN_KEY));
    setReady(true);
  }, []);

  if (!ready) {
    // Ждём гидратации: sessionStorage доступен только в браузере.
    return null;
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <Typography.Large>
          {t("completeTelegram.missingToken.title")}
        </Typography.Large>
        <Typography.Muted>
          {t("completeTelegram.missingToken.description")}
        </Typography.Muted>
        <Button asChild size="lg" className="w-full">
          <Link href={paths.register}>
            {t("completeTelegram.missingToken.cta")}
          </Link>
        </Button>
      </div>
    );
  }

  return <CompleteTelegramForm onboardingToken={token} />;
}
