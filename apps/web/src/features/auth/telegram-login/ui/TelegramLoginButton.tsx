"use client";

import { Typography } from "@packages/ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HttpError } from "@/shared/api";
import "@/shared/lib/i18n";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { useTelegramAuth } from "../model/useTelegramAuth";

const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js";
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

type ScriptStatus = "loading" | "ready" | "error";

/**
 * Кнопка входа через Telegram Login Widget.
 *
 * Асинхронно загружает telegram-widget.js, регистрирует глобальный
 * callback `onTelegramAuth` и отправляет данные пользователя на бэкенд.
 * Не рендерится, если не задан NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 */
export function TelegramLoginButton() {
  const { t } = useTranslation("auth");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("loading");
  const { mutate, isPending, isError, error } = useTelegramAuth();

  useEffect(() => {
    const container = containerRef.current;
    if (!BOT_USERNAME || !container) return;

    window.onTelegramAuth = (user) => mutate({ data: user });

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.dataset.telegramLogin = BOT_USERNAME;
    script.dataset.size = "large";
    script.dataset.onauth = "onTelegramAuth(user)";
    script.onload = () => setScriptStatus("ready");
    script.onerror = () => setScriptStatus("error");

    container.appendChild(script);

    return () => {
      container.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [mutate]);

  if (!BOT_USERNAME) return null;

  let errorMessage: string | null = null;
  if (scriptStatus === "error") {
    errorMessage = t("oauth.telegram.scriptError");
  } else if (isError) {
    errorMessage =
      error instanceof HttpError
        ? getErrorMessage(error, t("oauth.telegram.authError"))
        : t("oauth.telegram.networkError");
  }

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div ref={containerRef} className="flex min-h-10 justify-center" />

      {scriptStatus === "loading" && (
        <Typography.P className="text-sm text-muted-foreground">
          {t("oauth.telegram.loading")}
        </Typography.P>
      )}

      {isPending && (
        <Typography.P className="text-sm text-muted-foreground">
          {t("oauth.telegram.submitting")}
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
