import "@testing-library/jest-dom/vitest";
import { getHttpTransport } from "@packages/api";
import { ToastProvider } from "@packages/ui";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authToken,
  createQueryClient,
  HttpError,
  initApiTransport,
  resetApiTransportState,
} from "@/shared/api";
import i18n from "@/shared/lib/i18n";
import { ApiErrorNotifications } from "./ApiErrorNotifications";

const http = vi.fn<typeof fetch>();
beforeEach(async () => {
  http.mockReset();
  vi.stubGlobal("fetch", http);
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
  authToken.set("valid-token");
  resetApiTransportState();
  initApiTransport();
  await i18n.changeLanguage("ru");
});
afterEach(() => {
  cleanup();
  authToken.clear();
  resetApiTransportState();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function mount() {
  return render(
    <StrictMode>
      <ToastProvider>
        <ApiErrorNotifications />
      </ToastProvider>
    </StrictMode>,
  );
}
function forbiddenResponses() {
  http.mockImplementation(async () =>
    Response.json({ message: "Forbidden from server" }, { status: 403 }),
  );
}
const request = () => getHttpTransport()({ url: "/restricted", method: "GET" });

describe("API Forbidden notifications", () => {
  it("renders one existing-system toast for concurrent 403 responses and preserves all rejections", async () => {
    forbiddenResponses();
    mount();
    const location = window.location.href;
    let results: PromiseSettledResult<unknown>[] = [];
    await act(async () => {
      results = await Promise.allSettled([request(), request(), request()]);
    });
    for (const result of results) {
      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBeInstanceOf(HttpError);
        expect(result.reason).toMatchObject({
          status: 403,
          message: "Forbidden from server",
        });
      }
    }
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    expect(screen.getByText("Недостаточно прав")).toBeInTheDocument();
    expect(
      screen.getByText("У вас нет прав для выполнения этого действия."),
    ).toBeInTheDocument();
    expect(authToken.get()).toBe("valid-token");
    expect(window.location.href).toBe(location);
    expect(http).toHaveBeenCalledTimes(3);
    expect(
      http.mock.calls.every(([url]) => String(url).endsWith("/restricted")),
    ).toBe(true);
  });

  it("keeps background Query errors and bounded retries without destroying the session", async () => {
    forbiddenResponses();
    mount();
    const client = createQueryClient();
    try {
      await act(async () => {
        await expect(
          client.fetchQuery({
            queryKey: ["forbidden-test"],
            queryFn: request,
            retryDelay: 0,
          }),
        ).rejects.toMatchObject({ status: 403 });
      });
      expect(client.getQueryState(["forbidden-test"])?.status).toBe("error");
      expect(http).toHaveBeenCalledTimes(2);
      expect(authToken.get()).toBe("valid-token");
      expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(1);
    } finally {
      client.clear();
    }
  });

  it("unsubscribes when the notification bridge unmounts", async () => {
    forbiddenResponses();
    const view = mount();
    view.rerender(<ToastProvider />);
    await act(async () => {
      await expect(request()).rejects.toMatchObject({ status: 403 });
    });
    expect(document.querySelectorAll('[data-slot="toast"]')).toHaveLength(0);
  });
});
