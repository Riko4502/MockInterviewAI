"use client";

import { PlusIcon } from "@packages/icons";
import { Button, Typography } from "@packages/ui";
import { useTranslation } from "react-i18next";
import { CampaignFormDialog } from "@/features/manage-notification-campaign";
import { useAdminNotificationsController } from "../model/useAdminNotificationsController";
import { AdminCampaignDialogs } from "./AdminCampaignDialogs";
import { AdminNotificationsFilters } from "./AdminNotificationsFilters";
import { AdminNotificationsTable } from "./AdminNotificationsTable";

export function AdminNotificationsWidget() {
  const { t } = useTranslation("common");
  const { campaignList, campaignDialogs, campaignActions } =
    useAdminNotificationsController();
  const { list, campaigns, filters, pagination, sorting, actions } =
    campaignList;
  const { form, details, viewing, confirmation } = campaignDialogs;

  const confirmCampaignAction = async () => {
    const succeeded = await campaignActions.confirm(confirmation.value);
    if (succeeded) confirmation.setValue(undefined);
  };

  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.H1 className="text-2xl font-bold">
            {t("adminNotifications.title")}
          </Typography.H1>
          <Typography.P className="text-sm text-muted-foreground">
            {t("adminNotifications.description")}
          </Typography.P>
        </div>
        <Button onClick={form.create}>
          <PlusIcon aria-hidden="true" />
          {t("adminNotifications.actions.create")}
        </Button>
      </header>
      <AdminNotificationsFilters
        search={filters.search}
        status={filters.status}
        targetType={filters.targetType}
        recipientUser={filters.recipientUser}
        sortOrder={sorting.sortOrder}
        onSearchChange={actions.setSearch}
        onStatusChange={(status) => {
          actions.setStatus(status);
          actions.setPage(1);
        }}
        onTargetTypeChange={actions.setTargetType}
        onRecipientUserChange={actions.setRecipientUser}
        onSortOrderChange={(sortOrder) => {
          actions.setSortOrder(sortOrder);
          actions.setPage(1);
        }}
      />
      {list.isError && (
        <div role="alert" className="rounded-md border border-destructive p-4">
          <Typography.P>{t("adminNotifications.loadError")}</Typography.P>
          <Button variant="outline" onClick={() => void list.refetch()}>
            {t("notifications.retry")}
          </Button>
        </div>
      )}
      <AdminNotificationsTable
        campaigns={campaigns}
        loading={list.isLoading}
        emptyText={t(
          filters.querySearch
            ? "adminNotifications.emptySearch"
            : "adminNotifications.empty",
        )}
        page={pagination.page}
        pageSize={pagination.pageSize}
        totalPages={pagination.totalPages}
        total={pagination.total}
        paginationVisible={pagination.visible}
        sortBy={sorting.sortBy}
        sortOrder={sorting.sortOrder}
        queuePending={campaignActions.queuePending}
        onPageChange={actions.setPage}
        onPageSizeChange={(pageSize) => {
          actions.setPageSize(pageSize);
          actions.setPage(1);
        }}
        onSortChange={actions.setSort}
        onOpenCampaign={viewing.setId}
        onEdit={form.edit}
        onQueue={campaignActions.queueCampaign}
        onCancel={(id) => confirmation.setValue({ id, action: "cancel" })}
        onDelete={(id) => confirmation.setValue({ id, action: "delete" })}
      />
      <CampaignFormDialog
        open={form.open}
        onOpenChange={form.setOpen}
        mode={form.editingId ? "edit" : "create"}
        campaignId={form.editingId}
        onSuccess={form.onSuccess}
      />
      <AdminCampaignDialogs
        campaign={details.data}
        detailsLoading={details.isLoading}
        detailsError={details.isError}
        viewing={viewing.open}
        confirmation={confirmation.value}
        confirmationPending={campaignActions.confirmationPending}
        onViewingChange={(open) => {
          if (!open) viewing.setId(undefined);
        }}
        onConfirmationChange={confirmation.setValue}
        onConfirm={() => void confirmCampaignAction()}
      />
    </main>
  );
}
