import type { ExecutionContext } from "@nestjs/common";
import { AuthThrottlerGuard } from "./auth-throttler.guard";

function createContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("AuthThrottlerGuard", () => {
  let guard: AuthThrottlerGuard;

  beforeAll(() => {
    guard = Object.create(AuthThrottlerGuard.prototype) as AuthThrottlerGuard;
  });

  it("формирует tracker из ip и email (§41 SPEC.md)", async () => {
    const tracker = await guard.getTracker(
      createContext({
        ip: "203.0.113.7",
        body: { email: "user@example.com" },
      }),
    );

    expect(tracker).toBe("203.0.113.7:user@example.com");
  });

  it("без email в body использует только ip", async () => {
    const tracker = await guard.getTracker(
      createContext({ ip: "203.0.113.7", body: {} }),
    );

    expect(tracker).toBe("203.0.113.7");
  });

  it("при отсутствии body использует только ip", async () => {
    const tracker = await guard.getTracker(
      createContext({ ip: "203.0.113.7" }),
    );

    expect(tracker).toBe("203.0.113.7");
  });

  it("fallback на socket.remoteAddress при отсутствии ip", async () => {
    const tracker = await guard.getTracker(
      createContext({
        socket: { remoteAddress: "198.51.100.2" },
        body: { email: "user@example.com" },
      }),
    );

    expect(tracker).toBe("198.51.100.2:user@example.com");
  });

  it("возвращает unknown с префиксом если ip и remoteAddress отсутствуют", async () => {
    const tracker = await guard.getTracker(
      createContext({ body: { email: "user@example.com" } }),
    );

    expect(tracker).toBe("unknown:user@example.com");
  });

  it("возвращает unknown без разделителя при полном отсутствии данных", async () => {
    const tracker = await guard.getTracker(createContext({}));

    expect(tracker).toBe("unknown");
  });
});
