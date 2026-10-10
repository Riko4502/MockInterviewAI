import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUsersFilter } from "./AdminUsersFilter";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.filters.searchPlaceholder": "Поиск по имени...",
          "admin.users.roles.all": "Все роли",
          "admin.users.roles.admin": "Администратор",
          "admin.users.roles.user": "Пользователь",
          "admin.users.statuses.all": "Все статусы",
          "admin.users.statuses.active": "Активен",
          "admin.users.statuses.deactivated": "Деактивирован",
          "admin.users.filters.reset": "Сбросить фильтры",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("AdminUsersFilter", () => {
  const defaultProps = {
    filters: {
      page: 1,
      limit: 10,
    },
    onSearchChange: vi.fn(),
    onRoleChange: vi.fn(),
    onStatusChange: vi.fn(),
    onReset: vi.fn(),
    hasActiveFilters: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders search input, role select, and status select", () => {
    render(<AdminUsersFilter {...defaultProps} />);

    expect(screen.getByTestId("admin-users-search-input")).toBeDefined();
    expect(screen.getByTestId("admin-users-role-select")).toBeDefined();
    expect(screen.getByTestId("admin-users-status-select")).toBeDefined();
    expect(screen.queryByTestId("admin-users-reset-btn")).toBeNull();
  });

  it("calls onSearchChange with 300ms debounce when input changes", () => {
    render(<AdminUsersFilter {...defaultProps} />);

    const searchInput = screen.getByTestId("admin-users-search-input");
    fireEvent.change(searchInput, { target: { value: "john" } });

    // Should not be called immediately
    expect(defaultProps.onSearchChange).not.toHaveBeenCalled();

    // Advance timers by 299ms - still not called
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(defaultProps.onSearchChange).not.toHaveBeenCalled();

    // Advance 1ms more (total 300ms) - should be called
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith("john");
  });

  it("renders reset button when hasActiveFilters is true and handles click", () => {
    render(
      <AdminUsersFilter
        {...defaultProps}
        hasActiveFilters={true}
        filters={{ page: 1, limit: 10, search: "test" }}
      />,
    );

    const resetBtn = screen.getByTestId("admin-users-reset-btn");
    expect(resetBtn).toBeDefined();

    fireEvent.click(resetBtn);
    expect(defaultProps.onReset).toHaveBeenCalledTimes(1);
  });

  it("does not call onSearchChange if value matches current filters.search", () => {
    render(
      <AdminUsersFilter
        {...defaultProps}
        filters={{ page: 1, limit: 10, search: "john" }}
      />,
    );

    const searchInput = screen.getByTestId("admin-users-search-input");
    // Type same value (or trimmed same value)
    fireEvent.change(searchInput, { target: { value: "john " } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(defaultProps.onSearchChange).not.toHaveBeenCalled();
  });
});
