import type { NotificationsListDtoItemsItem } from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/http/base";
import i18n from "@/shared/lib/i18n";
import { NotificationBell } from "./NotificationBell";

vi.mock("@/shared/api/http/base", () => ({ baseFetch: vi.fn() }));

const listPath = "/api/v1/notifications";
let queryClient: QueryClient;
let items: NotificationsListDtoItemsItem[];
let unreadCount: number;
let listResponse: Promise<void>;
let readResponse: Promise<void>;
let listError: boolean;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal("Notification", undefined);
  await i18n.changeLanguage("ru");
  resetApiTransportState();
  initApiTransport();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  unreadCount = 2;
  listError = false;
  listResponse = Promise.resolve();
  readResponse = Promise.resolve();
  items = Array.from({ length: 6 }, (_, index) => ({
    id: String(index),
    userId: "user",
    category: "SYSTEM",
    title: `Уведомление ${index}`,
    message: `Сообщение ${index}`,
    actionUrl: null,
    readAt: null,
    deletedAt: null,
    createdAt: "2026-09-19T12:00:00.000Z",
    updatedAt: "2026-09-19T12:00:00.000Z",
  }));
  vi.mocked(baseFetch).mockImplementation(async (url) => {
    const { pathname, searchParams } = new URL(url, "http://localhost");
    if (pathname === `${listPath}/unread-count`) return { count: unreadCount };
    if (pathname === `${listPath}/read-all`) {
      await readResponse;
      unreadCount = 0;
      return { success: true };
    }
    if (pathname === listPath) {
      await listResponse;
      if (listError) throw new Error("Notifications unavailable");
      const limit = Number(searchParams.get("limit"));
      return {
        items: items.slice(0, limit),
        total: items.length,
        totalPages: Math.ceil(items.length / limit),
        page: 1,
        limit,
      };
    }
    throw new Error(`Unexpected request: ${url}`);
  });
});

afterEach(async () => {
  cleanup();
  queryClient.clear();
  resetApiTransportState();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("ru");
});

function renderBell() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationBell />
    </QueryClientProvider>,
  );
  return user;
}

async function openBell(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("button", {
      name:
        unreadCount > 0
          ? `Непрочитанные уведомления: ${unreadCount}`
          : "Уведомления",
    }),
  );
}

const listCalls = () =>
  vi
    .mocked(baseFetch)
    .mock.calls.filter(
      ([url]) => new URL(url, "http://localhost").pathname === listPath,
    );

describe("NotificationBell", () => {
  it("loads a five-item preview only after opening", async () => {
    const user = renderBell();
    await screen.findByRole("button", { name: "Непрочитанные уведомления: 2" });
    expect(listCalls()).toHaveLength(0);
    await openBell(user);
    await screen.findByText("Уведомление 0");
    expect(screen.getByText("Уведомление 4")).toBeTruthy();
    expect(screen.queryByText("Уведомление 5")).toBeNull();
    const params = new URL(listCalls()[0][0], "http://localhost").searchParams;
    expect(params.get("page")).toBe("1");
    expect(params.get("limit")).toBe("5");
  });

  it.each([
    1, 99, 100,
  ])("shows the unread badge for %i notifications", async (count) => {
    unreadCount = count;
    renderBell();
    const trigger = await screen.findByRole("button", {
      name: `Непрочитанные уведомления: ${count}`,
    });
    expect(
      within(trigger).getByText(count > 99 ? "99+" : String(count)),
    ).toBeTruthy();
  });

  it("hides the badge and disables mark-all when nothing is unread", async () => {
    unreadCount = 0;
    const user = renderBell();
    await openBell(user);
    await screen.findByText("Уведомление 0");
    expect(
      screen.getByRole("button", { name: "Уведомления" }).textContent,
    ).toBe("");
    const button = screen.getByRole("button", { name: "Прочитать все" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await user.click(button);
    expect(
      vi
        .mocked(baseFetch)
        .mock.calls.some(([url]) => url.endsWith("/read-all")),
    ).toBe(false);
  });

  it("shows loading until the preview arrives", async () => {
    const pending = deferred();
    listResponse = pending.promise;
    const user = renderBell();
    await openBell(user);
    expect(screen.getByRole("status").textContent).toBe("Загрузка уведомлений");
    await act(async () => pending.resolve());
    await screen.findByText("Уведомление 0");
    expect(screen.queryByText("Загрузка уведомлений")).toBeNull();
  });

  it("shows an error when the preview request fails", async () => {
    listError = true;
    const user = renderBell();
    await openBell(user);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Не удалось загрузить уведомления.",
    );
    expect(screen.queryByText("У вас пока нет уведомлений")).toBeNull();
  });

  it("shows the empty state for an empty response", async () => {
    items = [];
    const user = renderBell();
    await openBell(user);
    expect(await screen.findByText("У вас пока нет уведомлений")).toBeTruthy();
  });

  it("blocks repeated mark-all requests and refreshes the unread count", async () => {
    const pending = deferred();
    readResponse = pending.promise;
    const user = renderBell();
    await openBell(user);
    await screen.findByText("Уведомление 0");
    const button = screen.getByRole("button", { name: "Прочитать все" });
    await user.click(button);
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
    await user.click(button);
    const requests = vi
      .mocked(baseFetch)
      .mock.calls.filter(([url]) => url.endsWith("/read-all"));
    expect(requests).toHaveLength(1);
    expect(requests[0][1]).toEqual(expect.objectContaining({ method: "POST" }));
    await act(async () => pending.resolve());
    await screen.findByRole("button", { name: "Уведомления" });
    expect(button.hasAttribute("disabled")).toBe(true);
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  it("links to all notifications and closes the popover on click", async () => {
    const user = renderBell();
    await openBell(user);
    const link = screen.getByRole("link", {
      name: "Посмотреть все уведомления",
    });
    expect(link.getAttribute("href")).toBe("/dashboard/notifications");
    // Prevent jsdom navigation while preserving the component click handler.
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Посмотреть все уведомления" }),
      ).toBeNull(),
    );
    expect(
      screen
        .getByRole("button", { name: "Непрочитанные уведомления: 2" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("updates visible text and accessible labels when the language changes", async () => {
    items = [];
    const user = renderBell();
    await openBell(user);
    await screen.findByText("У вас пока нет уведомлений");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    expect(
      screen.getByRole("button", { name: "Unread notifications: 2" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Notifications" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Mark all as read" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "View all notifications" }),
    ).toBeTruthy();
    expect(screen.getByText("You have no notifications yet")).toBeTruthy();
  });
});
