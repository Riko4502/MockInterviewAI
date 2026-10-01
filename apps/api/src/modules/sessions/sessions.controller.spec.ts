import { ForbiddenException } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import type { SessionsService } from "./sessions.service";

describe("SessionsController", () => {
  let controller: SessionsController;
  let sessionsServiceMock: {
    createSession: jest.Mock;
    joinSession: jest.Mock;
    addParticipant: jest.Mock;
    removeParticipant: jest.Mock;
    closeSession: jest.Mock;
    rotateInviteToken: jest.Mock;
    getOwner: jest.Mock;
  };

  const sessionId = "11111111-1111-4111-a111-111111111111";
  const ownerId = "22222222-2222-4222-b222-222222222222";
  const otherUserId = "33333333-3333-4333-c333-333333333333";

  beforeEach(() => {
    sessionsServiceMock = {
      createSession: jest.fn(),
      joinSession: jest.fn(),
      addParticipant: jest.fn(),
      removeParticipant: jest.fn(),
      closeSession: jest.fn(),
      rotateInviteToken: jest.fn(),
      getOwner: jest.fn().mockResolvedValue(ownerId),
    };

    controller = new SessionsController(
      sessionsServiceMock as unknown as SessionsService,
    );
  });

  describe("createSession", () => {
    it("создаёт сессию через sessionsService", async () => {
      sessionsServiceMock.createSession.mockResolvedValue({
        sessionId,
        inviteToken: "token-abc",
      });

      const result = await controller.createSession(ownerId);

      expect(result).toEqual({ sessionId, inviteToken: "token-abc" });
      expect(sessionsServiceMock.createSession).toHaveBeenCalledWith(ownerId);
    });
  });

  describe("joinSession", () => {
    it("присоединяет пользователя к сессии", async () => {
      sessionsServiceMock.joinSession.mockResolvedValue({
        role: "CANDIDATE",
        inviteToken: "token-abc",
      });

      const result = await controller.joinSession(sessionId, otherUserId, {
        inviteToken: "token-abc",
      });

      expect(result).toEqual({ role: "CANDIDATE", inviteToken: "token-abc" });
      expect(sessionsServiceMock.joinSession).toHaveBeenCalledWith(
        sessionId,
        otherUserId,
        "token-abc",
      );
    });
  });

  describe("rotateInviteToken", () => {
    it("ротирует токен если вызывающий — владелец", async () => {
      sessionsServiceMock.rotateInviteToken.mockResolvedValue({
        inviteToken: "new-token-123",
      });

      const result = await controller.rotateInviteToken(sessionId, ownerId);

      expect(result).toEqual({ inviteToken: "new-token-123" });
      expect(sessionsServiceMock.rotateInviteToken).toHaveBeenCalledWith(
        sessionId,
        ownerId,
      );
    });

    it("бросает ForbiddenException если вызывающий не владелец", async () => {
      sessionsServiceMock.rotateInviteToken.mockRejectedValue(
        new ForbiddenException(
          "Only the session owner can perform this action",
        ),
      );

      await expect(
        controller.rotateInviteToken(sessionId, otherUserId),
      ).rejects.toThrow(ForbiddenException);

      expect(sessionsServiceMock.rotateInviteToken).toHaveBeenCalledWith(
        sessionId,
        otherUserId,
      );
    });
  });

  describe("removeParticipant", () => {
    it("удаляет участника если вызывающий — владелец", async () => {
      await controller.removeParticipant(sessionId, otherUserId, ownerId);

      expect(sessionsServiceMock.removeParticipant).toHaveBeenCalledWith(
        sessionId,
        otherUserId,
        ownerId,
      );
    });

    it("бросает ForbiddenException если удаление вызывает не владелец", async () => {
      sessionsServiceMock.removeParticipant.mockRejectedValue(
        new ForbiddenException(
          "Only the session owner can perform this action",
        ),
      );

      await expect(
        controller.removeParticipant(sessionId, "target-id", otherUserId),
      ).rejects.toThrow(ForbiddenException);

      expect(sessionsServiceMock.removeParticipant).toHaveBeenCalledWith(
        sessionId,
        "target-id",
        otherUserId,
      );
    });
  });

  describe("closeSession", () => {
    it("закрывает сессию если вызывающий — владелец", async () => {
      await controller.closeSession(sessionId, ownerId);

      expect(sessionsServiceMock.closeSession).toHaveBeenCalledWith(
        sessionId,
        ownerId,
      );
    });

    it("бросает ForbiddenException если закрытие вызывает не владелец", async () => {
      sessionsServiceMock.closeSession.mockRejectedValue(
        new ForbiddenException(
          "Only the session owner can perform this action",
        ),
      );

      await expect(
        controller.closeSession(sessionId, otherUserId),
      ).rejects.toThrow(ForbiddenException);

      expect(sessionsServiceMock.closeSession).toHaveBeenCalledWith(
        sessionId,
        otherUserId,
      );
    });
  });
});
