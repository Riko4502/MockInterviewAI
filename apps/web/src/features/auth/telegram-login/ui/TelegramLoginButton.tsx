"use client";

import { TelegramIcon } from "@packages/icons";
import { Button, Spin, Typography } from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HttpError } from "@/shared/api";
import "@/shared/lib/i18n";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { useTelegramAuth } from "../model/useTelegramAuth";

const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js";

type ScriptStatus = "loading" | "ready" | "error";

/**
 * Кнопка входа через Telegram Login Widget.
 *
 * Асинхронно загружает telegram-widget.js, регистрирует глобальный
 * callback `onTelegramAuth` и отправляет данные пользователя на бэкенд.
 * Оформлена в едином стиле с кнопкой GitHub (variant="outline", size="lg", w-full).
 * Не рендерится, если не задан NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 */
export function TelegramLoginButton() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const { t } = useTranslation("auth");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("loading");
  const { mutate, isPending, isError, error } = useTelegramAuth();

  useEffect(() => {
    const container = containerRef.current;
    if (!botUsername || !container) return;

    window.onTelegramAuth = (user) => mutate({ data: user });

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.onauth = "onTelegramAuth(user)";
    script.onload = () => setScriptStatus("ready");
    script.onerror = () => setScriptStatus("error");

    container.appendChild(script);

    return () => {
      container.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botUsername, mutate]);

  if (!botUsername) return null;

  let errorMessage: string | null = null;
  if (scriptStatus === "error") {
    errorMessage = t("oauth.telegram.scriptError");
  } else if (isError) {
    errorMessage =
      error instanceof HttpError
        ? getErrorMessage(error, t("oauth.telegram.authError"))
        : t("oauth.telegram.networkError");
  }

  const isLoading = scriptStatus === "loading";
  const isBusy = isLoading || isPending;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="relative w-full">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isBusy || scriptStatus === "error"}
        >
          {isPending ? (
            <>
              <Spin size="sm" />
              {t("oauth.telegram.submitting")}
            </>
          ) : (
            <>
              <TelegramIcon />
              {t("oauth.telegram.button")}
            </>
          )}
        </Button>

        <div
          ref={containerRef}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 z-10 flex items-center justify-center overflow-hidden opacity-0 cursor-pointer",
            isBusy || scriptStatus === "error"
              ? "pointer-events-none hidden"
              : "",
            "[&>iframe]:h-full [&>iframe]:w-full [&>iframe]:min-w-full [&>iframe]:cursor-pointer [&>iframe]:scale-[3]",
          )}
        />
      </div>

      {isLoading && (
        <Typography.P className="text-sm text-muted-foreground">
          {t("oauth.telegram.loading")}
        </Typography.P>
      )}

      {errorMessage && (
        <Typography.P className="text-sm text-destructive">
          {errorMessage}
        </Typography.P>
      )}
    </div>
  );
}
