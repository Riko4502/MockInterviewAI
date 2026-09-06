import {
  authControllerLogin,
  authControllerRegister,
  resetHttpTransport,
} from "@packages/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initApiTransport, resetApiTransportState } from "@/shared/api";
import { baseFetch } from "@/shared/api/base";

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

describe("Auth Forms API Integration (@packages/api)", () => {
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

  it("authControllerLogin отправляет POST /api/v1/auth/login через baseFetch", async () => {
    vi.mocked(baseFetch).mockResolvedValueOnce({
      accessToken: "mock-login-token-123",
    });

    const result = await authControllerLogin({
      email: "test@example.com",
      password: "securePassword123",
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "securePassword123",
        }),
      }),
    );
    expect(result).toEqual({ accessToken: "mock-login-token-123" });
  });

  it("authControllerRegister отправляет POST /api/v1/auth/register через baseFetch", async () => {
    vi.mocked(baseFetch).mockResolvedValueOnce({
      accessToken: "mock-register-token-456",
    });

    const result = await authControllerRegister({
      email: "newuser@example.com",
      password: "securePassword123",
      passwordConfirmation: "securePassword123",
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/auth/register",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "newuser@example.com",
          password: "securePassword123",
          passwordConfirmation: "securePassword123",
        }),
      }),
    );
    expect(result).toEqual({ accessToken: "mock-register-token-456" });
  });
});
