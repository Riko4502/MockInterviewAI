import type { NotificationsListDtoItemsItem } from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { NotificationsList } from "./NotificationsList";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/shared/api/base", () => ({ baseFetch: vi.fn() }));

const notification = (
  id: string,
  category: NotificationsListDtoItemsItem["category"],
): NotificationsListDtoItemsItem => ({
  id,
  userId: "user",
  category,
  title: id,
  message: `Текст ${id}`,
  actionUrl: null,
  readAt: null,
  deletedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

let items: NotificationsListDtoItemsItem[];
let queryClient: QueryClient;
let readResponse: Promise<void>;

beforeEach(() => {
  vi.clearAllMocks();
  readResponse = Promise.resolve();
  resetApiTransportState();
  initApiTransport();
  items = [
    notification("Интервью", "INTERVIEW"),
    notification("Сообщение", "MESSAGE"),
  ];
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.mocked(baseFetch).mockImplementation(async (url, options) => {
    if (url.endsWith("/read")) {
      await readResponse;
      items = items.map((item) => ({
        ...item,
        readAt: new Date().toISOString(),
      }));
      return { success: true };
    }
    if (options?.method === "DELETE") {
      items = items.filter((item) => !url.includes(item.id));
      return { success: true };
    }
    const params = new URL(url, "http://localhost").searchParams;
    const page = Number(params.get("page") ?? 1);
    const category = params.get("category");
    const filtered = items.filter(
      (item) => !category || item.category === category,
    );
    return {
      items: filtered.slice((page - 1) * 20, page * 20),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / 20),
      page,
      limit: 20,
    };
  });
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  resetApiTransportState();
});
const renderList = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsList />
    </QueryClientProvider>,
  );

describe("NotificationsList", () => {
  it("пагинирует на сервере и сбрасывает страницу при смене категории", async () => {
    items = Array.from({ length: 21 }, (_, i) =>
      notification(`Запись ${i}`, "MESSAGE"),
    );
    renderList();
    await screen.findByText("Запись 0");
    expect(screen.queryByText("Запись 20")).toBeNull();
    await userEvent.click(
      screen.getByRole("link", { name: "Перейти на следующую страницу" }),
    );
    await screen.findByText("Запись 20");
    expect(baseFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      expect.anything(),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Сообщения" }));
    await screen.findByText("Запись 0");
    expect(baseFetch).toHaveBeenCalledWith(
      expect.stringContaining("page=1&limit=20&category=MESSAGE"),
      expect.anything(),
    );
  });
  it("передает категорию API и отображает серверный результат", async () => {
    renderList();
    await screen.findByText("Сообщение");
    await userEvent.click(screen.getByRole("tab", { name: "Сообщения" }));
    expect(screen.queryByText("Интервью")).toBeNull();
    expect(await screen.findByText("Сообщение")).toBeTruthy();
    expect(baseFetch).toHaveBeenCalledWith(
      expect.stringContaining("category=MESSAGE"),
      expect.anything(),
    );
    await userEvent.click(screen.getByRole("tab", { name: "Системные" }));
    expect(
      screen
        .getByText("У вас пока нет уведомлений")
        .closest('[data-slot="empty"]'),
    ).toBeTruthy();
  });

  it("отмечает уведомление прочитанным до перехода", async () => {
    let resolveRead!: () => void;
    readResponse = new Promise<void>((resolve) => {
      resolveRead = resolve;
    });
    items = [
      {
        ...notification("Интервью", "INTERVIEW"),
        actionUrl: "/dashboard?interview=1",
      },
    ];
    renderList();
    await userEvent.click(
      await screen.findByRole("button", { name: /Интервью.*Текст/ }),
    );
    await waitFor(() =>
      expect(baseFetch).toHaveBeenCalledWith(
        expect.stringContaining("/read"),
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    expect(push).not.toHaveBeenCalled();

    resolveRead();

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/dashboard?interview=1"),
    );
    expect(items[0]?.readAt).not.toBeNull();
  });

  it("удаляет отдельно от чтения и перехода", async () => {
    renderList();
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Удалить уведомление: Интервью",
      }),
    );
    await waitFor(() => expect(screen.queryByText("Интервью")).toBeNull());
    expect(push).not.toHaveBeenCalled();
    expect(
      vi.mocked(baseFetch).mock.calls.some(([url]) => url.endsWith("/read")),
    ).toBe(false);
  });

  it("показывает Empty для пустого списка", async () => {
    items = [];
    renderList();
    expect(
      (await screen.findByText("У вас пока нет уведомлений")).closest(
        '[data-slot="empty"]',
      ),
    ).toBeTruthy();
  });
});
