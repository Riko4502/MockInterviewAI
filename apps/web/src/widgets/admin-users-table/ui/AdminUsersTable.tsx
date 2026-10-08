"use client";

import { useAdminUsersControllerGetUsersList } from "@packages/api";
import { RedoIcon } from "@packages/icons";
import { Button, DataTable, type DataTableSortState } from "@packages/ui";
import { cn } from "@packages/utils";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUser, AdminUsersFilterParams } from "@/entities/admin-user";
import { UserDetailsDrawer } from "@/features/admin-user-details";
import { EditUserDialog } from "@/features/admin-user-edit";
import { ResetPasswordDialog } from "@/features/admin-user-reset-password";
import { ToggleStatusDialog } from "@/features/admin-user-status";
import { createAdminUsersColumns } from "./AdminUsersTableColumns";
import type { AdminUserActionType } from "./AdminUsersTableRowActions";

export interface AdminUsersTableProps {
  filters: AdminUsersFilterParams;
  onFilterChange: (next: Partial<AdminUsersFilterParams>) => void;
  className?: string;
}

export function AdminUsersTable({
  filters,
  onFilterChange,
  className,
}: AdminUsersTableProps) {
  const { t } = useTranslation("common");

  const [activeDialog, setActiveDialog] = useState<{
    type: AdminUserActionType;
    user: AdminUser;
  } | null>(null);

  // Fetch users with isDeleted: false by default to exclude soft-deleted users
  const {
    data: response,
    isLoading,
    isError,
    refetch,
  } = useAdminUsersControllerGetUsersList({
    page: filters.page,
    limit: filters.limit,
    search: filters.search,
    role: filters.role,
    isActive: filters.isActive,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    isDeleted: false,
  });

  const handleAction = useCallback(
    (type: AdminUserActionType, user: AdminUser) => {
      setActiveDialog({ type, user });
    },
    [],
  );

  const columns = useMemo(
    () => createAdminUsersColumns(t, handleAction),
    [t, handleAction],
  );

  const sortState: DataTableSortState | null = useMemo(() => {
    if (!filters.sortBy) return null;
    return {
      columnKey: filters.sortBy,
      direction: filters.sortOrder ?? "asc",
    };
  }, [filters.sortBy, filters.sortOrder]);

  const handleSortChange = (nextSort: DataTableSortState | null) => {
    if (!nextSort || !nextSort.direction) {
      onFilterChange({
        sortBy: undefined,
        sortOrder: undefined,
        page: 1,
      });
    } else {
      onFilterChange({
        sortBy: nextSort.columnKey as AdminUsersFilterParams["sortBy"],
        sortOrder: nextSort.direction,
        page: 1,
      });
    }
  };

  if (isError) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-8 rounded-lg border border-destructive/20 bg-destructive/5 text-center gap-3",
          className,
        )}
        data-testid="admin-users-table-error"
      >
        <p className="text-sm text-destructive font-medium">
          {t("admin.users.error.loadFailed")}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-1.5"
        >
          <RedoIcon className="size-3.5" />
          {t("admin.users.error.retry")}
        </Button>
      </div>
    );
  }

  const items = response?.items ?? [];
  const meta = response?.meta;

  return (
    <div className={cn("space-y-4", className)} data-testid="admin-users-table">
      <DataTable<AdminUser>
        columns={columns}
        data={items}
        loading={isLoading}
        searchable={false}
        emptyText={
          filters.search || filters.role || filters.isActive !== undefined
            ? t("admin.users.empty.noResults")
            : t("admin.users.empty.noUsers")
        }
        sortState={sortState}
        onSortChange={handleSortChange}
        pagination={{
          mode: "server",
          page: filters.page,
          pageSize: filters.limit,
          totalItems: meta?.total,
          totalPages: meta?.totalPages,
          showPageSizeSelect: true,
          pageSizeOptions: [10, 20, 50, 100],
          onPageChange: (nextPage) => onFilterChange({ page: nextPage }),
          onPageSizeChange: (nextLimit) =>
            onFilterChange({ limit: nextLimit, page: 1 }),
        }}
      />

      {/* Централизованные диалоги/Drawer во избежание DOM Bloat */}
      <EditUserDialog
        user={activeDialog?.user ?? null}
        open={activeDialog?.type === "edit"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      />

      <ToggleStatusDialog
        user={activeDialog?.user ?? null}
        open={activeDialog?.type === "status"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      />

      <ResetPasswordDialog
        user={activeDialog?.user ?? null}
        open={activeDialog?.type === "resetPassword"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      />

      <UserDetailsDrawer
        userId={activeDialog?.user?.id ?? null}
        open={activeDialog?.type === "details"}
        onOpenChange={(open) => !open && setActiveDialog(null)}
      />
    </div>
  );
}
