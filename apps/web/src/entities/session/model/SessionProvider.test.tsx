import {
  getProfileControllerGetMyProfileQueryKey,
  type UserProfileDto,
} from "@packages/api";
import { SystemRole } from "@packages/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authToken,
  initApiTransport,
  resetApiTransportState,
} from "@/shared/api";
import { createAccessToken } from "../lib/test-token";
import { SessionProvider } from "./SessionProvider";
import { useSession } from "./useSession";

const http = vi.fn<typeof fetch>();
let client: QueryClient;
function profile(role: string, id = "user-1"): UserProfileDto {
  return {
    id,
    role,
    permissions: "0",
    theme: "system",
    locale: "ru",
    email: "test@example.com",
    displayName: null,
    username: null,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}
function mount() {
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
  return renderHook(useSession, { wrapper });
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  http.mockReset();
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
  vi.stubGlobal("fetch", http);
  authToken.clear();
  resetApiTransportState();
  initApiTransport();
});
afterEach(() => {
  cleanup();
  client.clear();
  authToken.clear();
  resetApiTransportState();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("SessionProvider RBAC", () => {
  it.each([
    SystemRole.ADMIN,
    SystemRole.USER,
  ])("restores claims and synchronizes %s from profile", async (role) => {
    http
      .mockResolvedValueOnce(
        Response.json({ accessToken: createAccessToken({ permissions: 6 }) }),
      )
      .mockResolvedValueOnce(Response.json(profile(role)));
    const { result } = mount();
    await waitFor(() => expect(result.current?.role).toBe(role));
    expect(result.current).toMatchObject({
      userId: "user-1",
      permissions: 6n,
      isAuthenticated: true,
    });
    act(() =>
      client.setQueryData(
        getProfileControllerGetMyProfileQueryKey(),
        profile("CUSTOM"),
      ),
    );
    await waitFor(() => expect(result.current.role).toBe("CUSTOM"));
    act(() =>
      authToken.set(createAccessToken({ permissions: "9007199254740993" })),
    );
    expect(result.current.permissions).toBe(9007199254740993n);
    act(() => result.current.clearSession());
    expect(authToken.get()).toBeNull();
    expect(result.current).toMatchObject({
      userId: null,
      role: null,
      permissions: 0n,
      isAuthenticated: false,
      status: "unauthenticated",
    });
  });
  it("rejects invalid restored and login tokens, then accepts a valid login", async () => {
    http.mockResolvedValueOnce(Response.json({ accessToken: "invalid" }));
    const { result } = mount();
    await waitFor(() => expect(result.current?.status).toBe("unauthenticated"));
    expect(authToken.get()).toBeNull();
    act(() => result.current.startSession("invalid"));
    expect(result.current.permissions).toBe(0n);
    expect(http).toHaveBeenCalledTimes(1);
    http.mockResolvedValueOnce(Response.json(profile(SystemRole.USER)));
    act(() => result.current.startSession(createAccessToken()));
    await waitFor(() => expect(result.current.role).toBe(SystemRole.USER));
    expect(result.current).toMatchObject({
      permissions: 0n,
      userId: "user-1",
      isAuthenticated: true,
    });
  });
  it("does not use a profile belonging to another user", async () => {
    http
      .mockResolvedValueOnce(
        Response.json({ accessToken: createAccessToken() }),
      )
      .mockResolvedValueOnce(
        Response.json(profile(SystemRole.ADMIN, "other-user")),
      );
    const { result } = mount();
    await waitFor(() =>
      expect(
        client.getQueryData(getProfileControllerGetMyProfileQueryKey()),
      ).toBeDefined(),
    );
    expect(result.current.role).toBeNull();
  });
  it("keeps permissions empty on a profile error and retains restored identity", async () => {
    http
      .mockResolvedValueOnce(
        Response.json({ accessToken: createAccessToken() }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 500 }));
    const { result } = mount();
    await waitFor(() =>
      expect(
        client.getQueryState(getProfileControllerGetMyProfileQueryKey())
          ?.status,
      ).toBe("error"),
    );
    expect(result.current).toMatchObject({
      isAuthenticated: true,
      role: null,
      permissions: 0n,
    });
  });
  it("retains restoration error handling", async () => {
    http.mockRejectedValueOnce(new Error("offline"));
    const { result } = mount();
    await waitFor(() => expect(result.current?.status).toBe("error"));
    expect(result.current).toMatchObject({
      isAuthenticated: false,
      userId: null,
      role: null,
      permissions: 0n,
    });
  });
});
