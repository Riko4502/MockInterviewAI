import { resetHttpTransport } from "@packages/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";
import { getTicket } from "./ticket";

vi.mock("@/shared/api/base", () => ({
  baseFetch: vi.fn(),
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = "AuthError";
    }
  },
}));

describe("getTicket (migrated to @packages/api)", () => {
  beforeEach(() => {
    resetApiTransportState();
    resetHttpTransport();
    initApiTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetApiTransportState();
    resetHttpTransport();
  });

  it("должен получать тикет через generated API и базовый транспорт", async () => {
    vi.mocked(baseFetch).mockResolvedValueOnce({
      ticket: "mocked-jwt-realtime-ticket-123",
    });

    const ticket = await getTicket("test-session-uuid-456");

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/realtime/ticket",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "test-session-uuid-456" }),
      }),
    );
    expect(ticket).toBe("mocked-jwt-realtime-ticket-123");
  });

  it("должен корректно пробрасывать ошибку если baseFetch вернул ошибку", async () => {
    vi.mocked(baseFetch).mockRejectedValueOnce(new Error("Network failure"));

    await expect(getTicket("session-error")).rejects.toThrow("Network failure");
  });
});
