import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/shared/config";
import { Sidebar } from "./Sidebar";

const renderSidebar = (children: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Sidebar>{children}</Sidebar>
    </QueryClientProvider>,
  );
};

const usePathnameMock = vi.fn(() => paths.dashboard);

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({
    data: {
      displayName: "Sarah Jenkins",
      email: "sarah@example.com",
      avatarUrl: null,
    },
    isLoading: false,
    isError: false,
  }),
  UserAvatar: () => <span>avatar</span>,
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth", () => ({
  useLogout: () => ({
    logout: logoutMock,
    isPending: false,
  }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue(paths.dashboard);
    logoutMock.mockClear();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  it("рендерит навигацию дашборда и контент страницы", () => {
    renderSidebar(<h1>Контент дашборда</h1>);

    expect(
      screen.getByRole("link", { name: "Панель управления" }),
    ).toHaveAttribute("href", paths.dashboard);
    expect(screen.getByRole("link", { name: "Интервью" })).toHaveAttribute(
      "href",
      paths.interviews,
    );
    expect(screen.getByRole("link", { name: "Уведомления" })).toHaveAttribute(
      "href",
      paths.notifications,
    );
    expect(screen.getByText("Sarah Jenkins")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Контент дашборда" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="sidebar-trigger"]'),
    ).toBeInTheDocument();
  });

  it("в свёрнутом режиме показывает только иконку логотипа", async () => {
    const user = userEvent.setup();

    renderSidebar(<h1>Контент дашборда</h1>);

    expect(screen.getByText("DEVSYNC")).toBeInTheDocument();

    await user.click(
      document.querySelector('[data-slot="sidebar-trigger"]') as HTMLElement,
    );

    expect(screen.queryByText("DEVSYNC")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "DEVSYNC Interview AI" }),
    ).toHaveAttribute("href", paths.dashboard);
  });

  it("открывает меню пользователя с профилем и выходом", async () => {
    const user = userEvent.setup();

    renderSidebar(<h1>Контент дашборда</h1>);

    await user.click(screen.getByRole("button", { name: /Sarah Jenkins/i }));

    expect(screen.getByRole("menuitem", { name: "Профиль" })).toHaveAttribute(
      "href",
      paths.profile,
    );
    expect(screen.getByRole("menuitem", { name: "Выйти" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Выйти" }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
