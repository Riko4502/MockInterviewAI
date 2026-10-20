"use client";

import type {
  NotificationCampaignsControllerFindAllSortBy,
  NotificationCampaignsControllerFindAllSortOrder,
  NotificationCampaignsPageDtoItemsItem,
} from "@packages/api";
import {
  DataTable,
  type DataTableColumn,
  Pagination,
  Select,
} from "@packages/ui";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CAMPAIGN_CATEGORY_LABEL_KEYS,
  CampaignStatusBadge,
  CampaignTargetBadge,
} from "@/entities/admin-notification-campaign";
import { AdminCampaignActionsMenu } from "./AdminCampaignActionsMenu";

type Campaign = NotificationCampaignsPageDtoItemsItem;

interface AdminNotificationsTableProps {
  campaigns: Campaign[];
  loading: boolean;
  emptyText: string;
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  paginationVisible: boolean;
  sortBy: NotificationCampaignsControllerFindAllSortBy;
  sortOrder: NotificationCampaignsControllerFindAllSortOrder;
  queuePending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortChange: (
    sortBy: NotificationCampaignsControllerFindAllSortBy,
    sortOrder: NotificationCampaignsControllerFindAllSortOrder,
  ) => void;
  onOpenCampaign: (id: string) => void;
  onEdit: (id: string) => void;
  onQueue: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AdminNotificationsTable({
  campaigns,
  loading,
  emptyText,
  page,
  pageSize,
  totalPages,
  total,
  paginationVisible,
  sortBy,
  sortOrder,
  queuePending,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onOpenCampaign,
  onEdit,
  onQueue,
  onCancel,
  onDelete,
}: AdminNotificationsTableProps) {
  const { t } = useTranslation("common");
  const columns = useMemo<DataTableColumn<Campaign>[]>(
    () => [
      {
        key: "title",
        header: t("adminNotifications.table.title"),
        cell: (row) => (
          <button
            type="button"
            className="text-left font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => onOpenCampaign(row.id)}
          >
            {row.title}
          </button>
        ),
      },
      {
        key: "category",
        header: t("adminNotifications.table.category"),
        cell: (row) => t(CAMPAIGN_CATEGORY_LABEL_KEYS[row.category]),
      },
      {
        key: "target",
        header: t("adminNotifications.table.target"),
        cell: (row) => (
          <CampaignTargetBadge
            targetType={row.targetType}
            totalRecipients={row.totalRecipients}
          />
        ),
      },
      {
        key: "status",
        header: t("adminNotifications.table.status"),
        cell: (row) => (
          <CampaignStatusBadge
            status={row.status}
            sentCount={row.sentCount}
            totalRecipients={row.totalRecipients}
          />
        ),
      },
      {
        key: "schedule",
        header: (
          <button
            type="button"
            className="font-medium"
            onClick={() =>
              onSortChange(
                "scheduledAt",
                sortBy === "scheduledAt" && sortOrder === "asc"
                  ? "desc"
                  : "asc",
              )
            }
          >
            {t("adminNotifications.table.scheduledAt")}
          </button>
        ),
        cell: (row) =>
          row.scheduledAt ? new Date(row.scheduledAt).toLocaleString() : "—",
      },
      {
        key: "created",
        header: (
          <button
            type="button"
            className="font-medium"
            onClick={() =>
              onSortChange(
                "createdAt",
                sortBy === "createdAt" && sortOrder === "asc" ? "desc" : "asc",
              )
            }
          >
            {t("adminNotifications.table.createdAt")}
          </button>
        ),
        cell: (row) => new Date(row.createdAt).toLocaleString(),
      },
      {
        key: "counts",
        header: t("adminNotifications.table.counts"),
        cell: (row) =>
          `${row.totalRecipients} / ${row.sentCount} / ${row.readCount}`,
      },
      {
        key: "actions",
        header: t("adminNotifications.table.actions"),
        cell: (row) => (
          <AdminCampaignActionsMenu
            campaign={row}
            queuePending={queuePending}
            onEdit={onEdit}
            onQueue={onQueue}
            onCancel={onCancel}
            onDelete={onDelete}
          />
        ),
      },
    ],
    [
      onCancel,
      onDelete,
      onEdit,
      onOpenCampaign,
      onQueue,
      onSortChange,
      queuePending,
      sortBy,
      sortOrder,
      t,
    ],
  );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border">
        <DataTable
          data={campaigns}
          columns={columns}
          loading={loading}
          emptyText={emptyText}
        />
      </div>
      {paginationVisible && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <Select.Trigger className="w-28">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              {[10, 20, 50].map((value) => (
                <Select.Item key={value} value={String(value)}>
                  {value}
                </Select.Item>
              ))}
            </Select.Content>
          </Select>
          <Pagination aria-label={t("adminNotifications.pagination.label")}>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous
                  href="#"
                  label={t("notifications.pagination.previousAria")}
                  aria-disabled={page <= 1}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) onPageChange(page - 1);
                  }}
                />
              </Pagination.Item>
              <Pagination.Item>
                <span aria-current="page" className="px-3 py-2 text-sm">
                  {page} / {Math.max(1, totalPages)}
                </span>
              </Pagination.Item>
              <Pagination.Item>
                <Pagination.Next
                  href="#"
                  label={t("notifications.pagination.next")}
                  aria-disabled={page >= totalPages}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < totalPages) onPageChange(page + 1);
                  }}
                />
              </Pagination.Item>
            </Pagination.Content>
          </Pagination>
          <span className="text-sm text-muted-foreground">
            {t("adminNotifications.pagination.total", { count: total })}
          </span>
        </div>
      )}
    </>
  );
}
