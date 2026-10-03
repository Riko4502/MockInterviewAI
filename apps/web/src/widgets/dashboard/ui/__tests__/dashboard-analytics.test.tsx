import "@testing-library/jest-dom/vitest";
import {
  type DashboardInsightsResponseDto,
  type DashboardStatsResponseDto,
  type RecentSessionsResponseDto,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { getPracticeHref } from "../../lib/get-practice-href";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { DashboardAiInsights } from "../analytics/DashboardAiInsights";
import { DashboardRecentSessions } from "../analytics/DashboardRecentSessions";
import { DashboardStatsGrid } from "../analytics/DashboardStatsGrid";
import { DashboardPageError } from "../layout/DashboardPageError";
import { DashboardPageSkeleton } from "../layout/DashboardPageSkeleton";
import { QuickMediaCheckWidget } from "../media-check/QuickMediaCheckWidget";

vi.mock("@/features/media-settings", () => ({
  QuickMediaCheckDialog: ({
    open,
    onSaved,
  }: {
    open: boolean;
    onSaved: () => void;
  }) =>
    open ? (
      <button type="button" onClick={onSaved}>
        Save checked devices
      </button>
    ) : null,
}));
const stats: DashboardStatsResponseDto = {
  totalInterviews: 12,
  completedInterviews: 9,
  currentStreakDays: 6,
  maxStreakDays: 20,
  averageScore: 8.6,
  solvedTasks: { total: 32, easy: 15, medium: 13, hard: 4 },
  totalPracticeTimeMinutes: 400,
};
const insights: DashboardInsightsResponseDto = {
  insights: [
    {
      id: "insight",
      category: "ALGORITHMS",
      headline: "API headline",
      recommendation: "API recommendation",
      practiceUrl: "/dashboard/sandbox?problemId=real-problem",
    },
  ],
  overallSummary: "API summary",
};
const recent: RecentSessionsResponseDto = {
  items: [
    {
      id: "session",
      title: "API session title",
      completedAt: "2026-09-28T12:00:00Z",
      durationMinutes: 40,
      score: 8.5,
      role: "INTERVIEWER",
      hasFeedbackReport: true,
    },
  ],
};
let client: QueryClient;
let handle: (config: RequestConfig) => Promise<unknown>;
function mount() {
  return render(
    <QueryClientProvider client={client}>
      <DashboardStatsGrid />
      <DashboardAiInsights />
      <DashboardRecentSessions />
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  handle = async (config) =>
    config.url.includes("/stats")
      ? stats
      : config.url.includes("/insights")
        ? insights
        : recent;
  setHttpTransport(
    async <T,>(config: RequestConfig): Promise<T> =>
      (await handle(config)) as T,
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
});
describe("Аналитика дашборда", () => {
  it("отображает все четыре карточки показателей с точными значениями API, включая серию дней и разбивку по сложности", async () => {
    mount();
    await screen.findByText("12");
    const title = screen.getByRole("heading", { name: "Total interviews" });
    const region = title.closest("section");
    if (!region) throw new Error("Missing statistics section");
    const metrics = within(region);
    expect(metrics.getAllByRole("heading", { level: 3 })).toHaveLength(4);
    for (const value of [
      "12",
      "Completed: 9",
      "6",
      "8.6 / 10",
      "32",
      "Easy: 15",
      "Medium: 13",
      "Hard: 4",
    ])
      expect(metrics.getByText(value)).toBeInTheDocument();
  });
  it("сохраняет нулевые значения и отличает отсутствие оценки от нуля", async () => {
    client.setQueryData(DASHBOARD_KEYS.stats(), {
      ...stats,
      totalInterviews: 0,
      currentStreakDays: 0,
      averageScore: null,
    });
    mount();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("No score yet")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(2);
  });
  it("отображает нулевую оценку по десятибалльной шкале API", () => {
    client.setQueryData(DASHBOARD_KEYS.stats(), { ...stats, averageScore: 0 });
    mount();
    expect(screen.getByText("0 / 10")).toBeInTheDocument();
  });
  it("отображает аналитику и рекомендацию из API с переданным контекстом песочницы", async () => {
    mount();
    expect(await screen.findByText("API recommendation")).toBeInTheDocument();
    expect(screen.getByText("API headline")).toBeInTheDocument();
    expect(screen.getByText("API summary")).toBeInTheDocument();
    expect(screen.getByText("Algorithms")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start practicing" }),
    ).toHaveAttribute("href", "/dashboard/sandbox?problemId=real-problem");
  });
  it("отображает пустое состояние аналитики без вымышленных данных", async () => {
    client.setQueryData(DASHBOARD_KEYS.insights(), { insights: [] });
    mount();
    expect(
      screen.getByText("Complete an interview to receive insights"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start practicing" }),
    ).not.toBeInTheDocument();
  });
  it("показывает дату, тему или название, роль и оценку завершённых сессий без вымышленного URL отчёта", async () => {
    const request = vi.fn(handle);
    handle = request;
    mount();
    expect(await screen.findByText("API session title")).toBeInTheDocument();
    expect(screen.getByText("Interviewer")).toBeInTheDocument();
    expect(screen.getByText("Score: 8.5 / 10")).toBeInTheDocument();
    expect(screen.getByText(/Sep 28, 2026/)).toHaveAttribute(
      "datetime",
      recent.items[0]?.completedAt,
    );
    expect(
      screen.getByText("Report viewing is not available yet"),
    ).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/dashboard/recent-sessions?limit=5",
      }),
    );
    expect(
      screen.queryByRole("link", { name: "View report" }),
    ).not.toBeInTheDocument();
  });
  it("показывает пустое состояние последних сессий", () => {
    client.setQueryData(DASHBOARD_KEYS.recent({ limit: 5 }), { items: [] });
    mount();
    expect(screen.getByText("No completed interviews yet")).toBeInTheDocument();
  });
  it("отображает не более пяти последних сессий, сохраняя нулевые и отсутствующие оценки", async () => {
    const first = recent.items[0];
    if (!first) throw new Error("Missing fixture");
    client.setQueryData(DASHBOARD_KEYS.recent({ limit: 5 }), {
      items: Array.from({ length: 6 }, (_, index) => ({
        ...first,
        id: `${index}`,
        title: `Session ${index}`,
        score: index === 0 ? 0 : null,
        hasFeedbackReport: false,
      })),
    });
    mount();
    expect(screen.getAllByRole("heading", { name: /^Session/ })).toHaveLength(
      5,
    );
    expect(screen.getByText("Score: 0 / 10")).toBeInTheDocument();
    expect(screen.getAllByText("Score: No score yet")).toHaveLength(4);
  });
  it.each([
    "stats",
    "insights",
    "recent-sessions",
  ])("изолирует ошибку %s и повторяет запрос только для этого виджета", async (failed) => {
    const success = handle;
    let fail = true;
    handle = async (config) => {
      if (fail && config.url.includes(failed)) throw new Error("offline");
      return success(config);
    };
    mount();
    const alert = await screen.findByRole("alert");
    expect(
      await screen.findByText(failed === "stats" ? "API recommendation" : "12"),
    ).toBeInTheDocument();
    fail = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
  it("отображает скелетоны виджетов во время независимых запросов", () => {
    handle = () => new Promise(() => {});
    mount();
    for (const title of ["Statistics", "AI insights", "Recent interviews"])
      expect(screen.getByLabelText(title)).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(4);
  });
});
it.each([
  undefined,
  "javascript:alert(1)",
  "//evil.example/dashboard/sandbox?topic=trees",
  "/dashboard/sandbox",
  "/missing?topic=trees",
])("не создаёт ссылку на практику без безопасного контекста песочницы (%s)", (value) => {
  expect(getPracticeHref(value)).toBeNull();
});
it("сохраняет контекст темы, полученный с сервера", () => {
  expect(getPracticeHref("/dashboard/sandbox?topic=trees")).toBe(
    "/dashboard/sandbox?topic=trees",
  );
});
it("начальный скелетон страницы не требует QueryClient и сохраняет доступность быстрых действий", () => {
  render(<DashboardPageSkeleton />);
  expect(screen.getByTestId("dashboard-primary")).toBeInTheDocument();
  expect(screen.getByTestId("dashboard-secondary")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Code sandbox/ })).toHaveAttribute(
    "href",
    "/dashboard/sandbox",
  );
});
it("ошибка страницы предоставляет повторную попытку без раскрытия подробностей ошибки", () => {
  const reset = vi.fn();
  render(<DashboardPageError reset={reset} />);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
});
it("виджет устройств открывает существующий диалог и обновляет только готовность при сохранении", async () => {
  client.setQueryData(DASHBOARD_KEYS.readiness(), {});
  client.setQueryData(DASHBOARD_KEYS.stats(), stats);
  render(
    <QueryClientProvider client={client}>
      <QuickMediaCheckWidget />
    </QueryClientProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Save checked devices" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check connection" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Save checked devices" }),
  );
  expect(client.getQueryState(DASHBOARD_KEYS.readiness())?.isInvalidated).toBe(
    true,
  );
  expect(client.getQueryState(DASHBOARD_KEYS.stats())?.isInvalidated).toBe(
    false,
  );
});
