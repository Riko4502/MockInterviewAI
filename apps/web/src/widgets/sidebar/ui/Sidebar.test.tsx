import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paths } from "@/shared/config";
import { Sidebar } from "./Sidebar";

const isAdminMock = vi.hoisted(() => vi.fn(() => false));
vi.mock("@/entities/session", () => ({
  useIsAdmin: isAdminMock,
  useSession: () => null,
}));
afterEach(cleanup);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function renderSidebar(children: ReactNode) {
  return render(<Sidebar>{children}</Sidebar>, { wrapper: createWrapper() });
}

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
  usePreferences: () => ({
    theme: "light",
    resolvedTheme: "light",
    locale: "ru",
    toggleTheme: vi.fn(),
    changeTheme: vi.fn(),
    changeLocale: vi.fn(),
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
    window.localStorage.clear();
    usePathnameMock.mockReturnValue(paths.dashboard);
    logoutMock.mockClear();
    isAdminMock.mockReturnValue(false);

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

  it("открывает меню пользователя с настройками, настройками медиа и выходом", async () => {
    const user = userEvent.setup();

    renderSidebar(<h1>Контент дашборда</h1>);

    await user.click(screen.getByRole("button", { name: /Sarah Jenkins/i }));

    expect(screen.getByRole("menuitem", { name: "Настройки" })).toHaveAttribute(
      "href",
      paths.profile,
    );
    expect(
      screen.getByRole("menuitem", { name: "Настройки звука и видео" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Выйти" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Выйти" }));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("позволяет сворачивать и разворачивать группы навигации", async () => {
    const user = userEvent.setup();

    renderSidebar(<h1>Контент дашборда</h1>);

    const workspaceTrigger = screen.getByRole("button", {
      name: /Рабочее пространство/i,
    });
    expect(workspaceTrigger).toHaveAttribute("data-state", "open");
    expect(
      screen.getByRole("link", { name: "Панель управления" }),
    ).toBeInTheDocument();

    await user.click(workspaceTrigger);
    expect(workspaceTrigger).toHaveAttribute("data-state", "closed");

    await user.click(workspaceTrigger);
    expect(workspaceTrigger).toHaveAttribute("data-state", "open");
  });

  it("в свёрнутом виде сайдбара оставляет все пункты доступными, даже если группы были свернуты", async () => {
    const user = userEvent.setup();

    renderSidebar(<h1>Контент дашборда</h1>);

    const workspaceTrigger = screen.getByRole("button", {
      name: /Рабочее пространство/i,
    });
    await user.click(workspaceTrigger);
    expect(workspaceTrigger).toHaveAttribute("data-state", "closed");

    await user.click(
      document.querySelector('[data-slot="sidebar-trigger"]') as HTMLElement,
    );

    expect(
      screen.getByRole("link", { name: "Панель управления" }),
    ).toBeInTheDocument();
  });

  it("показывает администратору весь раздел администрирования", () => {
    isAdminMock.mockReturnValue(true);
    renderSidebar("Content");
    expect(screen.getByRole("link", { name: "Пользователи" })).toHaveAttribute(
      "href",
      paths.adminUsers,
    );
    expect(screen.getByText("Администрирование")).toBeInTheDocument();
  });

  it("скрывает раздел администрирования и пустые обёртки у обычного пользователя, в том числе после изменения доступа", () => {
    isAdminMock.mockReturnValue(true);
    const view = renderSidebar("Content");
    isAdminMock.mockReturnValue(false);
    view.rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <Sidebar>Content</Sidebar>
      </QueryClientProvider>,
    );
    expect(
      screen.queryByRole("link", { name: "Пользователи" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Администрирование")).not.toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="sidebar-separator"]'),
    ).toBeNull();
  });

  it("показывает локализованный значок администратора в меню пользователя", () => {
    isAdminMock.mockReturnValue(true);
    renderSidebar("Content");
    expect(screen.getByText("Администратор")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(screen.queryByText("ADMIN")).not.toBeInTheDocument();
  });

  it("не показывает значок администратора у обычного пользователя", () => {
    renderSidebar("Content");
    expect(screen.queryByText("Администратор")).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="badge"]')).toBeNull();
  });
});
