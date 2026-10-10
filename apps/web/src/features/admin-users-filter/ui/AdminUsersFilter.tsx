"use client";

import { CloseIcon, SearchIcon } from "@packages/icons";
import { SystemRole } from "@packages/types";
import {
  Button,
  Input,
  InputGroup,
  Select,
  type SelectOption,
} from "@packages/ui";
import { cn } from "@packages/utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminUsersFilterParams } from "@/entities/admin-user";

const ROLE_FILTER_CONFIG = [
  { value: "ALL", labelKey: "admin.users.roles.all" },
  { value: SystemRole.ADMIN, labelKey: "admin.users.roles.admin" },
  { value: SystemRole.USER, labelKey: "admin.users.roles.user" },
] as const;

const STATUS_FILTER_CONFIG = [
  { value: "ALL", labelKey: "admin.users.statuses.all" },
  { value: "active", labelKey: "admin.users.statuses.active" },
  { value: "deactivated", labelKey: "admin.users.statuses.deactivated" },
] as const;

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
      const next = trimmed ? trimmed : undefined;
      if (next !== filters.search) {
        onSearchChange(next);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearchChange, filters.search]);

  const roleValue = filters.role ?? "ALL";
  const statusValue =
    filters.isActive === true
      ? "active"
      : filters.isActive === false
        ? "deactivated"
        : "ALL";

  const roleOptions: SelectOption[] = useMemo(
    () =>
      ROLE_FILTER_CONFIG.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t],
  );

  const statusOptions: SelectOption[] = useMemo(
    () =>
      STATUS_FILTER_CONFIG.map((opt) => ({
        value: opt.value,
        label: t(opt.labelKey),
      })),
    [t],
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between flex-wrap",
        className,
      )}
      data-testid="admin-users-filter"
    >
      <div className="flex flex-1 items-center gap-2 min-w-[240px] max-w-md">
        <InputGroup>
          <InputGroup.Prefix>
            <SearchIcon />
          </InputGroup.Prefix>
          <Input
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
            placeholder={t("admin.users.filters.searchPlaceholder")}
            className="h-9 text-sm bg-card border-border/80"
            data-testid="admin-users-search-input"
          />
        </InputGroup>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Фильтр: Роль */}
        <Select
          value={roleValue}
          onValueChange={(val) =>
            onRoleChange(val === "ALL" ? undefined : (val as SystemRole))
          }
          placeholder={t("admin.users.roles.all")}
          options={roleOptions}
          triggerClassName="w-[150px] h-9 text-xs bg-card border-border/80"
          data-testid="admin-users-role-select"
        />

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
          placeholder={t("admin.users.statuses.all")}
          options={statusOptions}
          triggerClassName="w-[170px] h-9 text-xs bg-card border-border/80"
          data-testid="admin-users-status-select"
        />

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
