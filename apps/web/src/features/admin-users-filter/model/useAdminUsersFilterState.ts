"use client";

import { SystemRole } from "@packages/types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { AdminUsersFilterParams } from "@/entities/admin-user";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

export function useAdminUsersFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: AdminUsersFilterParams = useMemo(() => {
    const pageParam = Number(searchParams.get("page"));
    const limitParam = Number(searchParams.get("limit"));
    const rawSearch = searchParams.get("search");
    const rawRole = searchParams.get("role");
    const rawStatus = searchParams.get("isActive");
    const rawSortBy = searchParams.get("sortBy");
    const rawSortOrder = searchParams.get("sortOrder");

    const page =
      Number.isInteger(pageParam) && pageParam > 0 ? pageParam : DEFAULT_PAGE;
    const limit =
      Number.isInteger(limitParam) && limitParam > 0
        ? limitParam
        : DEFAULT_LIMIT;

    const role =
      rawRole === SystemRole.ADMIN || rawRole === SystemRole.USER
        ? (rawRole as SystemRole)
        : undefined;

    const isActive =
      rawStatus === "true" ? true : rawStatus === "false" ? false : undefined;

    const sortBy =
      rawSortBy === "username" ||
      rawSortBy === "email" ||
      rawSortBy === "role" ||
      rawSortBy === "createdAt"
        ? rawSortBy
        : undefined;

    const sortOrder =
      rawSortOrder === "asc" || rawSortOrder === "desc"
        ? rawSortOrder
        : undefined;

    return {
      page,
      limit,
      search: rawSearch?.trim() ? rawSearch.trim() : undefined,
      role,
      isActive,
      sortBy,
      sortOrder,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (next: Partial<AdminUsersFilterParams>) => {
      const merged: AdminUsersFilterParams = {
        ...filters,
        ...next,
      };

      const params = new URLSearchParams();

      if (merged.page > DEFAULT_PAGE) {
        params.set("page", String(merged.page));
      }
      if (merged.limit !== DEFAULT_LIMIT) {
        params.set("limit", String(merged.limit));
      }
      if (merged.search?.trim()) {
        params.set("search", merged.search.trim());
      }
      if (merged.role) {
        params.set("role", merged.role);
      }
      if (merged.isActive !== undefined) {
        params.set("isActive", String(merged.isActive));
      }
      if (merged.sortBy) {
        params.set("sortBy", merged.sortBy);
      }
      if (merged.sortOrder) {
        params.set("sortOrder", merged.sortOrder);
      }

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(targetUrl, { scroll: false });
    },
    [filters, pathname, router],
  );

  const resetFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.search ||
        filters.role ||
        filters.isActive !== undefined ||
        filters.sortBy ||
        filters.sortOrder ||
        filters.page > DEFAULT_PAGE ||
        filters.limit !== DEFAULT_LIMIT,
    );
  }, [filters]);

  return {
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
  };
}
