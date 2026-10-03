import "@testing-library/jest-dom/vitest";
import {
  type DailyChallengeResponseDto,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { DailyChallengeCountdown } from "./DailyChallengeCountdown";
import { DashboardDailyChallenge } from "./DashboardDailyChallenge";

const challenge: DailyChallengeResponseDto = {
  problemId: "two-sum",
  title: "Two Sum",
  difficulty: "EASY",
  tags: ["Array", "Hash Table"],
  timeUntilResetSeconds: 3661,
  isSolvedToday: false,
  solvedAt: null,
  pointsReward: 50,
};
let client: QueryClient;

beforeEach(() => {
  vi.useRealTimers();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  setHttpTransport(async <T,>(): Promise<T> => challenge as T);
});

afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
  vi.useRealTimers();
});

function renderWidget() {
  return render(
    <QueryClientProvider client={client}>
      <DashboardDailyChallenge />
    </QueryClientProvider>,
  );
}

describe("Задача дня (DashboardDailyChallenge)", () => {
  it("отображает нерешённую задачу, баллы награды и полученные с сервера теги", async () => {
    renderWidget();
    expect(
      await screen.findByRole("heading", { name: "Two Sum" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Array")).toBeInTheDocument();
    expect(screen.getByText("Hash Table")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("+50 XP");
  });

  it("переходит в песочницу с фактическим problemId", async () => {
    renderWidget();
    const link = await screen.findByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "/dashboard/sandbox?problemId=two-sum",
    );
  });

  it("показывает решённое состояние и убирает действие повторного получения награды", async () => {
    setHttpTransport(
      async <T,>(): Promise<T> =>
        ({
          ...challenge,
          isSolvedToday: true,
          solvedAt: "2026-10-01T08:00:00Z",
        }) as T,
    );
    renderWidget();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    ["EASY", "text-chart-3"],
    ["MEDIUM", "text-chart-4"],
    ["HARD", "text-chart-5"],
  ] as const)("сопоставляет сложность %s с соответствующей семантической меткой", async (difficulty, colorClass) => {
    setHttpTransport(
      async <T,>(): Promise<T> => ({ ...challenge, difficulty }) as T,
    );
    const { container } = renderWidget();
    await screen.findByRole("heading", { name: "Two Sum" });
    const badges = [...container.querySelectorAll('[data-slot="badge"]')];
    expect(badges.some((badge) => badge.classList.contains(colorClass))).toBe(
      true,
    );
  });

  it("показывает стабильный скелетон загрузки и изолированную ошибку с повторной попыткой", async () => {
    setHttpTransport(() => new Promise(() => {}));
    const { container, unmount } = renderWidget();
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      5,
    );
    unmount();
    client.clear();
    let fail = true;
    setHttpTransport(async <T,>(): Promise<T> => {
      if (fail) throw new Error("offline");
      return challenge as T;
    });
    renderWidget();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fail = false;
    await act(async () => {
      await client.refetchQueries({
        queryKey: DASHBOARD_KEYS.dailyChallenge(),
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Two Sum" }),
    ).toBeInTheDocument();
  });

  it("обновляет запрос задачи дня по истечении заданного сервером времени", async () => {
    vi.useFakeTimers();
    client.setQueryData(DASHBOARD_KEYS.dailyChallenge(), {
      ...challenge,
      timeUntilResetSeconds: 1,
    });
    const request = vi.fn(async <T,>(): Promise<T> => challenge as T);
    setHttpTransport(async <T,>(): Promise<T> => request() as Promise<T>);
    renderWidget();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(DASHBOARD_KEYS.dailyChallenge())).toEqual(
      challenge,
    );
    expect(
      client.getQueryState(DASHBOARD_KEYS.dailyChallenge())?.isInvalidated,
    ).toBe(false);
  });
});

describe("Обратный отсчёт задачи дня (DailyChallengeCountdown)", () => {
  it("считает до нуля с подменёнными таймерами, однократно сообщает об истечении времени и очищает интервал", async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { unmount } = render(
      <DailyChallengeCountdown
        seconds={2}
        label="Reset in:"
        onExpire={onExpire}
      />,
    );
    expect(screen.getByText("00:00:02")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("00:00:01")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("форматирует длительность свыше 24 часов без сброса часов", () => {
    render(
      <DailyChallengeCountdown
        seconds={90061}
        label="Reset in:"
        onExpire={vi.fn()}
      />,
    );
    expect(screen.getByText("25:01:01")).toBeInTheDocument();
  });
});
