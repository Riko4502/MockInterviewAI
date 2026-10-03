"use client";

import {
  getMatchmakingControllerFindIncomingQueryKey,
  getMatchmakingControllerFindOutgoingQueryKey,
  getMatchmakingControllerGetUnreadCountQueryKey,
  getShowcaseControllerFindMyQueryKey,
  type MatchRequestResponseDto,
  useMatchmakingControllerAccept,
  useMatchmakingControllerCancel,
  useMatchmakingControllerFindIncoming,
  useMatchmakingControllerFindOutgoing,
  useMatchmakingControllerReject,
} from "@packages/api";
import { useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";

export function useMatchRequestsHub() {
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

  const incomingRequests: MatchRequestResponseDto[] = incomingData?.data || [];
  const outgoingRequests: MatchRequestResponseDto[] = outgoingData?.data || [];

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
        const record = old as { pendingCount?: number };
        return {
          ...record,
          pendingCount: Math.max(0, (record.pendingCount ?? 1) - 1),
        };
      },
    );

    // 4. Запрос к серверу
    acceptMutation.mutate(
      { id: requestId },
      {
        onSuccess: async (acceptedDto) => {
          if (acceptedDto?.sessionId) {
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
                        ? { ...item, ...acceptedDto }
                        : item,
                    ),
                  };
                }
                if (Array.isArray(old)) {
                  return old.map((item) =>
                    item.id === requestId ? { ...item, ...acceptedDto } : item,
                  );
                }
                return old;
              },
            );
          }
          toast.push({
            status: "success",
            title: t("matchmaking.acceptSuccess"),
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
        const record = old as { pendingCount?: number };
        return {
          ...record,
          pendingCount: Math.max(0, (record.pendingCount ?? 1) - 1),
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

  return {
    activeTab,
    setActiveTab,
    incomingRequests,
    outgoingRequests,
    isIncomingLoading,
    isOutgoingLoading,
    handleAccept,
    handleReject,
    handleCancel,
    isAcceptPending: acceptMutation.isPending,
    isRejectPending: rejectMutation.isPending,
    isCancelPending: cancelMutation.isPending,
  };
}
