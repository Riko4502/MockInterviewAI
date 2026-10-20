"use client";

import {
  getNotificationCampaignsControllerFindAllQueryKey,
  getNotificationCampaignsControllerFindOneQueryKey,
  useNotificationCampaignsControllerFindOne,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { CampaignConfirmation } from "./types";

export function useCampaignDialogsController() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [viewingId, setViewingId] = useState<string>();
  const [confirmation, setConfirmation] = useState<CampaignConfirmation>();

  const details = useNotificationCampaignsControllerFindOne(viewingId ?? "", {
    query: { enabled: Boolean(viewingId) },
  });

  const onFormSuccess = async () => {
    setFormOpen(false);
    setEditingId(undefined);
    await queryClient.invalidateQueries({
      queryKey: getNotificationCampaignsControllerFindAllQueryKey(),
    });
    if (editingId) {
      await queryClient.invalidateQueries({
        queryKey: getNotificationCampaignsControllerFindOneQueryKey(editingId),
      });
    }
  };

  return {
    form: {
      open: formOpen,
      setOpen: setFormOpen,
      editingId,
      create: () => {
        setEditingId(undefined);
        setFormOpen(true);
      },
      edit: (id: string) => {
        setEditingId(id);
        setFormOpen(true);
      },
      onSuccess: onFormSuccess,
    },
    details,
    viewing: {
      id: viewingId,
      open: Boolean(viewingId),
      setId: setViewingId,
    },
    confirmation: {
      value: confirmation,
      setValue: setConfirmation,
    },
  };
}
