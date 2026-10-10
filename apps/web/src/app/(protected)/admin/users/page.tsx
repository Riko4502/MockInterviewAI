"use client";

import { PlusIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateUserDialog } from "@/features/admin-user-create";
import {
  AdminUsersFilter,
  useAdminUsersFilterState,
} from "@/features/admin-users-filter";
import { AdminUsersTable } from "@/widgets/admin-users-table";

export default function AdminUsersPage() {
  const { t } = useTranslation("common");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { filters, setFilters, resetFilters, hasActiveFilters } =
    useAdminUsersFilterState();

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("admin.users.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.users.description")}
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="gap-2 shrink-0"
          data-testid="admin-add-user-btn"
        >
          <PlusIcon className="size-4" />
          {t("admin.users.addUser")}
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-xs backdrop-blur-xs">
        <AdminUsersFilter
          filters={filters}
          onSearchChange={(search) => setFilters({ search, page: 1 })}
          onRoleChange={(role) => setFilters({ role, page: 1 })}
          onStatusChange={(isActive) => setFilters({ isActive, page: 1 })}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
        />
      </div>

      {/* Users Table */}
      <AdminUsersTable filters={filters} onFilterChange={setFilters} />

      {/* Create User Dialog */}
      <CreateUserDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
