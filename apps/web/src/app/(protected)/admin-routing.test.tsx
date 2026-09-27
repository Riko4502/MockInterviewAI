import "@testing-library/jest-dom/vitest";
import { Buffer } from "node:buffer";
import type { UserProfileDto } from "@packages/api";
import { SystemRole } from "@packages/types";
import { ToastProvider } from "@packages/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/entities/session";
import {
  authToken,
  initApiTransport,
  resetApiTransportState,
} from "@/shared/api";
import { paths } from "@/shared/config";
import i18n from "@/shared/lib/i18n";
import AdminLayout from "./admin/layout";
import ForbiddenPage from "./forbidden/page";
import ProtectedLayout from "./layout";

const router = { replace: vi.fn(), back: vi.fn() };
const searchParams = new URLSearchParams();
const http = vi.fn<typeof fetch>();
let pathname: string;
let client: QueryClient;
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

function route(content: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>
        <ToastProvider>
          <ProtectedLayout>{content}</ProtectedLayout>
        </ToastProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}
const administrativeContent = vi.fn(() => <div>Administrative content</div>);
const AdministrativeContent = administrativeContent;
function adminRoute() {
  return route(
    <AdminLayout>
      <AdministrativeContent />
    </AdminLayout>,
  );
}
function refreshResponse() {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const iat = Math.floor(Date.now() / 1000);
  const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "user-1", sid: "session-1", permissions: 0, typ: "access", iat, exp: iat + 900 })}.signature`;
  return Response.json({ accessToken });
}
function profileResponse(role: SystemRole) {
  const profile: UserProfileDto = {
    id: "user-1",
    role,
    permissions: "0",
    email: "test@example.com",
    displayName: null,
    username: null,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
  return Response.json(profile);
}

beforeEach(async () => {
  vi.clearAllMocks();
  http.mockReset();
  pathname = paths.adminUsers;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
  vi.stubGlobal("fetch", http);
  authToken.clear();
  resetApiTransportState();
  initApiTransport();
  await i18n.changeLanguage("ru");
});
afterEach(() => {
  cleanup();
  client.clear();
  authToken.clear();
  resetApiTransportState();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("protected admin route integration", () => {
  it("allows restored ADMIN through both layouts", async () => {
    http
      .mockResolvedValueOnce(refreshResponse())
      .mockResolvedValueOnce(profileResponse(SystemRole.ADMIN));
    render(adminRoute());
    expect(
      await screen.findByText("Administrative content"),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it("Перенаправляет USER на dashboard с Toast без монтирования админского контента", async () => {
    http
      .mockResolvedValueOnce(refreshResponse())
      .mockResolvedValueOnce(profileResponse(SystemRole.USER));
    render(adminRoute());
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledExactlyOnceWith(paths.dashboard),
    );
    expect(administrativeContent).not.toHaveBeenCalled();
    expect(screen.getByText("Недостаточно прав")).toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
  });
  it("does not mount admin content during restoration or while the profile role is unknown", async () => {
    let completeRefresh!: (response: Response) => void;
    let completeProfile!: (response: Response) => void;
    http
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          completeRefresh = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          completeProfile = resolve;
        }),
      );
    render(adminRoute());
    expect(administrativeContent).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      completeRefresh(refreshResponse());
    });
    await waitFor(() => expect(http).toHaveBeenCalledTimes(2));
    expect(administrativeContent).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => {
      completeProfile(profileResponse(SystemRole.ADMIN));
    });
    expect(
      await screen.findByText("Administrative content"),
    ).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it.each([
    401, 500,
  ])("keeps the existing authentication redirect when restoration returns %s", async (status) => {
    http.mockResolvedValueOnce(Response.json({}, { status }));
    render(adminRoute());
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledExactlyOnceWith(
        `${paths.login}?returnTo=${paths.adminUsers}`,
      ),
    );
    expect(administrativeContent).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("also leaves authentication of the Forbidden page to the protected layout", async () => {
    pathname = paths.forbidden;
    http.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    render(route(<ForbiddenPage />));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledExactlyOnceWith(
        `${paths.login}?returnTo=${paths.forbidden}`,
      ),
    );
    expect(
      screen.queryByRole("heading", { name: "Доступ ограничен" }),
    ).not.toBeInTheDocument();
  });
});
