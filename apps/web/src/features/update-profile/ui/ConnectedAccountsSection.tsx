"use client";

import type { UserProfileDto } from "@packages/api";
import {
  getProfileControllerGetMyProfileQueryKey,
  useAuthControllerOauthProviders,
  useProfileControllerUnlinkGithub,
  useTelegramControllerCreateLinkToken,
} from "@packages/api";
import { CheckIcon, CopyIcon, GithubIcon, TelegramIcon } from "@packages/icons";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Spin,
  Typography,
  useToast,
} from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { getApiUrl } from "@/shared/api/config/endpoints";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";
import { getUnlinkErrorKey } from "../model/unlink-error";
import { useTelegramUnlinkFlow } from "../model/use-telegram-unlink-flow";

/**
 * Пауза перед уходом на логин после успешной отвязки (F4).
 *
 * Отвязка отзывает все сессии, включая текущую, поэтому возвращаться на живой
 * профиль некуда — даём время прочитать тост успеха.
 */
export const UNLINK_REDIRECT_DELAY_MS = 1500;

/** Минимальная длина одноразового кода отвязки Telegram (D5). */
const TELEGRAM_UNLINK_CODE_LENGTH = 6;

type ConnectedAccountsSectionProps = {
  user: UserProfileDto;
};

export function ConnectedAccountsSection({
  user,
}: ConnectedAccountsSectionProps) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession({ optional: true });
  const toast = useToast();
  const [isTgDialogOpen, setIsTgDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isTgUnlinkConfirmOpen, setIsTgUnlinkConfirmOpen] = useState(false);
  const [isTgCodeOpen, setIsTgCodeOpen] = useState(false);
  const [isGithubUnlinkOpen, setIsGithubUnlinkOpen] = useState(false);
  const [code, setCode] = useState("");

  const createLinkTokenMutation = useTelegramControllerCreateLinkToken();
  const unlinkGithubMutation = useProfileControllerUnlinkGithub();
  const telegramUnlinkFlow = useTelegramUnlinkFlow();

  const { data: oauthProviders } = useAuthControllerOauthProviders({
    query: { retry: false },
  });

  const isTelegramLinked = Boolean(
    user.telegramLinkVerified !== undefined
      ? user.telegramLinkVerified && user.telegramUsername
      : user.telegramUsername,
  );
  const isGithubLinked = Boolean(
    user.githubLinkVerified !== undefined
      ? user.githubLinkVerified && user.gitUrl
      : user.gitUrl,
  );
  const isPending = createLinkTokenMutation.isPending;

  useEffect(() => {
    if (!isTgDialogOpen) {
      setLinkUrl(null);
      setTokenError(null);
      return;
    }

    createLinkTokenMutation.mutate(undefined, {
      onSuccess: (res) => {
        setLinkUrl(res.linkUrl);
      },
      onError: () => {
        setTokenError(t("profile.telegramLinkError"));
      },
    });
  }, [isTgDialogOpen, t, createLinkTokenMutation.mutate]);

  useEffect(() => {
    if (!isTgDialogOpen || isTelegramLinked) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: getProfileControllerGetMyProfileQueryKey(),
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [isTgDialogOpen, isTelegramLinked, queryClient]);

  useEffect(() => {
    if (isTgDialogOpen && isTelegramLinked) {
      toast.push({
        status: "success",
        title: t("profile.telegramLinkSuccess"),
      });
      const timer = setTimeout(() => {
        setIsTgDialogOpen(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isTgDialogOpen, isTelegramLinked, t, toast]);

  const handleCopyLink = () => {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setIsCopied(true);
    toast.push({
      status: "success",
      title: t("profile.telegramLinkCopied"),
    });
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleRetryToken = () => {
    setTokenError(null);
    createLinkTokenMutation.mutate(undefined, {
      onSuccess: (res) => {
        setLinkUrl(res.linkUrl);
      },
      onError: () => {
        setTokenError(t("profile.telegramLinkError"));
      },
    });
  };

  /**
   * Общий финал успешной отвязки (F4): тост, инвалидация кэша профиля и уход
   * на логин — сервер отозвал все сессии, включая текущую, возвращаться на
   * живой профиль некуда.
   */
  const handleUnlinkSuccess = (title: string) => {
    toast.push({ status: "success", title });
    void queryClient.invalidateQueries({
      queryKey: getProfileControllerGetMyProfileQueryKey(),
    });

    setTimeout(() => {
      session?.clearSession();
      queryClient.clear();
      router.replace(paths.login);
    }, UNLINK_REDIRECT_DELAY_MS);
  };

  /** Переход от предупреждения к шагу ввода одноразового кода (F3). */
  const handleTelegramUnlinkConfirm = () => {
    setIsTgUnlinkConfirmOpen(false);
    setCode("");
    setIsTgCodeOpen(true);
    telegramUnlinkFlow.requestCode();
  };

  const handleCodeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (telegramUnlinkFlow.isBusy || telegramUnlinkFlow.isCodeExpired) return;

    telegramUnlinkFlow.submitCode(code, () =>
      handleUnlinkSuccess(t("profile.telegramUnlinkSuccess")),
    );
  };

  const handleGithubUnlinkConfirm = () => {
    unlinkGithubMutation.mutate(undefined, {
      onSuccess: () => {
        setIsGithubUnlinkOpen(false);
        handleUnlinkSuccess(t("profile.githubUnlinkSuccess"));
      },
      // Ошибка — диалог остаётся открытым для повтора.
      onError: (error) => {
        toast.push({
          status: "error",
          title: t(getUnlinkErrorKey(error, "github")),
        });
      },
    });
  };

  const closeTelegramCodeDialog = () => {
    setIsTgCodeOpen(false);
    setCode("");
    telegramUnlinkFlow.reset();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    const githubParam = params.get("github");

    if (errorParam === "github_already_linked") {
      toast.push({
        status: "error",
        title: t("profile.githubAlreadyLinked"),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState(
        null,
        "",
        url.pathname + (url.search ? url.search : ""),
      );
    } else if (errorParam === "github_failed") {
      toast.push({
        status: "error",
        title: t("profile.githubLinkError"),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState(
        null,
        "",
        url.pathname + (url.search ? url.search : ""),
      );
    } else if (githubParam === "success") {
      toast.push({
        status: "success",
        title: t("profile.githubLinkSuccess"),
      });
      queryClient.invalidateQueries({
        queryKey: getProfileControllerGetMyProfileQueryKey(),
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("github");
      window.history.replaceState(
        null,
        "",
        url.pathname + (url.search ? url.search : ""),
      );
    }
  }, [toast, t, queryClient]);

  const githubOAuthHref = `${getApiUrl().replace(/\/+$/, "")}/api/v1/auth/github?action=link`;

  return (
    <>
      <Card>
        <Card.Content className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-foreground">
              {t("profile.connectedAccountsTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("profile.connectedAccountsSubtitle")}
            </p>
          </div>

          <div className="flex flex-col divide-y divide-border rounded-lg border border-border/60">
            {/* Telegram Item */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-500 dark:bg-sky-500/20">
                  <TelegramIcon size="sm" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      Telegram
                    </span>
                    <Badge
                      className="shrink-0"
                      variant={isTelegramLinked ? "statusSuccess" : "waiting"}
                    >
                      {isTelegramLinked
                        ? t("profile.connected")
                        : t("profile.notConnected")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    {isTelegramLinked
                      ? `@${user.telegramUsername?.replace(/^@/, "") || "connected"}`
                      : t("profile.telegramLinkDesc")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isTelegramLinked ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setIsTgUnlinkConfirmOpen(true)}
                  >
                    {t("profile.telegramUnlinkButton")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setIsTgDialogOpen(true)}
                  >
                    <TelegramIcon size="sm" aria-hidden="true" />
                    {t("profile.telegramLinkButton")}
                  </Button>
                )}
              </div>
            </div>

            {/* GitHub Item */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <GithubIcon size="sm" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">
                      GitHub
                    </span>
                    <Badge
                      className="shrink-0"
                      variant={isGithubLinked ? "statusSuccess" : "waiting"}
                    >
                      {isGithubLinked
                        ? t("profile.connected")
                        : t("profile.notConnected")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground break-words">
                    {isGithubLinked ? (
                      <a
                        href={user.gitUrl ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline hover:text-foreground"
                      >
                        {user.gitUrl}
                      </a>
                    ) : (
                      t("profile.githubLinkDesc")
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                {isGithubLinked ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setIsGithubUnlinkOpen(true)}
                  >
                    {t("profile.githubUnlinkButton")}
                  </Button>
                ) : oauthProviders?.github ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={githubOAuthHref}>
                      <GithubIcon size="sm" aria-hidden="true" />
                      {t("profile.githubConnectButton")}
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      {/* Telegram Link Dialog */}
      <Dialog
        open={isTgDialogOpen}
        onOpenChange={(open) => !isPending && setIsTgDialogOpen(open)}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t("profile.telegramLinkDialogTitle")}</Dialog.Title>
            <Dialog.Description>
              {t("profile.telegramLinkDialogDesc")}
            </Dialog.Description>
          </Dialog.Header>

          <div className="my-4 flex flex-col gap-4">
            {isTelegramLinked ? (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckIcon className="size-6" />
                </div>
                <Typography.H4 className="text-foreground">
                  {t("profile.telegramLinkSuccess")}
                </Typography.H4>
              </div>
            ) : createLinkTokenMutation.isPending ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-muted-foreground">
                <Spin size="md" variant="current" aria-hidden="true" />
                <Typography.P>{t("profile.telegramTokenLoading")}</Typography.P>
              </div>
            ) : tokenError ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <Typography.P className="text-destructive">
                  {tokenError}
                </Typography.P>
                <Button variant="outline" size="sm" onClick={handleRetryToken}>
                  {t("errors.retry", "Повторить")}
                </Button>
              </div>
            ) : linkUrl ? (
              <>
                <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground flex flex-col gap-1.5">
                  <p>1. {t("profile.telegramStep1")}</p>
                  <p>2. {t("profile.telegramStep2")}</p>
                  <p>3. {t("profile.telegramStep3")}</p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    asChild
                    size="lg"
                    className="w-full gap-2 bg-[#229ED9] text-white hover:bg-[#229ED9]/90 font-medium"
                  >
                    <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                      <TelegramIcon size="sm" aria-hidden="true" />
                      {t("profile.telegramOpenBot")}
                    </a>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    className="w-full gap-1.5"
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="size-4 text-success" />
                        {t("profile.telegramLinkCopied")}
                      </>
                    ) : (
                      <>
                        <CopyIcon className="size-4" />
                        {t("profile.telegramCopyLink")}
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex items-center justify-center gap-2 pt-2 text-xs text-muted-foreground">
                  <Spin size="sm" variant="current" aria-hidden="true" />
                  <span>{t("profile.telegramWaitingConfirmation")}</span>
                </div>
              </>
            ) : null}
          </div>

          <Dialog.Footer>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setIsTgDialogOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      {/* Предупреждение перед отвязкой Telegram (F4: все сессии). */}
      <ConfirmDialog
        open={isTgUnlinkConfirmOpen}
        onOpenChange={setIsTgUnlinkConfirmOpen}
        title={t("profile.telegramUnlinkConfirmTitle")}
        description={t("profile.telegramUnlinkConfirmDesc")}
        confirmLabel={t("profile.telegramUnlinkConfirmAction")}
        cancelLabel={t("actions.cancel")}
        confirmVariant="destructive"
        onConfirm={handleTelegramUnlinkConfirm}
      />

      {/* Шаг ввода одноразового кода из Telegram (F3). */}
      <Dialog
        open={isTgCodeOpen}
        onOpenChange={(open) => {
          if (!telegramUnlinkFlow.isBusy && !open) closeTelegramCodeDialog();
        }}
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t("profile.telegramUnlinkCodeTitle")}</Dialog.Title>
            <Dialog.Description>
              {t("profile.telegramUnlinkCodeDesc")}
            </Dialog.Description>
          </Dialog.Header>

          <form
            onSubmit={handleCodeSubmit}
            className="my-4 flex flex-col gap-4"
          >
            <Field invalid={telegramUnlinkFlow.errorKey !== null}>
              <Field.Label>{t("profile.telegramUnlinkCodeLabel")}</Field.Label>
              <Field.Content>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={TELEGRAM_UNLINK_CODE_LENGTH}
                  placeholder={t("profile.telegramUnlinkCodePlaceholder")}
                  value={code}
                  disabled={
                    telegramUnlinkFlow.isBusy ||
                    telegramUnlinkFlow.isCodeExpired
                  }
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, TELEGRAM_UNLINK_CODE_LENGTH),
                    )
                  }
                />
                {telegramUnlinkFlow.errorKey ? (
                  <Field.Error>{t(telegramUnlinkFlow.errorKey)}</Field.Error>
                ) : null}
              </Field.Content>
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              {telegramUnlinkFlow.isCodeExpired ? (
                <span>{t("profile.telegramUnlinkCodeExpiredNotice")}</span>
              ) : telegramUnlinkFlow.codeTtlSeconds !== null ? (
                <span>
                  {t("profile.telegramUnlinkCodeTtl", {
                    seconds: telegramUnlinkFlow.codeTtlSeconds,
                  })}
                </span>
              ) : null}

              {telegramUnlinkFlow.resendIn > 0 ? (
                <span>
                  {t("profile.telegramUnlinkCodeResendIn", {
                    seconds: telegramUnlinkFlow.resendIn,
                  })}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={telegramUnlinkFlow.isBusy}
                  onClick={telegramUnlinkFlow.requestCode}
                >
                  {t("profile.telegramUnlinkCodeResend")}
                </Button>
              )}
            </div>

            <Dialog.Footer>
              <Button
                type="button"
                variant="outline"
                disabled={telegramUnlinkFlow.isBusy}
                onClick={closeTelegramCodeDialog}
              >
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  telegramUnlinkFlow.isBusy ||
                  telegramUnlinkFlow.isCodeExpired ||
                  code.length !== TELEGRAM_UNLINK_CODE_LENGTH
                }
                aria-busy={telegramUnlinkFlow.isBusy}
              >
                {telegramUnlinkFlow.isBusy ? (
                  <Spin size="sm" variant="current" aria-hidden="true" />
                ) : null}
                {telegramUnlinkFlow.isBusy
                  ? t("profile.telegramUnlinkCodeConfirming")
                  : t("profile.telegramUnlinkCodeSubmit")}
              </Button>
            </Dialog.Footer>
          </form>
        </Dialog.Content>
      </Dialog>

      {/* Предупреждение перед отвязкой GitHub (F4: все сессии). */}
      <ConfirmDialog
        open={isGithubUnlinkOpen}
        onOpenChange={setIsGithubUnlinkOpen}
        title={t("profile.githubUnlinkConfirmTitle")}
        description={t("profile.githubUnlinkConfirmDesc")}
        confirmLabel={t("profile.githubUnlinkConfirmAction")}
        cancelLabel={t("actions.cancel")}
        confirmVariant="destructive"
        isPending={unlinkGithubMutation.isPending}
        onConfirm={handleGithubUnlinkConfirm}
      />
    </>
  );
}
