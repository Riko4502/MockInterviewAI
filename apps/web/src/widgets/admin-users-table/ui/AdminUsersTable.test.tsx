import { ToastProvider } from "@packages/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminUser } from "@/entities/admin-user";
import { AdminUsersTable } from "./AdminUsersTable";

const mockUsersList: AdminUser[] = [
  {
    id: "user-1",
    email: "user1@example.com",
    role: "USER",
    isActive: true,
    displayName: "User One",
    username: "user1",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
    deactivatedAt: null,
    deletedAt: null,
  },
  {
    id: "user-2",
    email: "admin2@example.com",
    role: "ADMIN",
    isActive: false,
    displayName: "Admin Two",
    username: "admin2",
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-03-02T10:00:00.000Z",
    updatedAt: "2026-03-02T10:00:00.000Z",
    deactivatedAt: "2026-03-05T10:00:00.000Z",
    deletedAt: null,
  },
];

let mockUsersResponse: {
  items: AdminUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
} | null = {
  items: mockUsersList,
  meta: {
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

let mockIsLoading = false;
let mockIsError = false;
const mockRefetch = vi.fn();
let capturedQueryParams: Record<string, unknown> = {};

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useAdminUsersControllerGetUsersList: (params: Record<string, unknown>) => {
      capturedQueryParams = params;
      return {
        data: mockUsersResponse,
        isLoading: mockIsLoading,
        isError: mockIsError,
        refetch: mockRefetch,
      };
    },
    useAdminUsersControllerGetUserById: () => ({
      data: null,
      isLoading: false,
      isError: false,
    }),
  };
});

vi.mock("@/entities/session", () => ({
  useSession: () => ({
    userId: "admin-master",
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.columns.user": "Пользователь",
          "admin.users.columns.email": "Email",
          "admin.users.columns.role": "Роль",
          "admin.users.columns.status": "Статус",
          "admin.users.columns.createdAt": "Дата регистрации",
          "admin.users.columns.actions": "Действия",
          "admin.users.roles.admin": "Администратор",
          "admin.users.roles.user": "Пользователь",
          "admin.users.roles.ADMIN": "Администратор",
          "admin.users.roles.USER": "Пользователь",
          "admin.users.statuses.active": "Активен",
          "admin.users.statuses.deactivated": "Деактивирован",
          "admin.users.error.loadFailed": "Не удалось загрузить пользователей",
          "admin.users.error.retry": "Повторить попытку",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("AdminUsersTable", () => {
  const defaultFilters = {
    page: 1,
    limit: 10,
  };
  const onFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockUsersResponse = {
      items: mockUsersList,
      meta: {
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderTable = (props: {
    filters: typeof defaultFilters;
    onFilterChange: typeof onFilterChange;
  }) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AdminUsersTable {...props} />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it("passes isDeleted: false by default to exclude soft-deleted users", () => {
    renderTable({
      filters: defaultFilters,
      onFilterChange: onFilterChange,
    });

    expect(capturedQueryParams.isDeleted).toBe(false);
  });

  it("renders rows and user information correctly", () => {
    renderTable({
      filters: defaultFilters,
      onFilterChange: onFilterChange,
    });

    expect(screen.getByText("user1@example.com")).toBeDefined();
    expect(screen.getByText("User One")).toBeDefined();
    expect(screen.getByText("admin2@example.com")).toBeDefined();
    expect(screen.getByText("Admin Two")).toBeDefined();
    expect(screen.getByText("Активен")).toBeDefined();
    expect(screen.getByText("Деактивирован")).toBeDefined();
  });

  it("renders error state with retry button when query fails", () => {
    mockIsError = true;
    renderTable({
      filters: defaultFilters,
      onFilterChange: onFilterChange,
    });

    expect(screen.getByTestId("admin-users-table-error")).toBeDefined();
    expect(
      screen.getByText("Не удалось загрузить пользователей"),
    ).toBeDefined();

    const retryBtn = screen.getByText("Повторить попытку");
    fireEvent.click(retryBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("renders pagination controls and handles page change based on response.meta", () => {
    mockUsersResponse = {
      items: mockUsersList,
      meta: {
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: false,
      },
    };

    renderTable({
      filters: defaultFilters,
      onFilterChange: onFilterChange,
    });

    expect(screen.getByText("25")).toBeDefined();
    const nextBtn = screen.getByLabelText("Перейти на следующую страницу");
    fireEvent.click(nextBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ page: 2 });
  });
});
