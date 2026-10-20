import { describe, expect, it } from "vitest";
import {
  createMeetingSchema,
  joinMeetingResponseSchema,
  joinMeetingSchema,
  meetingLobbyResponseSchema,
} from "./meeting.dto";

describe("meeting.dto", () => {
  describe("createMeetingSchema", () => {
    it("валидирует дефолтные значения при пустом объекте", () => {
      const result = createMeetingSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Meeting");
        expect(result.data.isPrivate).toBe(false);
      }
    });

    it("валидирует кастомные параметры встречи", () => {
      const result = createMeetingSchema.safeParse({
        title: "Архитектурный созвон",
        description: "Обсуждение #220",
        isPrivate: true,
        password: "secretpassword",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Архитектурный созвон");
        expect(result.data.isPrivate).toBe(true);
        expect(result.data.password).toBe("secretpassword");
      }
    });

    it("отклоняет слишком короткий пароль", () => {
      const result = createMeetingSchema.safeParse({
        password: "123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain(
          "Password must be at least 4 characters",
        );
      }
    });

    it("отклоняет слишком длинный заголовок", () => {
      const result = createMeetingSchema.safeParse({
        title: "a".repeat(121),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("meetingLobbyResponseSchema", () => {
    it("валидирует корректный ответ лобби", () => {
      const result = meetingLobbyResponseSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        title: "Daily Standup",
        description: null,
        isPrivate: false,
        isPasswordRequired: false,
        hostName: "Иван Иванов",
        hostAvatar: null,
        status: "ACTIVE",
        participantCount: 3,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("joinMeetingSchema", () => {
    it("принимает корректные данные гостя", () => {
      const result = joinMeetingSchema.safeParse({
        guestName: "Алексей",
        password: "secretpassword",
        inviteToken: "token-123",
      });
      expect(result.success).toBe(true);
    });

    it("отклоняет слишком короткое имя гостя", () => {
      const result = joinMeetingSchema.safeParse({
        guestName: "A",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("joinMeetingResponseSchema", () => {
    it("валидирует ответ с LiveKit токеном", () => {
      const result = joinMeetingResponseSchema.safeParse({
        role: "HOST",
        inviteToken: "test-token",
        mediaToken: "jwt.token.here",
        serverUrl: "wss://livekit.example.com",
        roomName: "room-123",
        participantId: "user-123",
        displayName: "Иван",
      });
      expect(result.success).toBe(true);
    });
  });
});
