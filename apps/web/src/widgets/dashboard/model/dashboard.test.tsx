import {
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "@/shared/api/query/query-client";
import { DASHBOARD_KEYS } from "./query-keys";
import type { LiveMatchState } from "./types";
import {
  useAcceptMatchMutation,
  useLiveMatchMutation,
  useLiveMatchStateQuery,
  useRejectMatchMutation,
  useShowcaseBumpMutation,
} from "./use-dashboard-mutations";
import {
  useMatchRequestsQuery,
  useUpcomingSessionQuery,
} from "./use-dashboard-queries";

let client: ReturnType<typeof createQueryClient>;
let request: (config: RequestConfig) => Promise<unknown>;

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = createQueryClient();
  client.setDefaultOptions({
    queries: { retry: false },
    mutations: { retry: false },
  });
  request = vi.fn(async () => undefined);
  setHttpTransport(
    async <T,>(config: RequestConfig): Promise<T> =>
      (await request(config)) as T,
  );
});
afterEach(() => {
  cleanup();
  client.clear();
  resetHttpTransport();
});

describe("Запросы дашборда", () => {
  it("использует существующий транспорт, сохраняет пустые ответы и передаёт сигнал отмены", async () => {
    request = vi.fn(async () => ({ hasUpcoming: false, session: null }));
    const { result } = renderHook(() => useUpcomingSessionQuery(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ hasUpcoming: false, session: null });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/dashboard/upcoming",
        method: "GET",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(client.getQueryData(DASHBOARD_KEYS.upcoming())).toEqual(
      result.current.data,
    );
  });

  it("сохраняет limit в URL запроса и ключе кеша", async () => {
    request = vi.fn(async () => ({ items: [], totalPendingCount: 0 }));
    const { result } = renderHook(() => useMatchRequestsQuery({ limit: 2 }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/dashboard/match-requests?limit=2",
      }),
    );
    expect(client.getQueryData(DASHBOARD_KEYS.matches({ limit: 2 }))).toEqual(
      result.current.data,
    );
    expect(client.getQueryData(DASHBOARD_KEYS.matches())).toBeUndefined();
  });

  it("не выполняет отключённые запросы и возвращает ошибки транспорта", async () => {
    const error = new Error("unavailable");
    request = vi.fn(async () => {
      throw error;
    });
    const { result, rerender } = renderHook(
      ({ enabled }) => useUpcomingSessionQuery({ enabled }),
      {
        initialProps: { enabled: false },
        wrapper: Wrapper,
      },
    );
    expect(request).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.error).toBe(error));
  });
});

describe("Инвалидация кеша дашборда", () => {
  it.each([
    "accept",
    "reject",
    "bump",
  ] as const)("операция %s инвалидирует только затронутые кеши дашборда", async (operation) => {
    const keys = [
      DASHBOARD_KEYS.matches(),
      DASHBOARD_KEYS.matches({ limit: 2 }),
      DASHBOARD_KEYS.upcoming(),
      DASHBOARD_KEYS.showcase(),
      DASHBOARD_KEYS.stats(),
    ];
    for (const key of keys) client.setQueryData(key, {});
    const { result } = renderHook(
      () => ({
        accept: useAcceptMatchMutation(),
        reject: useRejectMatchMutation(),
        bump: useShowcaseBumpMutation(),
      }),
      { wrapper: Wrapper },
    );
    await act(async () => {
      if (operation === "reject")
        await result.current.reject.mutateAsync({ id: "request-1", data: {} });
      else await result.current[operation].mutateAsync({ id: "request-1" });
    });
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual(
      operation === "bump"
        ? [false, false, false, true, false]
        : [true, true, false, false, false],
    );
    const url =
      operation === "bump"
        ? "/api/v1/showcase/request-1/bump"
        : `/api/v1/matchmaking/requests/request-1/${operation}`;
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ url, method: "POST" }),
    );
  });
});

describe("Оптимистическое обновление поиска собеседника", () => {
  const data = {
    isSearching: true,
    specialization: "FRONTEND",
    level: "JUNIOR",
  } as const;

  it.each([
    null,
    { status: "IDLE" } as LiveMatchState,
  ])("восстанавливает состояние %s при ошибке", async (previous) => {
    client.setQueryData(DASHBOARD_KEYS.liveMatch(), previous);
    let rejectRequest: (error: Error) => void = () => {};
    request = vi.fn(
      () =>
        new Promise((_resolve, reject) => {
          rejectRequest = reject;
        }),
    );
    const { result } = renderHook(
      () => ({
        mutation: useLiveMatchMutation(),
        state: useLiveMatchStateQuery(),
      }),
      { wrapper: Wrapper },
    );
    let completion: Promise<unknown> = Promise.resolve();
    act(() => {
      completion = result.current.mutation
        .mutateAsync({ data })
        .catch((error: unknown) => error);
    });
    await waitFor(() =>
      expect(result.current.state.data?.status).toBe("SEARCHING"),
    );
    const error = new Error("offline");
    await act(async () => {
      rejectRequest(error);
      await completion;
    });
    expect(client.getQueryData(DASHBOARD_KEYS.liveMatch())).toEqual(previous);
    await waitFor(() => expect(result.current.mutation.error).toBe(error));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("использует только серверный статус MATCHED и отклоняет одновременные переключения без повреждения кеша", async () => {
    let resolveRequest: (value: LiveMatchState) => void = () => {};
    request = vi.fn(
      () =>
        new Promise<LiveMatchState>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    client.setQueryData(DASHBOARD_KEYS.upcoming(), { hasUpcoming: false });
    const { result } = renderHook(
      () => ({
        first: useLiveMatchMutation(),
        second: useLiveMatchMutation(),
        state: useLiveMatchStateQuery(),
      }),
      { wrapper: Wrapper },
    );
    let completion: Promise<unknown> = Promise.resolve();
    act(() => {
      completion = result.current.first.mutateAsync({ data });
    });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(client.getQueryData(DASHBOARD_KEYS.liveMatch())).toEqual({
      status: "SEARCHING",
    });
    await act(async () => {
      await expect(
        result.current.second.mutateAsync({
          data: { ...data, isSearching: false },
        }),
      ).rejects.toThrow("already pending");
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(DASHBOARD_KEYS.liveMatch())).toEqual({
      status: "SEARCHING",
    });
    const matched: LiveMatchState = {
      status: "MATCHED",
      sessionId: "session-1",
    };
    await act(async () => {
      resolveRequest(matched);
      await completion;
    });
    expect(client.getQueryData(DASHBOARD_KEYS.liveMatch())).toEqual(matched);
    expect(client.getQueryState(DASHBOARD_KEYS.upcoming())?.isInvalidated).toBe(
      true,
    );
  });

  it("очищает данные найденного собеседника при остановке и не инвалидирует ближайшую сессию для IDLE", async () => {
    client.setQueryData(DASHBOARD_KEYS.liveMatch(), {
      status: "MATCHED",
      sessionId: "old",
    });
    client.setQueryData(DASHBOARD_KEYS.upcoming(), { hasUpcoming: false });
    request = vi.fn(async () => ({ status: "IDLE" }));
    const { result } = renderHook(() => useLiveMatchMutation(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync({
        data: { ...data, isSearching: false },
      });
    });
    expect(client.getQueryData(DASHBOARD_KEYS.liveMatch())).toEqual({
      status: "IDLE",
    });
    expect(client.getQueryState(DASHBOARD_KEYS.upcoming())?.isInvalidated).toBe(
      false,
    );
  });
});
