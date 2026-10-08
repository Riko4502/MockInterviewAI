import { SystemRole } from "@packages/types";
import { act, renderHook } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminUsersFilterState } from "./useAdminUsersFilterState";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

describe("useAdminUsersFilterState", () => {
  const mockReplace = vi.fn();
  let searchParamsStore: URLSearchParams;

  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsStore = new URLSearchParams();

    vi.mocked(useRouter).mockReturnValue({
      replace: mockReplace,
    } as unknown as ReturnType<typeof useRouter>);

    vi.mocked(usePathname).mockReturnValue("/admin/users");

    vi.mocked(useSearchParams).mockImplementation(
      () => searchParamsStore as unknown as ReturnType<typeof useSearchParams>,
    );
  });

  it("returns default filters when URL params are empty", () => {
    const { result } = renderHook(() => useAdminUsersFilterState());

    expect(result.current.filters).toEqual({
      page: 1,
      limit: 10,
      search: undefined,
      role: undefined,
      isActive: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("parses valid URL params correctly", () => {
    searchParamsStore.set("page", "2");
    searchParamsStore.set("limit", "25");
    searchParamsStore.set("search", "alice");
    searchParamsStore.set("role", SystemRole.ADMIN);
    searchParamsStore.set("isActive", "true");
    searchParamsStore.set("sortBy", "email");
    searchParamsStore.set("sortOrder", "desc");

    const { result } = renderHook(() => useAdminUsersFilterState());

    expect(result.current.filters).toEqual({
      page: 2,
      limit: 25,
      search: "alice",
      role: SystemRole.ADMIN,
      isActive: true,
      sortBy: "email",
      sortOrder: "desc",
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("handles isActive=false and invalid params gracefully", () => {
    searchParamsStore.set("isActive", "false");
    searchParamsStore.set("role", "INVALID_ROLE");
    searchParamsStore.set("page", "-5");
    searchParamsStore.set("limit", "abc");

    const { result } = renderHook(() => useAdminUsersFilterState());

    expect(result.current.filters.isActive).toBe(false);
    expect(result.current.filters.role).toBeUndefined();
    expect(result.current.filters.page).toBe(1);
    expect(result.current.filters.limit).toBe(10);
  });

  it("updates URL with { scroll: false } and omits default parameters", () => {
    const { result } = renderHook(() => useAdminUsersFilterState());

    act(() => {
      result.current.setFilters({
        search: "bob",
        role: SystemRole.USER,
        page: 2,
      });
    });

    expect(mockReplace).toHaveBeenCalledWith(
      "/admin/users?page=2&search=bob&role=USER",
      { scroll: false },
    );
  });

  it("cleans up URL when parameters return to defaults", () => {
    searchParamsStore.set("search", "bob");
    searchParamsStore.set("page", "2");

    const { result } = renderHook(() => useAdminUsersFilterState());

    act(() => {
      result.current.setFilters({
        search: undefined,
        page: 1,
      });
    });

    expect(mockReplace).toHaveBeenCalledWith("/admin/users", { scroll: false });
  });

  it("resets all filters using resetFilters() with { scroll: false }", () => {
    searchParamsStore.set("search", "bob");
    searchParamsStore.set("page", "3");

    const { result } = renderHook(() => useAdminUsersFilterState());

    act(() => {
      result.current.resetFilters();
    });

    expect(mockReplace).toHaveBeenCalledWith("/admin/users", { scroll: false });
  });
});
