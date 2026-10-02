import { describe, expect, it } from "vitest";
import {
  aiReportReadyPayloadSchema,
  notificationNewPayloadSchema,
  parseSseEventPayload,
  type SseEventType,
  sseEventDescriptions,
  sseEventPayloadSchemas,
  sseEventTypeSchema,
  sseEventTypes,
  sseSeveritySchema,
  systemBroadcastPayloadSchema,
} from "./sse-event.dto";

/**
 * Словарь — источник правды для четырёх потребителей: продюсера в `apps/api`,
 * генератора Go-констант, клиентских Zod-схем и CLI. Тесты закрывают то, что
 * компилятор не может: полноту словаря и границу публикации.
 */

const validNotificationNew = {
  id: "22222222-2222-4222-a222-222222222222",
  category: "INTERVIEW",
  title: "Предложен слот",
  message: "Иван предлагает провести интервью 1 окт. 2026 г., 12:00.",
  actionUrl: "/interviews/123",
  createdAt: "2026-10-02T05:02:02.637Z",
  read: false,
};

describe("SSE event dictionary", () => {
  describe("sseEventTypeSchema", () => {
    it("принимает все типы из перечня", () => {
      for (const type of sseEventTypes) {
        expect(sseEventTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it("отклоняет неизвестный тип и heartbeat", () => {
      expect(sseEventTypeSchema.safeParse("notification.unknown").success).toBe(
        false,
      );
      // `ping` — SSE-комментарий, а не событие: у него нет ни type, ни payload.
      expect(sseEventTypeSchema.safeParse("ping").success).toBe(false);
    });
  });

  describe("полнота словаря", () => {
    it("у каждого типа события есть схема payload", () => {
      const schemaKeys = Object.keys(sseEventPayloadSchemas).sort();
      expect(schemaKeys).toEqual([...sseEventTypes].sort());
    });

    it("у каждого типа события есть описание для генератора Go-констант", () => {
      const descriptionKeys = Object.keys(sseEventDescriptions).sort();
      expect(descriptionKeys).toEqual([...sseEventTypes].sort());
    });
  });

  describe("severity отделена от category (ADR-004:87)", () => {
    it("не принимает визуальные значения в поле category", () => {
      const result = notificationNewPayloadSchema.safeParse({
        ...validNotificationNew,
        category: "warning",
      });

      expect(result.success).toBe(false);
    });

    it("не принимает доменные значения в поле severity", () => {
      const result = notificationNewPayloadSchema.safeParse({
        ...validNotificationNew,
        severity: "INTERVIEW",
      });

      expect(result.success).toBe(false);
    });

    it("оставляет severity необязательной в notification.new", () => {
      expect(
        notificationNewPayloadSchema.safeParse(validNotificationNew).success,
      ).toBe(true);
      expect(
        notificationNewPayloadSchema.safeParse({
          ...validNotificationNew,
          severity: "warning",
        }).success,
      ).toBe(true);
    });

    it("требует severity в system.broadcast", () => {
      expect(
        systemBroadcastPayloadSchema.safeParse({ message: "Техработы" })
          .success,
      ).toBe(false);
      expect(
        systemBroadcastPayloadSchema.safeParse({
          severity: "warning",
          message: "Техработы",
        }).success,
      ).toBe(true);
    });

    it("использует один словарь severity в обоих кадрах", () => {
      for (const value of ["info", "success", "warning", "error"]) {
        expect(sseSeveritySchema.safeParse(value).success).toBe(true);
      }
      // Значения из старой Go-таблицы SSE_SPEC (warn/crit) не словарные.
      expect(sseSeveritySchema.safeParse("warn").success).toBe(false);
      expect(sseSeveritySchema.safeParse("crit").success).toBe(false);
      expect(sseSeveritySchema.safeParse("critical").success).toBe(false);
    });
  });

  describe("notificationNewPayloadSchema", () => {
    it("принимает null и отсутствие actionUrl", () => {
      expect(
        notificationNewPayloadSchema.safeParse({
          ...validNotificationNew,
          actionUrl: null,
        }).success,
      ).toBe(true);
      const { actionUrl: _omitted, ...withoutActionUrl } = validNotificationNew;
      expect(
        notificationNewPayloadSchema.safeParse(withoutActionUrl).success,
      ).toBe(true);
    });

    it("требует createdAt в формате ISO-даты", () => {
      expect(
        notificationNewPayloadSchema.safeParse({
          ...validNotificationNew,
          createdAt: "02.10.2026 05:02",
        }).success,
      ).toBe(false);
    });

    it("не пропускает title и message: пустая строка — не текст уведомления", () => {
      expect(
        notificationNewPayloadSchema.safeParse({
          ...validNotificationNew,
          title: "",
        }).success,
      ).toBe(true);
      expect(
        notificationNewPayloadSchema.safeParse({
          ...validNotificationNew,
          title: undefined,
        }).success,
      ).toBe(false);
    });
  });

  describe("parseSseEventPayload", () => {
    it("возвращает проверенный payload", () => {
      expect(
        parseSseEventPayload("notification.new", validNotificationNew),
      ).toEqual(validNotificationNew);
    });

    it("отбрасывает лишние поля, а не публикует их в браузер", () => {
      const parsed = parseSseEventPayload("notification.badge", {
        unreadCount: 1,
        internal: "secret",
      });

      expect(parsed).toEqual({ unreadCount: 1 });
    });

    it("бросает на payload, не соответствующем словарю", () => {
      expect(() =>
        parseSseEventPayload("ai.report_ready", { sessionId: "s-1" }),
      ).toThrow(/does not match the dictionary/);
    });

    it("бросает на неизвестном типе события", () => {
      expect(() =>
        parseSseEventPayload("notification.explode" as SseEventType, {}),
      ).toThrow(/is not in the dictionary/);
    });

    it("ловит опечатку в имени поля, которая раньше уезжала в браузер молча", () => {
      // `executionTimeMs` вместо `timeMs`: apps/realtime не декодирует payload,
      // поэтому без проверки на границе публикации кадр был бы валидным JSON.
      expect(() =>
        parseSseEventPayload("code_runner.status", {
          taskId: "t-1",
          sessionId: "s-1",
          status: "passed",
          passedCount: 1,
          totalCount: 1,
          timeMs: 10,
        }),
      ).toThrow(/does not match the dictionary/);
    });
  });

  describe("aiReportReadyPayloadSchema", () => {
    it("требует reportUrl и score", () => {
      expect(
        aiReportReadyPayloadSchema.safeParse({
          sessionId: "s-1",
          reportId: "r-1",
          score: 80,
          summary: "ok",
          reportUrl: "https://example.com/r/1",
        }).success,
      ).toBe(true);
      expect(
        aiReportReadyPayloadSchema.safeParse({ sessionId: "s-1" }).success,
      ).toBe(false);
    });
  });
});
