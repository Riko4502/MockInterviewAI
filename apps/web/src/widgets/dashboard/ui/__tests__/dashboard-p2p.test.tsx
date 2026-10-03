import "@testing-library/jest-dom/vitest";
import {
  type DashboardMatchRequestsResponseDto,
  type RequestConfig,
  resetHttpTransport,
  type ShowcaseStatusResponseDto,
  setHttpTransport,
} from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/lib/i18n";
import { DASHBOARD_KEYS } from "../../model/query-keys";
import { DashboardMatchRequests } from "../match-requests/DashboardMatchRequests";
import { DashboardShowcaseBanner } from "../showcase/DashboardShowcaseBanner";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@packages/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@packages/ui")>()),
  useToast: () => ({ push }),
}));
const requests: DashboardMatchRequestsResponseDto = {
  totalPendingCount: 2,
  items: [
    {
      id: "one",
      senderId: "ada",
      senderName: "Ada",
      senderAvatarUrl: "/ada.png",
      specialization: "FRONTEND",
      skills: ["React", "TypeScript"],
      createdAt: "2026-10-01T10:00:00Z",
      message: "Tomorrow evening?",
    },
    {
      id: "two",
      senderId: "grace",
      senderName: "Grace",
      skills: [],
      createdAt: "2026-10-01T09:00:00Z",
    },
  ],
};
const showcase: ShowcaseStatusResponseDto = {
  hasActiveCard: true,
  card: {
    id: "card",
    specialization: "FRONTEND",
    level: "MIDDLE",
    isUrgent: false,
    daysLeft: 9,
    expiresAt: "2026-10-10T10:00:00Z",
    canBump: true,
    lastBumpedAt: "2026-10-01T10:00:00Z",
    viewsCount: 17,
    incomingRequestsCount: 3,
  },
};
let client: QueryClient;
let data: DashboardMatchRequestsResponseDto;
let status: ShowcaseStatusResponseDto;
let handle: (config: RequestConfig) => Promise<unknown>;
function deferred() {
  let resolve!: (value?: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
function mount() {
  return render(
    <QueryClientProvider client={client}>
      <DashboardMatchRequests />
      <DashboardShowcaseBanner />
    </QueryClientProvider>,
  );
}
beforeEach(async () => {
  await i18n.changeLanguage("en");
  push.mockClear();
  client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  data = structuredClone(requests);
  status = structuredClone(showcase);
  handle = async (config) =>
    config.url.includes("match-requests") ? data : status;
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

describe("Заявки на интервью (DashboardMatchRequests)", () => {
  it("отображает полученные с сервера имена, специализацию, стек и сообщение без вымышленного предпочтительного времени", async () => {
    mount();
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Grace")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("React, TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Tomorrow evening?")).toBeInTheDocument();
    expect(screen.getAllByText("Preferred time: not specified")).toHaveLength(
      2,
    );
  });
  it("отображает нейтральное пустое состояние", async () => {
    data = { items: [], totalPendingCount: 0 };
    mount();
    expect(await screen.findByText("No new requests")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each([
    "accept",
    "reject",
  ] as const)("оптимистически удаляет заявку и подтверждает операцию %s, сохраняя доступность действий для остальных строк", async (action) => {
    const response = deferred();
    const post = vi.fn(() => response.promise);
    handle = async (config) =>
      config.method === "POST"
        ? post()
        : config.url.includes("match-requests")
          ? data
          : status;
    client.setQueryData(DASHBOARD_KEYS.upcoming(), { hasUpcoming: false });
    mount();
    await screen.findByText("Ada");
    const button = screen.getAllByRole("button", {
      name: action === "accept" ? "Accept" : "Reject",
    })[0];
    if (!button) throw new Error("Missing button");
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.queryByText("Ada")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Accept" })).toBeEnabled();
    expect(post).toHaveBeenCalledTimes(1);
    data = {
      items: requests.items.filter((item) => item.id === "two"),
      totalPendingCount: 1,
    };
    await act(async () => response.resolve());
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(client.getQueryData(DASHBOARD_KEYS.matches())).toEqual(data);
    expect(client.getQueryState(DASHBOARD_KEYS.upcoming())?.isInvalidated).toBe(
      false,
    );
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });
  it.each([
    "Accept",
    "Reject",
  ])("откатывает неудачную операцию %s", async (action) => {
    const response = deferred();
    handle = async (config) =>
      config.method === "POST"
        ? response.promise
        : config.url.includes("match-requests")
          ? data
          : status;
    mount();
    await screen.findByText("Ada");
    fireEvent.click(
      within(screen.getByText("Ada").closest("li") ?? document.body).getByRole(
        "button",
        { name: action },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Ada")).not.toBeInTheDocument(),
    );
    await act(async () => response.reject(new Error("offline")));
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(client.getQueryData(DASHBOARD_KEYS.matches())).toEqual(requests);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" }),
    );
  });
  it("откатывает одну заявку, не восстанавливая другую успешно обработанную параллельную заявку", async () => {
    const first = deferred();
    const second = deferred();
    handle = async (config) =>
      config.method === "POST"
        ? config.url.includes("/one/")
          ? first.promise
          : second.promise
        : config.url.includes("match-requests")
          ? data
          : status;
    mount();
    await screen.findByText("Ada");
    fireEvent.click(
      within(screen.getByText("Ada").closest("li") ?? document.body).getByRole(
        "button",
        { name: "Accept" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    data = {
      items: requests.items.filter((item) => item.id === "one"),
      totalPendingCount: 1,
    };
    await act(async () => second.resolve());
    await act(async () => first.reject(new Error("failed")));
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.queryByText("Grace")).not.toBeInTheDocument();
  });
});

describe("Анкета на витрине (DashboardShowcaseBanner)", () => {
  it("показывает данные активной анкеты и учитывает разрешение сервера на поднятие", async () => {
    mount();
    expect(await screen.findByText("Profile active")).toBeInTheDocument();
    expect(
      screen.getByText("Profile active for 9 more days"),
    ).toBeInTheDocument();
    expect(screen.getByText("Views: 17")).toBeInTheDocument();
    expect(screen.getByText("Incoming requests: 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bump profile" })).toBeEnabled();
  });
  it("показывает неактивную анкету без вымышленных статистики и действия поднятия", async () => {
    status = { hasActiveCard: false, card: null };
    mount();
    expect(await screen.findByText("Profile inactive")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Bump profile" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Views:/)).not.toBeInTheDocument();
  });
  it("блокирует поднятие при запрете сервера даже при старой временной метке", async () => {
    if (!status.card) throw new Error("Missing fixture");
    status.card.canBump = false;
    status.card.lastBumpedAt = "2000-01-01T00:00:00Z";
    mount();
    expect(
      await screen.findByRole("button", { name: "Bump profile" }),
    ).toBeDisabled();
  });
  it("поднимает анкету один раз, обновляет только витрину и показывает сообщение об успехе", async () => {
    const response = deferred();
    const calls = vi.fn(async (config: RequestConfig) =>
      config.method === "POST"
        ? response.promise
        : config.url.includes("match-requests")
          ? data
          : status,
    );
    handle = calls;
    mount();
    const button = await screen.findByRole("button", { name: "Bump profile" });
    calls.mockClear();
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    if (!status.card) throw new Error("Missing fixture");
    status = { ...status, card: { ...status.card, canBump: false } };
    await act(async () => response.resolve());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        status: "success",
        title: "Profile bumped successfully",
      }),
    );
    expect(calls.mock.calls.map(([config]) => config.url)).toEqual([
      "/api/v1/showcase/card/bump",
      "/api/v1/dashboard/showcase-status",
    ]);
    expect(button).toBeDisabled();
  });
  it("сохраняет доступность анкеты после неудачного поднятия и сообщает об ошибке", async () => {
    handle = async (config) => {
      if (config.method === "POST") throw new Error("cooldown");
      return config.url.includes("match-requests") ? data : status;
    };
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Bump profile" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error" }),
      ),
    );
    expect(screen.getByText("Profile active")).toBeInTheDocument();
  });
});

it.each([
  "match-requests",
  "showcase-status",
])("изолирует ошибки загрузки %s и поддерживает повторную попытку", async (failed) => {
  let fail = true;
  handle = async (config) => {
    if (fail && config.url.includes(failed)) throw new Error("offline");
    return config.url.includes("match-requests") ? data : status;
  };
  mount();
  const alert = await screen.findByRole("alert");
  expect(
    await screen.findByText(
      failed === "match-requests" ? "Profile active" : "Ada",
    ),
  ).toBeInTheDocument();
  fail = false;
  fireEvent.click(within(alert).getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
  );
});
it("отображает независимые скелетоны во время выполнения обоих запросов", () => {
  handle = () => new Promise(() => {});
  mount();
  expect(screen.getByLabelText("Loading requests")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  expect(screen.getByLabelText("Loading showcase profile")).toHaveAttribute(
    "aria-busy",
    "true",
  );
});
