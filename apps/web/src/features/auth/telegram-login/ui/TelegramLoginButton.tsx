"use client";

import { TelegramIcon } from "@packages/icons";
import { Button, Dialog, Spin, Typography } from "@packages/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HttpError } from "@/shared/api";
import "@/shared/lib/i18n";
import { getErrorMessage } from "../../lib/getErrorMessage";
import { useTelegramAuth } from "../model/useTelegramAuth";

const TELEGRAM_WIDGET_SRC = "https://telegram.org/js/telegram-widget.js";

type ScriptStatus = "loading" | "ready" | "error";

/**
 * Кнопка входа через Telegram.
 *
 * Оформлена в едином стиле с кнопкой GitHub (variant="outline", size="lg", w-full).
 * По клику открывает модальный диалог с официальным виджетом Telegram Login Widget
 * для безопасной авторизации без хаков с невидимыми оверлеями.
 * Не рендерится, если не задан NEXT_PUBLIC_TELEGRAM_BOT_USERNAME.
 */
export function TelegramLoginButton() {
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const { t } = useTranslation(["auth", "common"]);
  const [isOpen, setIsOpen] = useState(false);
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(
    null,
  );
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus>("loading");
  const { mutate, isPending, isError, error } = useTelegramAuth();

  useEffect(() => {
    if (!isOpen || !botUsername || !containerNode) return;

    setScriptStatus("loading");

    window.onTelegramAuth = (user) => {
      mutate(
        { data: user },
        {
          onSuccess: () => {
            setIsOpen(false);
          },
        },
      );
    };

    const script = document.createElement("script");
    script.src = TELEGRAM_WIDGET_SRC;
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = "large";
    script.dataset.onauth = "onTelegramAuth(user)";
    script.onload = () => setScriptStatus("ready");
    script.onerror = () => setScriptStatus("error");

    containerNode.appendChild(script);

    return () => {
      containerNode.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [isOpen, botUsername, containerNode, mutate]);

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

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => setIsOpen(true)}
      >
        <TelegramIcon />
        {t("oauth.telegram.button")}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={(open) => !isPending && setIsOpen(open)}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t("oauth.telegram.dialogTitle")}</Dialog.Title>
            <Dialog.Description>
              {t("oauth.telegram.dialogDesc")}
            </Dialog.Description>
          </Dialog.Header>

          <div className="my-6 flex flex-col items-center justify-center gap-3">
            <div
              ref={setContainerNode}
              className="flex min-h-10 justify-center"
            />

            {scriptStatus === "loading" && (
              <Typography.P className="text-sm text-muted-foreground">
                {t("oauth.telegram.loading")}
              </Typography.P>
            )}

            {isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spin size="sm" variant="current" aria-hidden="true" />
                <Typography.P>{t("oauth.telegram.submitting")}</Typography.P>
              </div>
            )}

            {errorMessage && (
              <Typography.P className="text-sm text-destructive">
                {errorMessage}
              </Typography.P>
            )}
          </div>

          <Dialog.Footer>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsOpen(false)}
            >
              {t("actions.cancel", { ns: "common" })}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
