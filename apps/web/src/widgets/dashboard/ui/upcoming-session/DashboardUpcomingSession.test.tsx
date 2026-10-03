import "@testing-library/jest-dom/vitest";
import {
  resetHttpTransport,
  setHttpTransport,
  type UpcomingSessionResponseDtoSession,
} from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardUpcomingSession } from "./DashboardUpcomingSession";
import { SessionCountdownTimer } from "./SessionCountdownTimer";

const session: NonNullable<UpcomingSessionResponseDtoSession> = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  title: "Mock Interview Session",
  status: "CREATED",
  scheduledAt: "2026-10-01T12:00:00.000Z",
  role: "CANDIDATE",
  partner: {
    id: "123e4567-e89b-42d3-a456-426614174001",
    displayName: "Alex Example",
    username: "alex",
    avatarUrl: "https://example.test/avatar.png",
    specialization: "FRONTEND",
    level: "MIDDLE",
  },
  isReadyToJoin: false,
  secondsUntilStart: 2700,
};
let client: QueryClient;

beforeEach(() => {
  vi.useRealTimers();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  setHttpTransport(
    async <T,>(): Promise<T> => ({ hasUpcoming: true, session }) as T,
  );
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
      <DashboardUpcomingSession />
    </QueryClientProvider>,
  );
}

function setSession(overrides: Partial<typeof session>) {
  setHttpTransport(
    async <T,>(): Promise<T> =>
      ({ hasUpcoming: true, session: { ...session, ...overrides } }) as T,
  );
}

describe("Ближайшая сессия (DashboardUpcomingSession)", () => {
  it("отображает сессию и только те данные собеседника, которые получены из API", async () => {
    const { container } = renderWidget();
    expect(
      await screen.findByRole("heading", { name: "Mock Interview Session" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alex Example")).toBeInTheDocument();
    expect(screen.getByText(/Фронтенд · Средний/)).toBeInTheDocument();
    expect(
      container.querySelector("[data-slot=avatar-fallback]"),
    ).toBeInTheDocument();
  });

  it("показывает пустое состояние с существующими маршрутами создания комнаты и поиска собеседника", async () => {
    setHttpTransport(
      async <T,>(): Promise<T> => ({ hasUpcoming: false, session: null }) as T,
    );
    renderWidget();
    expect(
      await screen.findByText("Ближайших встреч пока нет"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Создать комнату" }),
    ).toHaveAttribute("href", "/dashboard/sandbox");
    expect(
      screen.getByRole("link", { name: "Найти партнера" }),
    ).toHaveAttribute("href", "/dashboard#live-match");
  });

  it("блокирует подключение, пока сервер сообщает об отсутствии готовности", async () => {
    setSession({ secondsUntilStart: 2700, isReadyToJoin: false });
    renderWidget();
    const join = await screen.findByRole("link");
    expect(join).toHaveAttribute("aria-disabled", "true");
    expect(join).toHaveAttribute(
      "href",
      "/dashboard/sandbox?room=123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("разрешает подключение на заданной сервером границе в десять минут", async () => {
    setSession({ secondsUntilStart: 600, isReadyToJoin: true });
    renderWidget();
    const join = await screen.findByRole("link");
    expect(join).toHaveAttribute("aria-disabled", "false");
    expect(join).toHaveAttribute(
      "href",
      "/dashboard/sandbox?room=123e4567-e89b-42d3-a456-426614174000",
    );
  });

  it("использует серверную готовность, даже если до активной сессии осталось более десяти минут", async () => {
    setSession({
      status: "ACTIVE",
      secondsUntilStart: 3600,
      isReadyToJoin: true,
    });
    renderWidget();
    expect(await screen.findByRole("link")).toBeEnabled();
  });

  it("открывает существующий диалог проверки устройств из карточки сессии", async () => {
    renderWidget();
    fireEvent.click(
      await screen.findByRole("button", { name: "Проверить связь" }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("показывает изолированную ошибку с возможностью повторной попытки", async () => {
    setHttpTransport(async <T,>(): Promise<T> => {
      throw new Error("offline");
    });
    renderWidget();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Попробовать снова" }),
    ).toBeInTheDocument();
  });
});

describe("Обратный отсчёт до сессии (SessionCountdownTimer)", () => {
  it("обновляется раз в секунду, однократно сообщает об истечении времени при нуле и не показывает отрицательное время", async () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    const { unmount } = render(
      <SessionCountdownTimer
        seconds={2}
        label="До начала:"
        onExpire={onExpire}
      />,
    );
    expect(screen.getByText("00:00:02")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledTimes(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
