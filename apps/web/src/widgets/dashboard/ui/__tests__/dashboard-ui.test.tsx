import "@testing-library/jest-dom/vitest";
import {
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query/query-client";
import i18n from "@/shared/lib/i18n";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { DashboardHero } from "../hero/DashboardHero";
import { LiveMatchControl } from "../hero/LiveMatchControl";
import { DashboardQuickActions } from "../quick-actions/DashboardQuickActions";

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => routerMock,
}));

vi.mock("@/entities/user", () => ({
  useCurrentUser: () => ({ data: { displayName: "Ada" }, isError: false }),
}));

let client: ReturnType<typeof createQueryClient>;
let request: (config: RequestConfig) => Promise<unknown>;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  client = createQueryClient();
  request = vi.fn(async () => ({ status: "IDLE" }));
  setHttpTransport(
    async <T,>(config: RequestConfig): Promise<T> =>
      (await request(config)) as T,
  );
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
  vi.useRealTimers();
  routerMock.push.mockClear();
  vi.restoreAllMocks();
});

describe("Интерфейс дашборда", () => {
  it("использует текущий профиль и отображает целевые метки без GET-запросов дашборда", () => {
    render(
      <DashboardHero targetSpecialization="FRONTEND" targetLevel="JUNIOR" />,
      { wrapper: Wrapper },
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Ada");
    expect(screen.getAllByText("Frontend").length).toBeGreaterThan(0);
    expect(request).not.toHaveBeenCalled();
  });

  it("требует явных параметров очереди и отображает неизвестное состояние", () => {
    render(<LiveMatchControl />, { wrapper: Wrapper });
    expect(
      screen.getByRole("switch", { name: "Instant partner search" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Search status unknown",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("поддерживает переключение с клавиатуры, состояние ожидания и откат оптимистического обновления", async () => {
    const user = userEvent.setup();
    let rejectRequest: (error: Error) => void = () => {};
    request = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    render(
      <LiveMatchControl targetSpecialization="FRONTEND" targetLevel="JUNIOR" />,
      { wrapper: Wrapper },
    );
    const toggle = screen.getByRole("switch", {
      name: "Instant partner search",
    });
    toggle.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(toggle).toBeChecked());
    expect(toggle).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Searching for a partner",
    );
    expect(screen.queryByText("Partner found")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => {
      rejectRequest(new Error("offline"));
    });
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(toggle).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not change partner search",
    );
    expect(
      client.getQueryData(DASHBOARD_KEYS.liveMatchParameters()),
    ).toBeNull();
  });

  it("останавливает активный поиск после повторного монтирования с исходными параметрами очереди", async () => {
    const user = userEvent.setup();
    client.setQueryData(DASHBOARD_KEYS.liveMatch(), { status: "SEARCHING" });
    client.setQueryData(DASHBOARD_KEYS.liveMatchParameters(), {
      specialization: "BACKEND",
      level: "SENIOR",
    });
    render(<LiveMatchControl />, { wrapper: Wrapper });
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    await user.click(toggle);
    await waitFor(() => expect(toggle).not.toBeChecked());
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/dashboard/live-match/toggle",
        data: {
          isSearching: false,
          specialization: "BACKEND",
          level: "SENIOR",
        },
      }),
    );
  });

  it("\u043f\u0440\u0438 \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0438 \u043f\u043e\u0438\u0441\u043a\u0430 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u044f\u0435\u0442 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0438 \u043e\u0431\u0440\u0430\u0431\u0430\u0442\u044b\u0432\u0430\u0435\u0442 MATCHED", async () => {
    await i18n.changeLanguage("ru");
    vi.useFakeTimers();
    const sessionId = "11111111-1111-4111-8111-111111111111";
    request = vi.fn(async () => ({ status: "MATCHED", sessionId }));
    render(
      <LiveMatchControl targetSpecialization="FRONTEND" targetLevel="JUNIOR" />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole("switch"));
    await act(async () => {
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/dashboard/live-match/toggle",
        data: {
          isSearching: true,
          specialization: "FRONTEND",
          level: "JUNIOR",
        },
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "\u0421\u043e\u0431\u0435\u0441\u0435\u0434\u043d\u0438\u043a \u043d\u0430\u0439\u0434\u0435\u043d!",
    });
    expect(dialog).toHaveTextContent(
      "\u041f\u0435\u0440\u0435\u0445\u043e\u0434 \u0432 \u043f\u0435\u0441\u043e\u0447\u043d\u0438\u0446\u0443 \u0447\u0435\u0440\u0435\u0437 3 \u0441\u0435\u043a",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(dialog).toHaveTextContent(
      "\u041f\u0435\u0440\u0435\u0445\u043e\u0434 \u0432 \u043f\u0435\u0441\u043e\u0447\u043d\u0438\u0446\u0443 \u0447\u0435\u0440\u0435\u0437 2 \u0441\u0435\u043a",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(dialog).toHaveTextContent(
      "\u041f\u0435\u0440\u0435\u0445\u043e\u0434 \u0432 \u043f\u0435\u0441\u043e\u0447\u043d\u0438\u0446\u0443 \u0447\u0435\u0440\u0435\u0437 1 \u0441\u0435\u043a",
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(
      `/dashboard/sandbox?room=${sessionId}`,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(routerMock.push).toHaveBeenCalledTimes(1);
  });

  it("\u043f\u0440\u0438 SEARCHING \u043d\u0435 \u043f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0435\u0442 \u043d\u0430\u0439\u0434\u0435\u043d\u043d\u0443\u044e \u043f\u0430\u0440\u0443 \u0438 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442 \u043f\u0435\u0440\u0435\u0445\u043e\u0434", async () => {
    const user = userEvent.setup();
    request = vi.fn(async () => ({
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    }));
    render(
      <LiveMatchControl targetSpecialization="FRONTEND" targetLevel="JUNIOR" />,
      { wrapper: Wrapper },
    );
    await user.click(screen.getByRole("switch"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Searching for a partner",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("\u043f\u043e\u0441\u043b\u0435 \u0440\u0430\u0437\u043c\u043e\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f \u043e\u0447\u0438\u0449\u0430\u0435\u0442 \u0442\u0430\u0439\u043c\u0435\u0440 \u0438 \u043d\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442 \u043f\u0435\u0440\u0435\u0445\u043e\u0434", async () => {
    vi.useFakeTimers();
    request = vi.fn(async () => ({
      status: "MATCHED",
      sessionId: "22222222-2222-4222-8222-222222222222",
    }));
    const view = render(
      <LiveMatchControl targetSpecialization="FRONTEND" targetLevel="JUNIOR" />,
      { wrapper: Wrapper },
    );
    fireEvent.click(screen.getByRole("switch"));
    await act(async () => {
      for (let index = 0; index < 10; index += 1) await Promise.resolve();
    });
    screen.getByRole("dialog", { name: "Partner found!" });
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(routerMock.push).not.toHaveBeenCalled();
  });
  it("быстрые действия не требуют провайдера запросов или API и используют заданные маршруты", () => {
    render(<DashboardQuickActions />);
    expect(
      screen.getByRole("link", { name: /Find a partner/ }),
    ).toHaveAttribute("href", "/dashboard#live-match");
    expect(screen.getByRole("link", { name: /Code sandbox/ })).toHaveAttribute(
      "href",
      "/dashboard/sandbox",
    );
    expect(screen.getByRole("button", { name: /AI interview/ })).toBeEnabled();
    expect(request).not.toHaveBeenCalled();
  });

  it("открывает лениво загружаемый диалог, удерживает фокус, поддерживает выбор, блокирует недоступный запуск и восстанавливает фокус", async () => {
    const user = userEvent.setup();
    render(<DashboardQuickActions />);
    const trigger = screen.getByRole("button", { name: /AI interview/ });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", {
      name: "Quick AI interview",
    });
    const topic = await screen.findByRole("combobox", { name: "Topic" });
    await user.click(topic);
    await user.click(await screen.findByRole("option", { name: "Algorithms" }));
    expect(topic).toHaveTextContent("Algorithms");
    await user.click(screen.getByRole("combobox", { name: "Difficulty" }));
    await user.click(await screen.findByRole("option", { name: "Easy" }));
    expect(
      screen.getByRole("button", { name: "Start interview" }),
    ).toBeDisabled();
    const close = within(dialog).getByRole("button", { name: "Close" });
    close.focus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(request).not.toHaveBeenCalled();
  });

  it("обновляет переводы быстрых действий при смене локали", async () => {
    render(<DashboardQuickActions />);
    await act(async () => {
      await i18n.changeLanguage("ru");
    });
    expect(
      screen.getByRole("link", { name: /Песочница кода/ }),
    ).toBeInTheDocument();
  });
});
