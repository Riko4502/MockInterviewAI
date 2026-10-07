import "@testing-library/jest-dom/vitest";
import {
  type DashboardReadinessResponseDto,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
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
import { DashboardReadinessChecklist } from "./DashboardReadinessChecklist";

const keys = [
  "EMAIL_PROVIDED",
  "MEDIA_CONFIGURED",
  "TELEGRAM_LINKED",
  "SHOWCASE_CREATED",
  "FIRST_MOCK_COMPLETED",
] as const;
function readiness(
  percentage: number,
  completed: readonly string[] = [],
): DashboardReadinessResponseDto {
  return {
    totalPercentage: percentage,
    isFullyReady: percentage === 100,
    steps: keys.map((key) => ({
      key,
      title: key,
      description: "",
      isCompleted: completed.includes(key),
      actionUrl: "/unused",
    })),
  };
}
let client: ReturnType<typeof createQueryClient>;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
});

describe("Список проверки готовности", () => {
  it("отображает серверные 0% и пять незавершённых шагов с корректной доступностью действий", async () => {
    const request = vi.fn(async () => readiness(0));
    setHttpTransport(async <T,>(): Promise<T> => (await request()) as T);
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    expect(
      await screen.findByRole("heading", {
        name: "Profile readiness for interviews: 0%",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    expect(screen.getAllByText("Incomplete")).toHaveLength(5);
    expect(
      screen.getByRole("button", { name: "Check camera and audio" }),
    ).toBeEnabled();
    for (const name of [
      "Confirm email",
      "Link Telegram",
      "Create a showcase profile",
    ]) {
      const action = screen.getByRole("button", { name });
      expect(action).toBeDisabled();
      expect(action).not.toHaveAttribute("aria-describedby");
    }
    expect(
      screen.getByRole("link", { name: "Take your first practice interview" }),
    ).toHaveAttribute("href", "/dashboard/sandbox");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("использует серверный процент и выделяет завершённые шаги без пересчёта", () => {
    client.setQueryData(
      DASHBOARD_KEYS.readiness(),
      readiness(37, ["EMAIL_PROVIDED", "MEDIA_CONFIGURED"]),
    );
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "37",
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("Completed")).toBeInTheDocument();
    expect(within(items[1]).queryByRole("button")).not.toBeInTheDocument();
    expect(within(items[2]).getByText("Incomplete")).toBeInTheDocument();
  });
  it("сворачивается при 100% и удаляет действия списка из дерева доступности", () => {
    client.setQueryData(DASHBOARD_KEYS.readiness(), readiness(100, keys));
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    expect(
      screen.getByRole("heading", { name: /100% ready/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Check camera and audio" }),
    ).not.toBeInTheDocument();
  });
  it("переходит в компактное состояние при полной готовности в кеше серверных данных", async () => {
    client.setQueryData(
      DASHBOARD_KEYS.readiness(),
      readiness(80, keys.slice(0, 4)),
    );
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    await act(async () => {
      client.setQueryData(DASHBOARD_KEYS.readiness(), readiness(100, keys));
    });
    await waitFor(() =>
      expect(screen.queryByRole("list")).not.toBeInTheDocument(),
    );
  });
  it("показывает скелетон во время ожидания ответа", () => {
    setHttpTransport(() => new Promise(() => {}));
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    expect(
      screen.getByRole("status", { name: "Loading profile readiness" }),
    ).toBeInTheDocument();
  });
  it("изолирует ошибки API и повторяет тот же запрос", async () => {
    const user = userEvent.setup();
    let failed = true;
    setHttpTransport(async <T,>(): Promise<T> => {
      if (failed) throw new Error("offline");
      return readiness(0) as T;
    });
    render(
      <>
        <button type="button">Other action</button>
        <DashboardReadinessChecklist />
      </>,
      { wrapper: Wrapper },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load profile readiness",
    );
    expect(screen.getByRole("button", { name: "Other action" })).toBeEnabled();
    failed = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: /0%/ }),
    ).toBeInTheDocument();
  });
  it("обрабатывает пустой список проверки с сервера", () => {
    client.setQueryData(DASHBOARD_KEYS.readiness(), {
      ...readiness(0),
      steps: [],
    });
    render(<DashboardReadinessChecklist />, { wrapper: Wrapper });
    expect(
      screen.getByText("The checklist is not available yet"),
    ).toBeInTheDocument();
  });
});
