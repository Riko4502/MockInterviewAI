import "@testing-library/jest-dom/vitest";
import {
  getShowcaseControllerFindAllQueryKey,
  getShowcaseControllerFindOneQueryKey,
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
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseCardResponseDto } from "@/entities/showcase-card";
import { HttpError } from "@/shared/api";
import i18n from "@/shared/lib/i18n";
import { SendMatchRequestDialog } from "./SendMatchRequestDialog";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("@packages/ui", async (original) => ({
  ...(await original<typeof import("@packages/ui")>()),
  useToast: () => ({ push }),
}));

const OPEN_EARLIER = {
  id: "slot-earlier",
  startsAt: "2999-01-14T16:00:00.000Z",
  durationMinutes: 30,
  status: "OPEN" as const,
};
const OPEN_LATER = {
  id: "slot-later",
  startsAt: "2999-01-15T16:00:00.000Z",
  durationMinutes: 60,
  status: "OPEN" as const,
};
const BOOKED = {
  id: "slot-booked",
  startsAt: "2999-01-16T16:00:00.000Z",
  durationMinutes: 60,
  status: "BOOKED" as const,
};
const PAST_OPEN = {
  id: "slot-past",
  startsAt: "2000-01-01T10:00:00.000Z",
  durationMinutes: 60,
  status: "OPEN" as const,
};

function makeCard(
  slots: ShowcaseCardResponseDto["slots"],
): ShowcaseCardResponseDto {
  return {
    id: "card-1",
    userId: "user-1",
    user: {
      id: "user-1",
      displayName: "Иван Петров",
      username: "ipetrov",
      avatarUrl: null,
      telegramUsername: null,
      gitUrl: null,
    },
    title: "Frontend",
    specialization: "FRONTEND",
    level: "MIDDLE",
    language: "RU",
    skills: ["React"],
    bio: null,
    scheduleInfo: null,
    slots,
    isUrgent: false,
    status: "ACTIVE",
    autoRenew: false,
    bumpedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2030-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

let client: QueryClient;
let requests: RequestConfig[];
let respond: (config: RequestConfig) => Promise<unknown>;

beforeEach(async () => {
  await i18n.changeLanguage("ru");
  push.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  requests = [];
  respond = async (config) => (config.method === "POST" ? { id: "req-1" } : {});
  setHttpTransport(async <T,>(config: RequestConfig): Promise<T> => {
    requests.push(config);
    return (await respond(config)) as T;
  });
});

afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
  vi.unstubAllGlobals();
});

function renderDialog(card: ShowcaseCardResponseDto) {
  return render(
    <QueryClientProvider client={client}>
      <SendMatchRequestDialog card={card} open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

function getSubmitButton() {
  return screen.getByRole("button", { name: /Отправить предложение/i });
}

function submit() {
  const form = getSubmitButton().closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
}

function postRequests() {
  return requests.filter(
    (request) =>
      request.method === "POST" &&
      request.url.endsWith("/matchmaking/requests"),
  );
}

describe("SendMatchRequestDialog", () => {
  it("требует выбрать слот и передаёт slotId выбранного слота", async () => {
    renderDialog(makeCard([OPEN_LATER, OPEN_EARLIER, BOOKED, PAST_OPEN]));

    // Показываются только будущие OPEN-слоты, сначала самый ранний
    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(getSubmitButton()).toBeDisabled();

    fireEvent.click(radios[0]);
    expect(getSubmitButton()).toBeEnabled();
    // до явной отправки запрос не уходит
    expect(postRequests()).toHaveLength(0);

    submit();

    await waitFor(() => expect(postRequests()).toHaveLength(1));
    expect(postRequests()[0]?.data).toMatchObject({
      targetCardId: "card-1",
      slotId: "slot-earlier",
    });
  });

  it("без открытых слотов показывает подсказку и отправляет без slotId", async () => {
    renderDialog(makeCard([BOOKED, PAST_OPEN]));

    expect(
      await screen.findByText(/У автора гибкое расписание/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(getSubmitButton()).toBeEnabled();

    submit();

    await waitFor(() => expect(postRequests()).toHaveLength(1));
    expect(postRequests()[0]?.data).toMatchObject({ targetCardId: "card-1" });
    expect(
      (postRequests()[0]?.data as { slotId?: string } | undefined)?.slotId,
    ).toBeUndefined();
  });

  it("при 409 показывает slotConflict, инвалидирует карточку, сбрасывает выбор и не закрывает диалог", async () => {
    const card = makeCard([OPEN_EARLIER]);
    const findAllKey = getShowcaseControllerFindAllQueryKey();
    const findOneKey = getShowcaseControllerFindOneQueryKey(card.id);
    client.setQueryData(findAllKey, [card]);
    client.setQueryData(findOneKey, card);

    respond = async (config) => {
      if (config.method === "POST") {
        throw new HttpError("Slot already booked", 409);
      }
      return {};
    };

    renderDialog(card);
    fireEvent.click(await screen.findByRole("radio"));
    submit();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        status: "error",
        title: "Этот слот уже занят. Пожалуйста, выберите другой слот.",
      }),
    );
    expect(client.getQueryState(findAllKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(findOneKey)?.isInvalidated).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // выбор сброшен → снова требуется выбрать слот
    expect(getSubmitButton()).toBeDisabled();
  });

  it("при 400 показывает фактическое сообщение сервера, а не «Выберите слот»", async () => {
    const card = makeCard([OPEN_EARLIER]);
    const serverMessage =
      "Для отправки заявки заполните профиль: имя (от 2 символов) и никнейм (@username)";
    respond = async (config) => {
      if (config.method === "POST") {
        throw new HttpError(serverMessage, 400);
      }
      return {};
    };

    renderDialog(card);
    fireEvent.click(await screen.findByRole("radio"));
    submit();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        status: "error",
        title: serverMessage,
      }),
    );
    expect(push).not.toHaveBeenCalledWith({
      status: "error",
      title: "Выберите слот для интервью",
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
