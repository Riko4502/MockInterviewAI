import "@testing-library/jest-dom/vitest";
import { useProfileControllerGetMyProfile } from "@packages/api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionProvider } from "@/entities/session";
import {
  authToken,
  initApiTransport,
  resetApiTransportState,
} from "@/shared/api";
import { useLogout } from "../model/use-logout";
import { AuthBoundary } from "./AuthBoundary";

const replace = vi.fn();
const router = { replace };
const searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/dashboard",
  useSearchParams: () => searchParams,
}));

function Dashboard() {
  const profile = useProfileControllerGetMyProfile();
  const { logout } = useLogout();
  return (
    <div>
      <h1>Dashboard</h1>
      <p>{profile.data?.email}</p>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

describe("Восстановление сессии после полной загрузки dashboard", () => {
  let client: QueryClient;
  const http = vi.fn<typeof fetch>();

  function mount() {
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={client}>
        <SessionProvider>
          <AuthBoundary mode="protected">
            <Dashboard />
          </AuthBoundary>
        </SessionProvider>
      </QueryClientProvider>,
    );
  }
  function successfulResponses(token: string) {
    http
      .mockResolvedValueOnce(Response.json({ accessToken: token }))
      .mockResolvedValueOnce(
        Response.json({ email: "github-user@example.com" }),
      );
  }

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    http.mockReset();
    vi.stubGlobal("fetch", http);
    replace.mockReset();
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

  it("ожидает обновления токена через cookie перед показом защищённого содержимого и загрузкой профиля", async () => {
    let completeRefresh!: (response: Response) => void;
    http
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          completeRefresh = resolve;
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ email: "github-user@example.com" }),
      );
    mount();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(http).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/auth/refresh",
      { method: "POST", credentials: "include" },
    );

    completeRefresh(Response.json({ accessToken: "restored-access" }));
    await screen.findByText("github-user@example.com");
    expect(authToken.get()).toBe("restored-access");
    const [url, options] = http.mock.calls[1];
    expect(url).toBe("https://api.example.com/api/v1/profile/me");
    expect(options?.credentials).toBe("include");
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer restored-access",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("повторно восстанавливает сессию при перезагрузке без постоянного хранения access token", async () => {
    successfulResponses("first-access");
    const first = mount();
    await screen.findByText("github-user@example.com");
    first.unmount();
    client.clear();
    authToken.clear();

    successfulResponses("reloaded-access");
    mount();
    await screen.findByText("github-user@example.com");
    expect(authToken.get()).toBe("reloaded-access");
    expect(
      http.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh")),
    ).toHaveLength(2);
    expect(replace).not.toHaveBeenCalled();
  });

  it("использует общую мутацию выхода и очищает токен и кеш запросов", async () => {
    successfulResponses("oauth-session-access");
    mount();
    await screen.findByText("github-user@example.com");
    http.mockResolvedValueOnce(new Response(null, { status: 204 }));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(authToken.get()).toBeNull());
    expect(http).toHaveBeenLastCalledWith(
      "https://api.example.com/api/v1/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(replace).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("перенаправляет на страницу входа при отсутствии или истечении refresh cookie", async () => {
    http.mockResolvedValueOnce(Response.json({}, { status: 401 }));
    mount();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/login?returnTo=/dashboard"),
    );
    expect(authToken.get()).toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(http).toHaveBeenCalledTimes(1);
  });
});
