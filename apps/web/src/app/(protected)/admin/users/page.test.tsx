import { ToastProvider } from "@packages/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./page";

const mockSetFilters = vi.fn();
const mockResetFilters = vi.fn();

vi.mock("@/features/admin-users-filter", () => ({
  useAdminUsersFilterState: () => ({
    filters: { page: 1, limit: 10 },
    setFilters: mockSetFilters,
    resetFilters: mockResetFilters,
    hasActiveFilters: false,
  }),
  AdminUsersFilter: () => <div data-testid="mock-users-filter">Filter</div>,
}));

vi.mock("@/widgets/admin-users-table", () => ({
  AdminUsersTable: () => <div data-testid="mock-users-table">Table</div>,
}));

vi.mock("@packages/api", () => ({
  useAdminUsersControllerCreateUser: () => ({
    mutateAsync: vi.fn(),
  }),
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          "admin.users.title": "Управление пользователями",
          "admin.users.description":
            "Просмотр, создание и администрирование учётных записей пользователей",
          "admin.users.addUser": "Добавить пользователя",
          "admin.users.createModal.title": "Добавить нового пользователя",
        };
        return translations[key] ?? key;
      },
    }),
  };
});

describe("AdminUsersPage", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AdminUsersPage />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it("renders page title, subtitle, filter toolbar, and table", () => {
    renderPage();

    expect(screen.getByText("Управление пользователями")).toBeDefined();
    expect(
      screen.getByText(
        "Просмотр, создание и администрирование учётных записей пользователей",
      ),
    ).toBeDefined();
    expect(screen.getByTestId("mock-users-filter")).toBeDefined();
    expect(screen.getByTestId("mock-users-table")).toBeDefined();
  });

  it("opens create user dialog when clicking Add User button", () => {
    renderPage();

    const addBtn = screen.getByTestId("admin-add-user-btn");
    fireEvent.click(addBtn);

    expect(screen.getByText("Добавить нового пользователя")).toBeDefined();
  });
});
