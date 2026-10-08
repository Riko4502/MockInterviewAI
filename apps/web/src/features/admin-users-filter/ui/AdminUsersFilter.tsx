"use client";

import { CloseIcon, SearchIcon } from "@packages/icons";
import { SystemRole } from "@packages/types";
import { Button, Input, Select } from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUsersFilterParams } from "@/entities/admin-user";

export interface AdminUsersFilterProps {
  filters: AdminUsersFilterParams;
  onSearchChange: (search: string | undefined) => void;
  onRoleChange: (role: SystemRole | undefined) => void;
  onStatusChange: (isActive: boolean | undefined) => void;
  onReset: () => void;
  hasActiveFilters?: boolean;
  className?: string;
}

export function AdminUsersFilter({
  filters,
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onReset,
  hasActiveFilters = false,
  className,
}: AdminUsersFilterProps) {
  const { t } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState(filters.search ?? "");
  const isFirstMount = useRef(true);

  // Sync external search changes (e.g. from reset)
  useEffect(() => {
    setSearchTerm(filters.search ?? "");
  }, [filters.search]);

  // Debounced search trigger (300ms)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      onSearchChange(trimmed ? trimmed : undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange]);

  const roleValue = filters.role ?? "ALL";
  const statusValue =
    filters.isActive === true
      ? "active"
      : filters.isActive === false
        ? "deactivated"
        : "ALL";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap",
        className,
      )}
      data-testid="admin-users-filter"
    >
      <div className="flex flex-1 items-center gap-2 min-w-[240px] max-w-md relative">
        <div className="relative w-full">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
            placeholder={t("admin.users.filters.searchPlaceholder")}
            className="pl-9 h-9 text-sm bg-card border-border/80"
            data-testid="admin-users-search-input"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Фильтр: Роль */}
        <Select
          value={roleValue}
          onValueChange={(val) =>
            onRoleChange(val === "ALL" ? undefined : (val as SystemRole))
          }
        >
          <Select.Trigger
            className="w-[150px] h-9 text-xs bg-card border-border/80"
            data-testid="admin-users-role-select"
          >
            <Select.Value placeholder={t("admin.users.filters.allRoles")} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="ALL">
              {t("admin.users.filters.allRoles")}
            </Select.Item>
            <Select.Item value={SystemRole.ADMIN}>
              {t("admin.users.roles.ADMIN")}
            </Select.Item>
            <Select.Item value={SystemRole.USER}>
              {t("admin.users.roles.USER")}
            </Select.Item>
          </Select.Content>
        </Select>

        {/* Фильтр: Статус */}
        <Select
          value={statusValue}
          onValueChange={(val) =>
            onStatusChange(
              val === "active"
                ? true
                : val === "deactivated"
                  ? false
                  : undefined,
            )
          }
        >
          <Select.Trigger
            className="w-[170px] h-9 text-xs bg-card border-border/80"
            data-testid="admin-users-status-select"
          >
            <Select.Value placeholder={t("admin.users.filters.allStatuses")} />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="ALL">
              {t("admin.users.filters.allStatuses")}
            </Select.Item>
            <Select.Item value="active">
              {t("admin.users.filters.activeOnly")}
            </Select.Item>
            <Select.Item value="deactivated">
              {t("admin.users.filters.deactivatedOnly")}
            </Select.Item>
          </Select.Content>
        </Select>

        {/* Кнопка сброса */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="h-9 text-xs gap-1.5 border-dashed"
            data-testid="admin-users-reset-btn"
          >
            <CloseIcon className="size-3.5" />
            {t("admin.users.filters.reset")}
          </Button>
        )}
      </div>
    </div>
  );
}
