import { AuthThrottlerGuard } from "./auth-throttler.guard";

describe("AuthThrottlerGuard", () => {
  let guard: AuthThrottlerGuard;

  beforeAll(() => {
    guard = Object.create(AuthThrottlerGuard.prototype) as AuthThrottlerGuard;
  });

  // В @nestjs/throttler v6 getTracker получает request (см. handleRequest)
  it("формирует tracker из ip и email (§41 SPEC.md)", async () => {
    const tracker = await guard.getTracker({
      ip: "203.0.113.7",
      body: { email: "user@example.com" },
    });

    expect(tracker).toBe("203.0.113.7:user@example.com");
  });

  it("без email в body использует только ip", async () => {
    const tracker = await guard.getTracker({ ip: "203.0.113.7", body: {} });

    expect(tracker).toBe("203.0.113.7");
  });

  it("при отсутствии body использует только ip", async () => {
    const tracker = await guard.getTracker({ ip: "203.0.113.7" });

    expect(tracker).toBe("203.0.113.7");
  });

  it("fallback на socket.remoteAddress при отсутствии ip", async () => {
    const tracker = await guard.getTracker({
      socket: { remoteAddress: "198.51.100.2" },
      body: { email: "user@example.com" },
    });

    expect(tracker).toBe("198.51.100.2:user@example.com");
  });

  it("возвращает unknown с префиксом если ip и remoteAddress отсутствуют", async () => {
    const tracker = await guard.getTracker({
      body: { email: "user@example.com" },
    });

    expect(tracker).toBe("unknown:user@example.com");
  });

  it("возвращает unknown без разделителя при полном отсутствии данных", async () => {
    const tracker = await guard.getTracker({});

    expect(tracker).toBe("unknown");
  });
});
