import { describe, expect, it } from "vitest";
import {
  roomErrorEnvelopeSchema,
  roomErrorPayloadSchema,
  taskSwitchEnvelopeSchema,
  taskSwitchedEnvelopeSchema,
  taskSwitchedPayloadSchema,
  taskSwitchPayloadSchema,
  YJS_MAX_BASE64_LENGTH,
  YJS_SNAPSHOT_MAX_BASE64_LENGTH,
  yjsAckEnvelopeSchema,
  yjsAckPayloadSchema,
  yjsAwarenessEnvelopeSchema,
  yjsAwarenessPayloadSchema,
  yjsInitEnvelopeSchema,
  yjsInitPayloadSchema,
  yjsSnapshotDataSchema,
  yjsSnapshotEnvelopeSchema,
  yjsSnapshotPayloadSchema,
  yjsUpdateEnvelopeSchema,
  yjsUpdatePayloadSchema,
} from "./websocket-events.dto";

describe("Yjs WebSocket DTO Validation", () => {
  const validBase64 = "aGVsbG8gd29ybGQgYmluYXJ5IGRhdGE=";
  const validTaskKey = "task-123:typescript";
  const validUpdateId = "client-1:1";

  describe("yjsUpdatePayloadSchema", () => {
    it("успешно валидирует корректный payload", () => {
      const result = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
        data: validBase64,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.taskKey).toBe(validTaskKey);
        expect(result.data.updateId).toBe(validUpdateId);
        expect(result.data.data).toBe(validBase64);
      }
    });

    it("отклоняет отсутствующий или пустой taskKey", () => {
      const missingResult = yjsUpdatePayloadSchema.safeParse({
        updateId: validUpdateId,
        data: validBase64,
      });
      expect(missingResult.success).toBe(false);

      const emptyResult = yjsUpdatePayloadSchema.safeParse({
        taskKey: "",
        updateId: validUpdateId,
        data: validBase64,
      });
      expect(emptyResult.success).toBe(false);
    });

    it("отклоняет отсутствующий или пустой updateId", () => {
      const missingResult = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        data: validBase64,
      });
      expect(missingResult.success).toBe(false);

      const emptyResult = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: "",
        data: validBase64,
      });
      expect(emptyResult.success).toBe(false);
    });

    it("отклоняет пустые данные data", () => {
      const result = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
        data: "",
      });
      expect(result.success).toBe(false);
    });

    it("отклоняет невалидный формат Base64", () => {
      const result = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
        data: "invalid!base64#chars@here",
      });
      expect(result.success).toBe(false);
    });

    it("принимает данные размером ровно до 64 КБ бинарных данных (87384 символа)", () => {
      // 87384 символов Base64
      const exactLimitData = "A".repeat(YJS_MAX_BASE64_LENGTH);
      const result = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
        data: exactLimitData,
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет данные, превышающие лимит 64 КБ (87385 символов)", () => {
      const oversizedData = "A".repeat(YJS_MAX_BASE64_LENGTH + 1);
      const result = yjsUpdatePayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
        data: oversizedData,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("64 КБ");
      }
    });
  });

  describe("yjsAckPayloadSchema", () => {
    it("успешно валидирует корректный ACK", () => {
      const result = yjsAckPayloadSchema.safeParse({
        taskKey: validTaskKey,
        updateId: validUpdateId,
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет ACK с отсутствующим updateId", () => {
      const result = yjsAckPayloadSchema.safeParse({
        taskKey: validTaskKey,
      });
      expect(result.success).toBe(false);
    });

    it("отклоняет ACK с отсутствующим taskKey", () => {
      const result = yjsAckPayloadSchema.safeParse({
        updateId: validUpdateId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("yjsInitPayloadSchema", () => {
    it("успешно валидирует корректный пакет инициализации с массивом обновлений", () => {
      const result = yjsInitPayloadSchema.safeParse({
        taskKey: validTaskKey,
        updates: [validBase64, "c2Vjb25kIGRlbHRh"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.updates.length).toBe(2);
      }
    });

    it("принимает пустой массив updates", () => {
      const result = yjsInitPayloadSchema.safeParse({
        taskKey: validTaskKey,
        updates: [],
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет массив с невалидным элементом Base64", () => {
      const result = yjsInitPayloadSchema.safeParse({
        taskKey: validTaskKey,
        updates: [validBase64, "invalid!base64"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("yjsAwarenessPayloadSchema", () => {
    it("успешно валидирует awareness payload", () => {
      const result = yjsAwarenessPayloadSchema.safeParse({
        taskKey: validTaskKey,
        data: validBase64,
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет awareness payload с отсутствующими данными", () => {
      const result = yjsAwarenessPayloadSchema.safeParse({
        taskKey: validTaskKey,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("taskSwitchPayloadSchema & taskSwitchedPayloadSchema", () => {
    it("валидирует запрос переключения задачи", () => {
      const result = taskSwitchPayloadSchema.safeParse({
        taskKey: validTaskKey,
      });
      expect(result.success).toBe(true);
    });

    it("валидирует событие завершения переключения задачи", () => {
      const result = taskSwitchedPayloadSchema.safeParse({
        taskKey: validTaskKey,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("WebSocket Envelope Schemas", () => {
    const baseEnvelope = {
      version: 1,
      sessionId: "session-123",
      requestId: "req-456",
      timestamp: new Date().toISOString(),
    };

    it("успешно валидирует yjsUpdateEnvelopeSchema", () => {
      const result = yjsUpdateEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "yjs.update",
        payload: {
          taskKey: validTaskKey,
          updateId: validUpdateId,
          data: validBase64,
        },
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет конверт с неверным типом type", () => {
      const result = yjsUpdateEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "wrong.type",
        payload: {
          taskKey: validTaskKey,
          updateId: validUpdateId,
          data: validBase64,
        },
      });
      expect(result.success).toBe(false);
    });

    it("успешно валидирует yjsAckEnvelopeSchema", () => {
      const result = yjsAckEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "yjs.ack",
        payload: {
          taskKey: validTaskKey,
          updateId: validUpdateId,
        },
      });
      expect(result.success).toBe(true);
    });

    it("успешно валидирует yjsInitEnvelopeSchema", () => {
      const result = yjsInitEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "yjs.init",
        payload: {
          taskKey: validTaskKey,
          updates: [validBase64],
        },
      });
      expect(result.success).toBe(true);
    });

    it("успешно валидирует yjsAwarenessEnvelopeSchema", () => {
      const result = yjsAwarenessEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "yjs.awareness",
        payload: {
          taskKey: validTaskKey,
          data: validBase64,
        },
      });
      expect(result.success).toBe(true);
    });

    it("успешно валидирует taskSwitchEnvelopeSchema и taskSwitchedEnvelopeSchema", () => {
      const switchResult = taskSwitchEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "task.switch",
        payload: { taskKey: validTaskKey },
      });
      expect(switchResult.success).toBe(true);

      const switchedResult = taskSwitchedEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "task.switched",
        payload: { taskKey: validTaskKey },
      });
      expect(switchedResult.success).toBe(true);
    });

    it("успешно валидирует roomErrorEnvelopeSchema и roomErrorPayloadSchema", () => {
      const payloadResult = roomErrorPayloadSchema.safeParse({
        code: "SYNC_FAILED",
        message: "Failed to load document history",
        taskKey: validTaskKey,
      });
      expect(payloadResult.success).toBe(true);

      const envelopeResult = roomErrorEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "room.error",
        payload: {
          code: "SYNC_FAILED",
          message: "Failed to load document history",
          taskKey: validTaskKey,
        },
      });
      expect(envelopeResult.success).toBe(true);
    });

    it("успешно валидирует yjsSnapshotEnvelopeSchema и yjsSnapshotPayloadSchema", () => {
      const payloadResult = yjsSnapshotPayloadSchema.safeParse({
        taskKey: validTaskKey,
        snapshot: validBase64,
      });
      expect(payloadResult.success).toBe(true);

      const envelopeResult = yjsSnapshotEnvelopeSchema.safeParse({
        ...baseEnvelope,
        type: "yjs.snapshot",
        payload: {
          taskKey: validTaskKey,
          snapshot: validBase64,
        },
      });
      expect(envelopeResult.success).toBe(true);
    });

    it("принимает снимок размером больше дельты 64 КБ, но в пределах 256 КБ", () => {
      const largeSnapshot = "A".repeat(YJS_SNAPSHOT_MAX_BASE64_LENGTH);
      const payloadResult = yjsSnapshotPayloadSchema.safeParse({
        taskKey: validTaskKey,
        snapshot: largeSnapshot,
      });
      expect(payloadResult.success).toBe(true);
    });

    it("отклоняет снимок, превышающий лимит 256 КБ (349529 символов)", () => {
      const oversizedSnapshot = "A".repeat(YJS_SNAPSHOT_MAX_BASE64_LENGTH + 1);
      const payloadResult = yjsSnapshotPayloadSchema.safeParse({
        taskKey: validTaskKey,
        snapshot: oversizedSnapshot,
      });
      expect(payloadResult.success).toBe(false);
      if (!payloadResult.success) {
        expect(payloadResult.error.issues[0]?.message).toContain("256 КБ");
      }
    });

    it("отклоняет пустой снимок", () => {
      const payloadResult = yjsSnapshotPayloadSchema.safeParse({
        taskKey: validTaskKey,
        snapshot: "",
      });
      expect(payloadResult.success).toBe(false);
      if (!payloadResult.success) {
        expect(payloadResult.error.issues[0]?.message).toContain(
          "не может быть пустым",
        );
      }
    });

    it("отклоняет снимок с невалидным Base64", () => {
      const payloadResult = yjsSnapshotPayloadSchema.safeParse({
        taskKey: validTaskKey,
        snapshot: "invalid!base64#chars@here",
      });
      expect(payloadResult.success).toBe(false);
      if (!payloadResult.success) {
        expect(payloadResult.error.issues[0]?.message).toContain("Base64");
      }
    });

    it("валидирует схему yjsSnapshotDataSchema напрямую", () => {
      expect(yjsSnapshotDataSchema.safeParse(validBase64).success).toBe(true);
      expect(yjsSnapshotDataSchema.safeParse("").success).toBe(false);
      expect(
        yjsSnapshotDataSchema.safeParse(
          "A".repeat(YJS_SNAPSHOT_MAX_BASE64_LENGTH),
        ).success,
      ).toBe(true);
      expect(
        yjsSnapshotDataSchema.safeParse(
          "A".repeat(YJS_SNAPSHOT_MAX_BASE64_LENGTH + 1),
        ).success,
      ).toBe(false);
    });
  });
});
