import { describe, expect, it } from "vitest";

import {
  parsePushEvent,
  pushEventSchema,
  securityNotificationEventSchema,
} from "./security-notification-event";

const unlinkCode = {
  type: "security.telegram_unlink_code" as const,
  payload: { code: "123456", ttlMinutes: 10 },
};

const telegramUnlinked = {
  type: "security.telegram_unlinked" as const,
  payload: { occurredAt: "2026-10-01T09:00:00.000Z" },
};

const githubUnlinked = {
  type: "security.github_unlinked" as const,
  payload: { occurredAt: "2026-10-01T09:00:00.000Z" },
};

describe("securityNotificationEventSchema", () => {
  it.each([
    unlinkCode,
    telegramUnlinked,
    githubUnlinked,
  ])("разбирает событие $type", (event) => {
    expect(securityNotificationEventSchema.safeParse(event).success).toBe(true);
  });

  it("отклоняет неизвестный security-тип", () => {
    expect(
      securityNotificationEventSchema.safeParse({
        type: "security.not_real",
        payload: {},
      }).success,
    ).toBe(false);
  });

  it("требует ровно шесть цифр в коде отвязки", () => {
    expect(
      securityNotificationEventSchema.safeParse({
        type: "security.telegram_unlink_code",
        payload: { code: "12345", ttlMinutes: 10 },
      }).success,
    ).toBe(false);
  });

  it("отбрасывает ip/userAgent из payload отвязки (ADR-005:128)", () => {
    const result = securityNotificationEventSchema.safeParse({
      ...telegramUnlinked,
      payload: {
        ...telegramUnlinked.payload,
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).not.toHaveProperty("ipAddress");
      expect(result.data.payload).not.toHaveProperty("userAgent");
    }
  });
});

describe("parsePushEvent", () => {
  it("принимает и доменное уведомление, и security-событие", () => {
    expect(
      pushEventSchema.safeParse({
        type: "system.welcome",
        payload: {},
      }).success,
    ).toBe(true);
    expect(parsePushEvent(githubUnlinked).type).toBe(
      "security.github_unlinked",
    );
  });

  it("бросает на неизвестном типе — граница доверия очереди", () => {
    expect(() =>
      parsePushEvent({ type: "system.not_real", payload: {} }),
    ).toThrow();
  });
});
