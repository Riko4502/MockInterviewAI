"use client";

import {
  getMatchmakingControllerFindIncomingQueryKey,
  getMatchmakingControllerFindOutgoingQueryKey,
  getMatchmakingControllerGetUnreadCountQueryKey,
  getShowcaseControllerFindMyQueryKey,
  useMatchmakingControllerAccept,
  useMatchmakingControllerCancel,
  useMatchmakingControllerFindIncoming,
  useMatchmakingControllerFindOutgoing,
  useMatchmakingControllerReject,
} from "@packages/api";
import type { MatchRequestResponseDto } from "@packages/dto";
import { CheckIcon, PlayIcon } from "@packages/icons";
import { Badge, Button, Card, useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  LanguageBadge,
  LevelBadge,
  SpecializationBadge,
} from "@/entities/showcase-card";
import { UserAvatar } from "@/entities/user";
import { paths } from "@/shared/config";
import "@/shared/lib/i18n";

export interface MatchRequestsHubProps {
  className?: string;
}

export function MatchRequestsHub({ className }: MatchRequestsHubProps) {
  const { t } = useTranslation("showcase");
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );

  const { data: incomingData, isLoading: isIncomingLoading } =
    useMatchmakingControllerFindIncoming({ page: 1, limit: 50 });

  const { data: outgoingData, isLoading: isOutgoingLoading } =
    useMatchmakingControllerFindOutgoing({ page: 1, limit: 50 });

  const acceptMutation = useMatchmakingControllerAccept();
  const rejectMutation = useMatchmakingControllerReject();
  const cancelMutation = useMatchmakingControllerCancel();

  const incomingRequests: MatchRequestResponseDto[] =
    (incomingData as unknown as { data?: MatchRequestResponseDto[] })?.data ||
    [];
  const outgoingRequests: MatchRequestResponseDto[] =
    (outgoingData as unknown as { data?: MatchRequestResponseDto[] })?.data ||
    [];

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getMatchmakingControllerFindIncomingQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getMatchmakingControllerFindOutgoingQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getMatchmakingControllerGetUnreadCountQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getShowcaseControllerFindMyQueryKey(),
      }),
    ]);
  };

  const handleAccept = async (requestId: string) => {
    // 1. Отменяем текущие запросы для предотвращения перезаписи
    await Promise.all([
      queryClient.cancelQueries({
        queryKey: getMatchmakingControllerFindIncomingQueryKey(),
      }),
      queryClient.cancelQueries({
        queryKey: getMatchmakingControllerGetUnreadCountQueryKey(),
      }),
    ]);

    // 2. Снимок предыдущего состояния для rollback при ошибке
    const previousIncoming = queryClient.getQueryData(
      getMatchmakingControllerFindIncomingQueryKey(),
    );
    const previousUnread = queryClient.getQueryData(
      getMatchmakingControllerGetUnreadCountQueryKey(),
    );

    // 3. Оптимистичное обновление входящих заявок и счётчика
    queryClient.setQueryData(
      getMatchmakingControllerFindIncomingQueryKey(),
      (old: unknown) => {
        if (!old) return old;
        const record = old as { data?: MatchRequestResponseDto[] };
        if (record.data && Array.isArray(record.data)) {
          return {
            ...record,
            data: record.data.map((item) =>
              item.id === requestId
                ? { ...item, status: "ACCEPTED" as const }
                : item,
            ),
          };
        }
        if (Array.isArray(old)) {
          return old.map((item) =>
            item.id === requestId
              ? { ...item, status: "ACCEPTED" as const }
              : item,
          );
        }
        return old;
      },
    );

    queryClient.setQueryData(
      getMatchmakingControllerGetUnreadCountQueryKey(),
      (old: unknown) => {
        if (!old) return old;
        const record = old as { count?: number };
        return {
          ...record,
          count: Math.max(0, (record.count ?? 1) - 1),
        };
      },
    );

    // 4. Запрос к серверу
    acceptMutation.mutate(
      { id: requestId },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("matchmaking.acceptSuccess"),
          });
          await invalidateAll();
        },
        onError: () => {
          // Откат при ошибке
          if (previousIncoming !== undefined) {
            queryClient.setQueryData(
              getMatchmakingControllerFindIncomingQueryKey(),
              previousIncoming,
            );
          }
          if (previousUnread !== undefined) {
            queryClient.setQueryData(
              getMatchmakingControllerGetUnreadCountQueryKey(),
              previousUnread,
            );
          }
          toast.push({
            status: "error",
            title: t("matchmaking.actionError"),
          });
        },
      },
    );
  };

  const handleReject = async (requestId: string) => {
    await Promise.all([
      queryClient.cancelQueries({
        queryKey: getMatchmakingControllerFindIncomingQueryKey(),
      }),
      queryClient.cancelQueries({
        queryKey: getMatchmakingControllerGetUnreadCountQueryKey(),
      }),
    ]);

    const previousIncoming = queryClient.getQueryData(
      getMatchmakingControllerFindIncomingQueryKey(),
    );
    const previousUnread = queryClient.getQueryData(
      getMatchmakingControllerGetUnreadCountQueryKey(),
    );

    queryClient.setQueryData(
      getMatchmakingControllerFindIncomingQueryKey(),
      (old: unknown) => {
        if (!old) return old;
        const record = old as { data?: MatchRequestResponseDto[] };
        if (record.data && Array.isArray(record.data)) {
          return {
            ...record,
            data: record.data.map((item) =>
              item.id === requestId
                ? { ...item, status: "REJECTED" as const }
                : item,
            ),
          };
        }
        if (Array.isArray(old)) {
          return old.map((item) =>
            item.id === requestId
              ? { ...item, status: "REJECTED" as const }
              : item,
          );
        }
        return old;
      },
    );

    queryClient.setQueryData(
      getMatchmakingControllerGetUnreadCountQueryKey(),
      (old: unknown) => {
        if (!old) return old;
        const record = old as { count?: number };
        return {
          ...record,
          count: Math.max(0, (record.count ?? 1) - 1),
        };
      },
    );

    rejectMutation.mutate(
      { id: requestId, data: {} },
      {
        onSuccess: async () => {
          toast.push({
            status: "info",
            title: t("matchmaking.rejectSuccess"),
          });
          await invalidateAll();
        },
        onError: () => {
          if (previousIncoming !== undefined) {
            queryClient.setQueryData(
              getMatchmakingControllerFindIncomingQueryKey(),
              previousIncoming,
            );
          }
          if (previousUnread !== undefined) {
            queryClient.setQueryData(
              getMatchmakingControllerGetUnreadCountQueryKey(),
              previousUnread,
            );
          }
          toast.push({
            status: "error",
            title: t("matchmaking.actionError"),
          });
        },
      },
    );
  };

  const handleCancel = async (requestId: string) => {
    await queryClient.cancelQueries({
      queryKey: getMatchmakingControllerFindOutgoingQueryKey(),
    });

    const previousOutgoing = queryClient.getQueryData(
      getMatchmakingControllerFindOutgoingQueryKey(),
    );

    queryClient.setQueryData(
      getMatchmakingControllerFindOutgoingQueryKey(),
      (old: unknown) => {
        if (!old) return old;
        const record = old as { data?: MatchRequestResponseDto[] };
        if (record.data && Array.isArray(record.data)) {
          return {
            ...record,
            data: record.data.map((item) =>
              item.id === requestId
                ? { ...item, status: "CANCELLED" as const }
                : item,
            ),
          };
        }
        if (Array.isArray(old)) {
          return old.map((item) =>
            item.id === requestId
              ? { ...item, status: "CANCELLED" as const }
              : item,
          );
        }
        return old;
      },
    );

    cancelMutation.mutate(
      { id: requestId },
      {
        onSuccess: async () => {
          toast.push({
            status: "info",
            title: t("matchmaking.cancelSuccess"),
          });
          await invalidateAll();
        },
        onError: () => {
          if (previousOutgoing !== undefined) {
            queryClient.setQueryData(
              getMatchmakingControllerFindOutgoingQueryKey(),
              previousOutgoing,
            );
          }
          toast.push({
            status: "error",
            title: t("matchmaking.actionError"),
          });
        },
      },
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <Badge variant="statusSuccess" className="text-xs">
            {t("matchmaking.acceptedBadge")}
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge variant="statusDanger" className="text-xs">
            {t("matchmaking.rejectedBadge")}
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="text-xs">
            {t("matchmaking.cancelledBadge")}
          </Badge>
        );
      default:
        return (
          <Badge variant="waiting" className="text-xs">
            {t("matchmaking.pendingBadge")}
          </Badge>
        );
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${className || ""}`}>
      {/* Подвкладки: Входящие / Исходящие */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("incoming")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "incoming"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("matchmaking.incomingTab")} ({incomingRequests.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("outgoing")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "outgoing"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("matchmaking.outgoingTab")} ({outgoingRequests.length})
        </button>
      </div>

      {/* Список заявок */}
      {activeTab === "incoming" ? (
        isIncomingLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((k) => (
              <div
                key={k}
                className="h-36 rounded-xl border border-border/60 bg-muted/20 animate-pulse"
              />
            ))}
          </div>
        ) : incomingRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
            <h3 className="text-base font-bold text-foreground">
              {t("matchmaking.incomingEmpty")}
            </h3>
            <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
              {t("matchmaking.incomingEmptyDesc")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {incomingRequests.map((req) => {
              const senderName =
                req.sender.displayName ||
                req.sender.username ||
                t("card.anonymousUser");
              const isPending = req.status === "PENDING";
              const isAccepted = req.status === "ACCEPTED";

              return (
                <Card
                  key={req.id}
                  className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-3">
                    {/* Шапка заявки */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={req.sender.avatarUrl}
                          name={senderName}
                          size="md"
                          className="ring-2 ring-border/50 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {senderName}
                          </span>
                          {req.sender.username && (
                            <span className="text-xs text-muted-foreground truncate">
                              @{req.sender.username}
                            </span>
                          )}
                        </div>
                      </div>

                      {getStatusBadge(req.status)}
                    </div>

                    {/* Карточка витрины отправителя (если прикреплена) */}
                    {req.senderCard && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <SpecializationBadge
                          specialization={req.senderCard.specialization}
                        />
                        <LevelBadge level={req.senderCard.level} />
                        <LanguageBadge language={req.senderCard.language} />
                      </div>
                    )}

                    {/* Тема и сообщение */}
                    {req.preferredTopic && (
                      <div className="text-xs text-foreground/90 bg-muted/30 rounded-md p-2 border border-border/40">
                        <span className="font-medium text-muted-foreground mr-1.5">
                          {t("matchmaking.preferredTopic")}
                        </span>
                        <span>{req.preferredTopic}</span>
                      </div>
                    )}

                    {req.message && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        "{req.message}"
                      </p>
                    )}

                    {/* Если заявка принята — показываем переход в интерактивную комнату */}
                    {isAccepted && (
                      <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
                            <CheckIcon className="size-3.5" />
                            {t("matchmaking.matchedTitle")}
                          </span>
                          <span className="text-[11px] text-muted-foreground leading-snug">
                            {t("matchmaking.matchedDesc")}
                          </span>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shrink-0 shadow-xs gap-1.5 cursor-pointer"
                        >
                          <Link href={paths.sandbox}>
                            <PlayIcon className="size-3.5 fill-current" />
                            <span>{t("matchmaking.goToInterview")}</span>
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Кнопки действий для входящей заявки */}
                  {isPending && (
                    <div className="pt-3 border-t border-border/50 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rejectMutation.isPending}
                        onClick={() => handleReject(req.id)}
                        className="text-xs cursor-pointer"
                      >
                        {t("matchmaking.reject")}
                      </Button>
                      <Button
                        size="sm"
                        variant="default"
                        disabled={acceptMutation.isPending}
                        onClick={() => handleAccept(req.id)}
                        className="text-xs font-semibold shadow-xs cursor-pointer gap-1.5"
                      >
                        <CheckIcon className="size-3.5" />
                        <span>{t("matchmaking.accept")}</span>
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      ) : isOutgoingLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((k) => (
            <div
              key={k}
              className="h-36 rounded-xl border border-border/60 bg-muted/20 animate-pulse"
            />
          ))}
        </div>
      ) : outgoingRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
          <h3 className="text-base font-bold text-foreground">
            {t("matchmaking.outgoingEmpty")}
          </h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">
            {t("matchmaking.outgoingEmptyDesc")}
          </p>
          <Button asChild variant="default" size="sm" className="mt-5">
            <Link href={paths.partners}>{t("tabs.catalog")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outgoingRequests.map((req) => {
            const receiverName =
              req.receiver.displayName ||
              req.receiver.username ||
              t("card.anonymousUser");
            const isPending = req.status === "PENDING";
            const isAccepted = req.status === "ACCEPTED";

            return (
              <Card
                key={req.id}
                className="rounded-xl border border-border/70 bg-card p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={req.receiver.avatarUrl}
                        name={receiverName}
                        size="md"
                        className="ring-2 ring-border/50 shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {receiverName}
                        </span>
                        {req.receiver.username && (
                          <span className="text-xs text-muted-foreground truncate">
                            @{req.receiver.username}
                          </span>
                        )}
                      </div>
                    </div>

                    {getStatusBadge(req.status)}
                  </div>

                  {/* Карточка, на которую отправлен отклик */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <SpecializationBadge
                      specialization={req.targetCard.specialization}
                    />
                    <LevelBadge level={req.targetCard.level} />
                    <LanguageBadge language={req.targetCard.language} />
                  </div>

                  {req.preferredTopic && (
                    <div className="text-xs text-foreground/90 bg-muted/30 rounded-md p-2 border border-border/40">
                      <span className="font-medium text-muted-foreground mr-1.5">
                        {t("matchmaking.preferredTopic")}
                      </span>
                      <span>{req.preferredTopic}</span>
                    </div>
                  )}

                  {req.message && (
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      "{req.message}"
                    </p>
                  )}

                  {/* Если заявка принята собеседником — показываем переход в интерактивную комнату */}
                  {isAccepted && (
                    <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-xs text-emerald-400 flex items-center gap-1.5">
                          <CheckIcon className="size-3.5" />
                          {t("matchmaking.matchedTitle")}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-snug">
                          {t("matchmaking.matchedDesc")}
                        </span>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="default"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shrink-0 shadow-xs gap-1.5 cursor-pointer"
                      >
                        <Link href={paths.sandbox}>
                          <PlayIcon className="size-3.5 fill-current" />
                          <span>{t("matchmaking.goToInterview")}</span>
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="pt-3 border-t border-border/50 flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelMutation.isPending}
                      onClick={() => handleCancel(req.id)}
                      className="text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {t("matchmaking.cancel")}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
