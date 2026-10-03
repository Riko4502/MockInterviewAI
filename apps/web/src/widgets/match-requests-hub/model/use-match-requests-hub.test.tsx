import { getMatchmakingControllerGetUnreadCountQueryKey } from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMatchRequestsHub } from "./use-match-requests-hub";

const mockMutateAccept = vi.fn();
const mockMutateReject = vi.fn();
const mockMutateCancel = vi.fn();

vi.mock("@packages/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@packages/api")>();
  return {
    ...actual,
    useMatchmakingControllerFindIncoming: () => ({
      data: { data: [{ id: "req-1", status: "PENDING" }] },
      isLoading: false,
    }),
    useMatchmakingControllerFindOutgoing: () => ({
      data: { data: [] },
      isLoading: false,
    }),
    useMatchmakingControllerAccept: () => ({
      mutate: mockMutateAccept,
      isPending: false,
    }),
    useMatchmakingControllerReject: () => ({
      mutate: mockMutateReject,
      isPending: false,
    }),
    useMatchmakingControllerCancel: () => ({
      mutate: mockMutateCancel,
      isPending: false,
    }),
  };
});

vi.mock("@packages/ui", () => ({
  useToast: () => ({
    push: vi.fn(),
  }),
}));

describe("useMatchRequestsHub", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it("handleAccept оптимистично уменьшает pendingCount в кэше", async () => {
    const unreadKey = getMatchmakingControllerGetUnreadCountQueryKey();
    queryClient.setQueryData(unreadKey, { pendingCount: 3 });

    const { result } = renderHook(() => useMatchRequestsHub(), { wrapper });

    await act(async () => {
      await result.current.handleAccept("req-1");
    });

    const cachedData = queryClient.getQueryData<{ pendingCount: number }>(
      unreadKey,
    );
    expect(cachedData).toEqual({ pendingCount: 2 });
  });

  it("handleReject оптимистично уменьшает pendingCount в кэше", async () => {
    const unreadKey = getMatchmakingControllerGetUnreadCountQueryKey();
    queryClient.setQueryData(unreadKey, { pendingCount: 1 });

    const { result } = renderHook(() => useMatchRequestsHub(), { wrapper });

    await act(async () => {
      await result.current.handleReject("req-1");
    });

    const cachedData = queryClient.getQueryData<{ pendingCount: number }>(
      unreadKey,
    );
    expect(cachedData).toEqual({ pendingCount: 0 });
  });
});
