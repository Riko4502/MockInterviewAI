import { describe, expect, it } from "vitest";

import {
  markSecurityEventSeenResponseSchema,
  securityEventSchema,
  unseenSecurityEventsResponseSchema,
} from "./security-event.dto";

const EVENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("securityEventSchema", () => {
  it("принимает событие с валидным типом и ISO-временем", () => {
    const result = securityEventSchema.safeParse({
      id: EVENT_ID,
      type: "TG_UNLINKED",
      createdAt: "2026-10-01T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет неизвестный тип события", () => {
    const result = securityEventSchema.safeParse({
      id: EVENT_ID,
      type: "NOT_A_REAL_TYPE",
      createdAt: "2026-10-01T09:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it.each([
    "ipAddress",
    "userAgent",
    "metadata",
  ])("отбрасывает поле %s — ADR-005:128 запрещает вынос в публичный DTO", (field) => {
    const result = securityEventSchema.safeParse({
      id: EVENT_ID,
      type: "GITHUB_UNLINKED",
      createdAt: "2026-10-01T09:00:00.000Z",
      [field]: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty(field);
    }
  });
});

describe("unseenSecurityEventsResponseSchema", () => {
  it("принимает пустой список", () => {
    expect(
      unseenSecurityEventsResponseSchema.safeParse({ items: [] }).success,
    ).toBe(true);
  });

  it("отклоняет невалидный элемент списка", () => {
    expect(
      unseenSecurityEventsResponseSchema.safeParse({
        items: [{ id: EVENT_ID, type: "WRONG", createdAt: "x" }],
      }).success,
    ).toBe(false);
  });
});

describe("markSecurityEventSeenResponseSchema", () => {
  it("принимает только success: true", () => {
    expect(
      markSecurityEventSeenResponseSchema.safeParse({ success: true }).success,
    ).toBe(true);
    expect(
      markSecurityEventSeenResponseSchema.safeParse({ success: false }).success,
    ).toBe(false);
  });
});
