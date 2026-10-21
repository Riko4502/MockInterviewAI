"use client";

import {
  NotificationCampaignDtoStatus,
  type NotificationCampaignsControllerFindAllSortBy,
  type NotificationCampaignsControllerFindAllSortOrder,
  type NotificationCampaignsControllerFindAllStatus,
  type NotificationCampaignsControllerFindAllTargetType,
  useNotificationCampaignsControllerFindAll,
} from "@packages/api";
import { useEffect, useState } from "react";
import type { PickerUser } from "@/features/admin-user-multi-picker";

interface CampaignListParams {
  page: number;
  pageSize: number;
  search?: string;
  status?: NotificationCampaignsControllerFindAllStatus;
  targetType?: NotificationCampaignsControllerFindAllTargetType;
  recipientUserId?: string;
  sortBy: NotificationCampaignsControllerFindAllSortBy;
  sortOrder: NotificationCampaignsControllerFindAllSortOrder;
}

export function useCampaignListController() {
  const [search, setSearch] = useState("");
  const [recipientUser, setRecipientUser] = useState<PickerUser | null>(null);
  const [params, setParams] = useState<CampaignListParams>({
    page: 1,
    pageSize: 10,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const updateParams = (update: Partial<CampaignListParams>) =>
    setParams((current) => ({ ...current, ...update }));

  const list = useNotificationCampaignsControllerFindAll(
    {
      page: params.page,
      limit: params.pageSize,
      search: params.search,
      status: params.status,
      targetType: params.targetType,
      recipientUserId: params.recipientUserId,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
    },
    {
      query: {
        refetchInterval: (query) =>
          query.state.data?.items.some(
            (campaign) =>
              campaign.status === NotificationCampaignDtoStatus.PROCESSING,
          )
            ? 7000
            : false,
      },
    },
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams((current) => ({
        ...current,
        search: search.trim() || undefined,
        page: 1,
      }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  return {
    list,
    campaigns: list.data?.items ?? [],
    filters: {
      search,
      status: params.status,
      targetType: params.targetType,
      recipientUser,
      querySearch: params.search ?? "",
    },
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      totalPages: list.data?.meta.totalPages ?? 1,
      total: list.data?.meta.total ?? 0,
      visible: Boolean(list.data),
    },
    sorting: { sortBy: params.sortBy, sortOrder: params.sortOrder },
    actions: {
      setSearch,
      setPage: (page: number) => updateParams({ page }),
      setStatus: (status?: NotificationCampaignsControllerFindAllStatus) =>
        updateParams({ status }),
      setTargetType: (
        targetType?: NotificationCampaignsControllerFindAllTargetType,
      ) => {
        updateParams({
          targetType,
          ...(targetType === "SPECIFIC" ? {} : { recipientUserId: undefined }),
          page: 1,
        });
        if (targetType !== "SPECIFIC") setRecipientUser(null);
      },
      setRecipientUser: (user: PickerUser | null) => {
        setRecipientUser(user);
        updateParams({ recipientUserId: user?.id, page: 1 });
      },
      setPageSize: (pageSize: number) => updateParams({ pageSize }),
      setSort: (
        sortBy: NotificationCampaignsControllerFindAllSortBy,
        sortOrder: NotificationCampaignsControllerFindAllSortOrder,
      ) => updateParams({ sortBy, sortOrder }),
      setSortOrder: (
        sortOrder: NotificationCampaignsControllerFindAllSortOrder,
      ) => updateParams({ sortOrder }),
    },
  };
}
