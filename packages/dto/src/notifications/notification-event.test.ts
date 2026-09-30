import { describe, expect, it } from "vitest";

import {
  buildDedupKey,
  interviewMatchProposedEventSchema,
  notificationEventCategory,
  notificationEventSchema,
  parseNotificationEvent,
} from "./notification-event";

const RECIPIENT = "11111111-1111-4111-a111-111111111111";
const SESSION = "22222222-2222-4222-a222-222222222222";
const SLOT = "33333333-3333-4333-a333-333333333333";

const matchProposed = {
  type: "interview.match_proposed" as const,
  payload: {
    sessionId: SESSION,
    proposedSlotId: SLOT,
    proposedStartUtc: "2026-10-01T09:00:00.000Z",
    senderName: "Иван",
  },
};

describe("notificationEventSchema", () => {
  it("разбирает известный тип события", () => {
    const result = notificationEventSchema.safeParse(matchProposed);
    expect(result.success).toBe(true);
  });

  it("отклоняет неизвестный тип события", () => {
    const result = notificationEventSchema.safeParse({
      type: "system.not_a_real_event",
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("отбрасывает лишние поля payload, а не падает", () => {
    const result = notificationEventSchema.safeParse({
      ...matchProposed,
      payload: { ...matchProposed.payload, unexpected: "value" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).not.toHaveProperty("unexpected");
    }
  });

  it.each([
    "email",
    "telegramChatId",
    "githubId",
    "ip",
    "userAgent",
  ])("выбрасывает запрещённое поле %s из payload", (field) => {
    const result = interviewMatchProposedEventSchema.safeParse({
      ...matchProposed,
      payload: {
        ...matchProposed.payload,
        [field]: "secret-value",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).not.toHaveProperty(field);
      expect(Object.values(result.data.payload)).not.toContain("secret-value");
    }
  });

  it("не принимает payload без обязательного UTC-инстанта", () => {
    const { proposedStartUtc: _omitted, ...payloadWithoutInstant } =
      matchProposed.payload;
    const result = interviewMatchProposedEventSchema.safeParse({
      ...matchProposed,
      payload: payloadWithoutInstant,
    });
    expect(result.success).toBe(false);
  });
});

describe("parseNotificationEvent", () => {
  it("возвращает очищенное событие на границе публикации", () => {
    const parsed = parseNotificationEvent({
      ...matchProposed,
      payload: { ...matchProposed.payload, email: "leak@example.com" },
    });
    expect(parsed.payload).not.toHaveProperty("email");
  });

  it("бросает на невалидном событии", () => {
    expect(() =>
      parseNotificationEvent({ type: "nope", payload: {} }),
    ).toThrow();
  });
});

describe("notificationEventCategory", () => {
  it("отдаёт канал-агрегат для каждого типа события", () => {
    expect(notificationEventCategory["system.welcome"]).toBe("SYSTEM");
    expect(notificationEventCategory["interview.match_proposed"]).toBe(
      "INTERVIEW",
    );
    expect(notificationEventCategory["interview.slot_booked"]).toBe(
      "INTERVIEW",
    );
  });
});

describe("buildDedupKey", () => {
  it("одинаков для одинакового события", () => {
    expect(buildDedupKey(matchProposed, RECIPIENT)).toBe(
      buildDedupKey(
        { ...matchProposed, payload: { ...matchProposed.payload } },
        RECIPIENT,
      ),
    );
  });

  it("не меняется при переименовании отправителя", () => {
    const renamed = {
      ...matchProposed,
      payload: { ...matchProposed.payload, senderName: "Иван Петров" },
    };
    expect(buildDedupKey(renamed, RECIPIENT)).toBe(
      buildDedupKey(matchProposed, RECIPIENT),
    );
  });

  it("различается по получателю", () => {
    const other = "44444444-4444-4444-a444-444444444444";
    expect(buildDedupKey(matchProposed, other)).not.toBe(
      buildDedupKey(matchProposed, RECIPIENT),
    );
  });

  it("различается по слоту", () => {
    const otherSlot = "55555555-5555-4555-a555-555555555555";
    const moved = {
      ...matchProposed,
      payload: { ...matchProposed.payload, proposedSlotId: otherSlot },
    };
    expect(buildDedupKey(moved, RECIPIENT)).not.toBe(
      buildDedupKey(matchProposed, RECIPIENT),
    );
  });
});
