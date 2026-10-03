"use client";

import type { UserProfileDto } from "@packages/api";
import {
  getProfileControllerGetMyProfileQueryKey,
  useAuthControllerOauthProviders,
  useAuthControllerTelegramLink,
} from "@packages/api";
import { GithubIcon, TelegramIcon } from "@packages/icons";
import {
  Badge,
  Button,
  Card,
  Dialog,
  Spin,
  Typography,
  useToast,
} from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getApiUrl } from "@/shared/api/config/endpoints";
import "@/shared/lib/i18n";
import { useUpdateProfile } from "../model/use-profile-mutations";

type ConnectedAccountsSectionProps = {
  user: UserProfileDto;
};

export function ConnectedAccountsSection({
  user,
}: ConnectedAccountsSectionProps) {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const toast = useToast();
  const [isTgDialogOpen, setIsTgDialogOpen] = useState(false);
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(
    null,
  );
  const [scriptStatus, setScriptStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const linkTelegramMutation = useAuthControllerTelegramLink();
  const updateProfileMutation = useUpdateProfile();

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
  const isPending =
    linkTelegramMutation.isPending || updateProfileMutation.isPending;

  useEffect(() => {
    if (!isTgDialogOpen || !botUsername || !containerNode) return;

    setScriptStatus("loading");

    window.onTelegramAuth = (telegramUser) => {
      linkTelegramMutation.mutate(
        { data: telegramUser },
        {
          onSuccess: () => {
            toast.push({
              status: "success",
              title: t("profile.telegramLinkSuccess"),
            });
            queryClient.invalidateQueries({
              queryKey: getProfileControllerGetMyProfileQueryKey(),
            });
            setIsTgDialogOpen(false);
          },
          onError: () => {
            toast.push({
              status: "error",
              title: t("profile.telegramLinkError"),
            });
          },
        },
      );
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js";
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
  }, [
    isTgDialogOpen,
    botUsername,
    containerNode,
    linkTelegramMutation,
    queryClient,
    t,
    toast,
  ]);

  const handleUnlinkTelegram = () => {
    updateProfileMutation.mutate(
      { data: { telegramUsername: null } },
      {
        onSuccess: () => {
          toast.push({
            status: "success",
            title: t("profile.telegramUnlinkSuccess"),
          });
          queryClient.invalidateQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
          });
        },
      },
    );
  };

  const handleUnlinkGithub = () => {
    updateProfileMutation.mutate(
      { data: { gitUrl: null } },
      {
        onSuccess: () => {
          toast.push({
            status: "success",
            title: t("profile.githubUnlinkSuccess"),
          });
          queryClient.invalidateQueries({
            queryKey: getProfileControllerGetMyProfileQueryKey(),
          });
        },
      },
    );
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
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-500 dark:bg-sky-500/20">
                  <TelegramIcon size={8} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      Telegram
                    </span>
                    <Badge
                      variant={isTelegramLinked ? "statusSuccess" : "waiting"}
                    >
                      {isTelegramLinked
                        ? t("profile.connected")
                        : t("profile.notConnected")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isTelegramLinked
                      ? `@${user.telegramUsername?.replace(/^@/, "")}`
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
                    onClick={handleUnlinkTelegram}
                  >
                    {updateProfileMutation.isPending ? (
                      <Spin size="sm" variant="current" aria-hidden="true" />
                    ) : null}
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
                    <TelegramIcon size={14} aria-hidden="true" />
                    {t("profile.telegramLinkButton")}
                  </Button>
                )}
              </div>
            </div>

            {/* GitHub Item */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
                  <GithubIcon size={8} aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      GitHub
                    </span>
                    <Badge
                      variant={isGithubLinked ? "statusSuccess" : "waiting"}
                    >
                      {isGithubLinked
                        ? t("profile.connected")
                        : t("profile.notConnected")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
                    onClick={handleUnlinkGithub}
                  >
                    {updateProfileMutation.isPending ? (
                      <Spin size="sm" variant="current" aria-hidden="true" />
                    ) : null}
                    {t("profile.githubUnlinkButton")}
                  </Button>
                ) : oauthProviders?.github ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={githubOAuthHref}>
                      <GithubIcon size={14} aria-hidden="true" />
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
        onOpenChange={(open) =>
          !linkTelegramMutation.isPending && setIsTgDialogOpen(open)
        }
      >
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>{t("profile.telegramLinkDialogTitle")}</Dialog.Title>
            <Dialog.Description>
              {t("profile.telegramLinkDialogDesc")}
            </Dialog.Description>
          </Dialog.Header>

          <div className="my-6 flex flex-col items-center justify-center gap-3">
            <div
              ref={setContainerNode}
              className="flex min-h-10 justify-center"
            />

            {!botUsername ? (
              <p className="text-center text-sm text-destructive">
                {t("profile.telegramNotConfigured")}
              </p>
            ) : scriptStatus === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spin size="sm" variant="current" aria-hidden="true" />
                <Typography.P>
                  {t("profile.telegramWidgetLoading")}
                </Typography.P>
              </div>
            ) : scriptStatus === "error" ? (
              <p className="text-center text-sm text-destructive">
                {t("profile.telegramWidgetError")}
              </p>
            ) : null}

            {linkTelegramMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spin size="sm" variant="current" aria-hidden="true" />
                <Typography.P>{t("profile.saving")}</Typography.P>
              </div>
            )}
          </div>

          <Dialog.Footer>
            <Button
              type="button"
              variant="outline"
              disabled={linkTelegramMutation.isPending}
              onClick={() => setIsTgDialogOpen(false)}
            >
              {t("actions.cancel")}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
