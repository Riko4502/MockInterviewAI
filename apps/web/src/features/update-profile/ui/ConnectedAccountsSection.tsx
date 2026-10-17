"use client";

import type { UserProfileDto } from "@packages/api";
import {
  getProfileControllerGetMyProfileQueryKey,
  useAuthControllerOauthProviders,
  useTelegramControllerCreateLinkToken,
} from "@packages/api";
import { CheckIcon, CopyIcon, GithubIcon, TelegramIcon } from "@packages/icons";
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
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const createLinkTokenMutation = useTelegramControllerCreateLinkToken();
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
    updateProfileMutation.isPending || createLinkTokenMutation.isPending;

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
    </>
  );
}
