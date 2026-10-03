import {
  getNotificationsControllerGetNotificationsQueryKey,
  getNotificationsControllerGetNotificationsQueryOptions,
  getNotificationsControllerGetUnreadCountQueryKey,
  getNotificationsControllerGetUnreadCountQueryOptions,
} from "@packages/api";
import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationRealtime } from "./NotificationRealtime";

const mocks = vi.hoisted(() => ({
  translate: (key: string) => key,
  authenticated: false,
  clearSession: vi.fn(),
  toast: { push: vi.fn(), dismiss: vi.fn() },
  router: { push: vi.fn() },
  open: vi.fn(),
}));
vi.mock("@/entities/session", () => ({
  useSession: () => ({
    isAuthenticated: mocks.authenticated,
    clearSession: mocks.clearSession,
  }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: mocks.translate }),
}));
vi.mock("@packages/ui", () => ({ useToast: () => mocks.toast }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/shared/api/realtime/notification-stream", () => ({
  openNotificationStream: mocks.open,
}));

let client: QueryClient;
let stream: EventTarget & { close: ReturnType<typeof vi.fn> };
const countKey = getNotificationsControllerGetUnreadCountQueryKey();
const listKey = getNotificationsControllerGetNotificationsQueryKey();
const emit = (type: string, payload: unknown) => {
  act(() => {
    stream.dispatchEvent(
      new MessageEvent(type, {
        data: JSON.stringify({
          id: "1724500000000-0",
          type,
          timestamp: "2024-08-24T11:46:40Z",
          payload,
        }),
      }),
    );
  });
};
const newNotification = {
  id: "n1",
  title: "Приглашение",
  message: "Новое интервью",
};
const tree = () => (
  <QueryClientProvider client={client}>
    <NotificationRealtime />
  </QueryClientProvider>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.translate = (key: string) => key;
  mocks.authenticated = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(countKey, { count: 2 });
  client.setQueryData([...listKey, { page: 1 }], { items: [] });
  stream = Object.assign(new EventTarget(), { close: vi.fn() });
  mocks.open.mockReturnValue(stream);
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("NotificationRealtime", () => {
  it("connects only after login and closes on logout", () => {
    mocks.authenticated = false;
    const { rerender } = render(tree());
    expect(mocks.open).not.toHaveBeenCalled();
    mocks.authenticated = true;
    rerender(tree());
    expect(mocks.open).toHaveBeenCalledTimes(1);
    rerender(tree());
    expect(mocks.open).toHaveBeenCalledTimes(1);
    mocks.authenticated = false;
    rerender(tree());
    expect(stream.close).toHaveBeenCalledTimes(1);
  });

  it("preserves the stream and active toasts across locale changes", () => {
    mocks.translate = (key: string) => `en:${key}`;
    const { rerender, unmount } = render(tree());
    emit("notification.new", newNotification);
    const firstToast = mocks.toast.push.mock.calls[0][0];

    mocks.translate = (key: string) => `ru:${key}`;
    rerender(tree());
    expect(mocks.open).toHaveBeenCalledTimes(1);
    expect(stream.close).not.toHaveBeenCalled();
    expect(mocks.toast.dismiss).not.toHaveBeenCalled();

    emit("notification.new", newNotification);
    expect(mocks.toast.push).toHaveBeenCalledTimes(1);
    emit("notification.new", { ...newNotification, id: "n2" });
    expect(firstToast.action.label).toBe("en:notifications.view");
    expect(mocks.toast.push.mock.calls[1][0].action).toEqual(
      expect.objectContaining({
        label: "ru:notifications.view",
        altText: "ru:notifications.open",
      }),
    );

    unmount();
    expect(stream.close).toHaveBeenCalledTimes(1);
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("notification:n1");
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("notification:n2");
  });

  it("increments immediately, invalidates caches and offers an interactive toast", () => {
    render(tree());
    emit("notification.new", newNotification);
    expect(client.getQueryData(countKey)).toEqual({ count: 3 });
    expect(client.getQueryState(countKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState([...listKey, { page: 1 }])?.isInvalidated).toBe(
      true,
    );
    expect(mocks.toast.push).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Приглашение",
        description: "Новое интервью",
      }),
    );
    mocks.toast.push.mock.calls[0][0].action.onClick();
    expect(mocks.router.push).toHaveBeenCalledWith("/dashboard/notifications");
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("notification:n1");
  });

  it("does not increment or toast twice for a replayed notification", () => {
    render(tree());
    emit("notification.new", newNotification);
    emit("notification.new", newNotification);
    expect(client.getQueryData(countKey)).toEqual({ count: 3 });
    expect(mocks.toast.push).toHaveBeenCalledTimes(1);
  });

  it("uses the absolute badge count, including zero", () => {
    render(tree());
    emit("notification.new", newNotification);
    emit("notification.badge", { unreadCount: 3 });
    expect(client.getQueryData(countKey)).toEqual({ count: 3 });
    emit("notification.badge", { unreadCount: 0 });
    expect(client.getQueryData(countKey)).toEqual({ count: 0 });
  });

  it("diagnoses malformed events in development without changing state", () => {
    vi.stubEnv("NODE_ENV", "development");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(tree());
    act(() => {
      stream.dispatchEvent(new MessageEvent("notification.new", { data: "{" }));
    });
    emit("notification.new", { title: "missing id" });
    emit("notification.new", null);
    emit("notification.badge", { unreadCount: -1 });
    expect(client.getQueryData(countKey)).toEqual({ count: 2 });
    expect(mocks.toast.push).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalledWith(
      "[NotificationRealtime] Invalid SSE event",
      expect.objectContaining({
        type: "notification.new",
        issues: expect.any(Array),
      }),
    );
  });

  it("does not log invalid payloads in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(tree());
    emit("notification.new", null);
    expect(warn).not.toHaveBeenCalled();
    expect(client.getQueryData(countKey)).toEqual({ count: 2 });
  });

  it("invalidates the actual generated query options for lists and badge", () => {
    const lists = [
      getNotificationsControllerGetNotificationsQueryOptions({
        page: 1,
        limit: 5,
      }),
      getNotificationsControllerGetNotificationsQueryOptions({
        page: 2,
        limit: 20,
        category: "INTERVIEW",
      }),
    ];
    const count = getNotificationsControllerGetUnreadCountQueryOptions();
    expect(count.queryKey).toEqual(countKey);
    for (const options of lists) {
      client.setQueryData(options.queryKey, {
        items: [],
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
      });
    }
    render(tree());
    emit("notification.new", newNotification);
    for (const options of [...lists, count]) {
      expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
    }
  });

  it("revalidates on reconnect and dismisses notifications on unmount", () => {
    const { unmount } = render(tree());
    act(() => {
      stream.dispatchEvent(new Event("open"));
    });
    expect(client.getQueryState(countKey)?.isInvalidated).toBe(true);
    emit("notification.new", newNotification);
    unmount();
    expect(stream.close).toHaveBeenCalledTimes(1);
    expect(mocks.toast.dismiss).toHaveBeenCalledWith("notification:n1");
  });

  it("does not let an older count response overwrite an SSE update", async () => {
    let resolve!: (data: { count: number }) => void;
    const pending = client
      .fetchQuery({
        queryKey: countKey,
        queryFn: () =>
          new Promise<{ count: number }>((done) => {
            resolve = done;
          }),
      })
      .catch(() => undefined);
    render(tree());
    emit("notification.new", newNotification);
    resolve({ count: 2 });
    await pending;
    expect(client.getQueryData(countKey)).toEqual({ count: 3 });
  });

  it("refetches active notification lists after a new event", async () => {
    const queryFn = vi.fn().mockResolvedValue({ items: [] });
    const observer = new QueryObserver(client, {
      queryKey: [...listKey, { page: 1 }],
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => {});
    await waitFor(() => expect(client.isFetching()).toBe(0));
    queryFn.mockClear();
    render(tree());
    emit("notification.new", newNotification);
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    unsubscribe();
  });
  it("closes the stream when authorization is revoked", () => {
    render(tree());
    emit("auth.revoked", {});
    expect(stream.close).toHaveBeenCalled();
    expect(mocks.clearSession).toHaveBeenCalled();
  });

  it.each([
    ["visible", "granted", true, false],
    ["hidden", "granted", true, true],
    ["hidden", "default", true, false],
    ["hidden", "denied", true, false],
    ["hidden", "granted", false, false],
  ] as const)("keeps the SSE flow for visibility=%s permission=%s supported=%s", (visibility, permission, supported, expected) => {
    const create = vi.fn();
    const request = vi.fn();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue(visibility);
    vi.stubGlobal(
      "Notification",
      supported
        ? Object.assign(
            function NativeNotification(
              title: string,
              options: NotificationOptions,
            ) {
              create(title, options);
              return { close: vi.fn() };
            },
            { permission, requestPermission: request },
          )
        : undefined,
    );
    render(tree());
    emit("notification.new", newNotification);
    emit("notification.new", newNotification);
    expect(client.getQueryData(countKey)).toEqual({ count: 3 });
    expect(mocks.toast.push).toHaveBeenCalledOnce();
    expect(client.getQueryState(countKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState([...listKey, { page: 1 }])?.isInvalidated).toBe(
      true,
    );
    expect(create).toHaveBeenCalledTimes(expected ? 1 : 0);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    "/dashboard/interviews?id=42",
  ])("opens the native notification action or fallback: %s", (actionUrl) => {
    const native = {
      close: vi.fn(),
      onclick: null as ((event: Event) => void) | null,
    };
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    vi.stubGlobal(
      "Notification",
      Object.assign(
        function NativeNotification() {
          return native;
        },
        { permission: "granted" },
      ),
    );
    const { unmount } = render(tree());
    emit("notification.new", { ...newNotification, actionUrl });
    native.onclick?.(new Event("click"));
    expect(native.close).toHaveBeenCalledOnce();
    expect(focus).toHaveBeenCalledOnce();
    expect(mocks.router.push).toHaveBeenCalledWith(
      actionUrl ?? "/dashboard/notifications",
    );
    unmount();
    expect(native.onclick).toBeNull();
  });

  it("keeps processing events when the native constructor throws", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    vi.stubGlobal(
      "Notification",
      Object.assign(
        function NativeNotification() {
          throw new TypeError("Unsupported");
        },
        { permission: "granted" },
      ),
    );
    render(tree());
    emit("notification.new", newNotification);
    emit("notification.new", { ...newNotification, id: "n2" });
    expect(client.getQueryData(countKey)).toEqual({ count: 4 });
    expect(mocks.toast.push).toHaveBeenCalledTimes(2);
    expect(client.getQueryState(countKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState([...listKey, { page: 1 }])?.isInvalidated).toBe(
      true,
    );
  });
});
