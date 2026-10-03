"use client";

import {
  getShowcaseControllerFindAllQueryKey,
  getShowcaseControllerFindMyQueryKey,
  getShowcaseControllerFindOneQueryKey,
  useShowcaseControllerBump,
  useShowcaseControllerCreate,
  useShowcaseControllerRemove,
  useShowcaseControllerRenew,
  useShowcaseControllerUpdate,
  useShowcaseControllerUpdateStatus,
} from "@packages/api";
import { useToast } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import "@/shared/lib/i18n";
import {
  type ShowcaseFormValues,
  toCreateShowcaseCardDto,
  toUpdateShowcaseCardDto,
} from "./showcase-form-schema";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function useShowcaseMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation("showcase");

  const invalidateShowcaseQueries = async (cardId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getShowcaseControllerFindMyQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: getShowcaseControllerFindAllQueryKey(),
      }),
      queryClient.invalidateQueries({
        queryKey: ["dashboard"],
      }),
      ...(cardId
        ? [
            queryClient.invalidateQueries({
              queryKey: getShowcaseControllerFindOneQueryKey(cardId),
            }),
          ]
        : []),
    ]);
  };

  const createMutation = useShowcaseControllerCreate();
  const updateMutation = useShowcaseControllerUpdate();
  const deleteMutation = useShowcaseControllerRemove();
  const updateStatusMutation = useShowcaseControllerUpdateStatus();
  const bumpMutation = useShowcaseControllerBump();
  const renewMutation = useShowcaseControllerRenew();

  const createCard = async (
    values: ShowcaseFormValues,
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    const data = toCreateShowcaseCardDto(values);

    return createMutation.mutate(
      { data },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("card.createSuccess"),
          });
          await invalidateShowcaseQueries();
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.createError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  const updateCard = async (
    id: string,
    values: ShowcaseFormValues,
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    const data = toUpdateShowcaseCardDto(values);

    return updateMutation.mutate(
      { id, data },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("card.updateSuccess"),
          });
          await invalidateShowcaseQueries(id);
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.updateError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  const deleteCard = async (
    id: string,
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    return deleteMutation.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("card.deleteSuccess"),
          });
          await invalidateShowcaseQueries(id);
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.deleteError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  const toggleStatus = async (
    id: string,
    currentStatus: "ACTIVE" | "INACTIVE",
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    const nextStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    return updateStatusMutation.mutate(
      {
        id,
        data: { status: nextStatus },
      },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title:
              nextStatus === "ACTIVE"
                ? t("card.statusActive")
                : t("card.statusInactive"),
          });
          await invalidateShowcaseQueries(id);
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.statusError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  const bumpCard = async (
    id: string,
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    return bumpMutation.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("card.bumpSuccess"),
          });
          await invalidateShowcaseQueries(id);
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.bumpError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  const renewCard = async (
    id: string,
    callbacks?: {
      onSuccess?: () => void;
      onError?: (error: unknown) => void;
    },
  ) => {
    return renewMutation.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.push({
            status: "success",
            title: t("card.renewSuccess"),
          });
          await invalidateShowcaseQueries(id);
          callbacks?.onSuccess?.();
        },
        onError: (err: unknown) => {
          const message = extractErrorMessage(err, t("card.renewError"));

          toast.push({
            status: "error",
            title: message,
          });
          callbacks?.onError?.(err);
        },
      },
    );
  };

  return {
    createCard,
    updateCard,
    deleteCard,
    toggleStatus,
    bumpCard,
    renewCard,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isTogglingStatus: updateStatusMutation.isPending,
    isBumping: bumpMutation.isPending,
    isRenewing: renewMutation.isPending,
  };
}
