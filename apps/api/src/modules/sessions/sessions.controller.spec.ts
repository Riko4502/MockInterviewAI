import { ForbiddenException } from "@nestjs/common";
import type { Request } from "express";
import type { TokenService } from "../auth/services/token.service";
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

  describe("meeting endpoints (TASK #220)", () => {
    let tokenServiceMock: { verifyAccessToken: jest.Mock };

    beforeEach(() => {
      tokenServiceMock = {
        verifyAccessToken: jest.fn().mockReturnValue({ sub: otherUserId }),
      };
      sessionsServiceMock.createMeetingSession = jest.fn();
      sessionsServiceMock.getMeetingLobby = jest.fn();
      sessionsServiceMock.joinMeeting = jest.fn();
      sessionsServiceMock.endMeeting = jest.fn();

      controller = new SessionsController(
        sessionsServiceMock as unknown as SessionsService,
        tokenServiceMock as unknown as TokenService,
      );
    });

    describe("createMeeting", () => {
      it("создаёт видеовстречу через sessionsService.createMeetingSession", async () => {
        sessionsServiceMock.createMeetingSession.mockResolvedValue({
          sessionId,
          inviteToken: "token-123",
        });

        const dto = { title: "Daily Meeting", isPrivate: false };
        const result = await controller.createMeeting(ownerId, dto);

        expect(result).toEqual({ sessionId, inviteToken: "token-123" });
        expect(sessionsServiceMock.createMeetingSession).toHaveBeenCalledWith(
          ownerId,
          dto,
        );
      });
    });

    describe("getMeetingLobby", () => {
      it("возвращает публичные данные лобби", async () => {
        const lobbyData = {
          id: sessionId,
          title: "Meeting",
          isPrivate: false,
          isPasswordRequired: false,
          hostName: "Host",
          status: "ACTIVE",
          participantCount: 1,
        };
        sessionsServiceMock.getMeetingLobby.mockResolvedValue(lobbyData);

        const result = await controller.getMeetingLobby(sessionId);

        expect(result).toEqual(lobbyData);
        expect(sessionsServiceMock.getMeetingLobby).toHaveBeenCalledWith(
          sessionId,
        );
      });
    });

    describe("joinMeeting", () => {
      it("извлекает userId из Bearer токена и присоединяет пользователя", async () => {
        const joinRes = {
          role: "PARTICIPANT",
          inviteToken: "token-123",
          mediaToken: "media-token-123",
          serverUrl: "ws://localhost:7880",
          roomName: sessionId,
          participantId: otherUserId,
          displayName: "Other User",
        };
        sessionsServiceMock.joinMeeting.mockResolvedValue(joinRes);

        const req = {
          headers: {
            authorization: "Bearer valid-token",
          },
        } as unknown as Request;

        const body = { guestName: "Гость" };
        const result = await controller.joinMeeting(
          sessionId,
          "127.0.0.1",
          req,
          body,
        );

        expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
          "valid-token",
        );
        expect(sessionsServiceMock.joinMeeting).toHaveBeenCalledWith(
          sessionId,
          otherUserId,
          body,
          "127.0.0.1",
        );
        expect(result).toEqual(joinRes);
      });

      it("передает undefined как userId для гостя без заголовка Authorization", async () => {
        sessionsServiceMock.joinMeeting.mockResolvedValue({
          role: "PARTICIPANT",
          mediaToken: "media-token",
        });

        const req = {
          headers: {},
        } as unknown as Request;

        const body = { guestName: "Гость" };
        await controller.joinMeeting(sessionId, "127.0.0.1", req, body);

        expect(sessionsServiceMock.joinMeeting).toHaveBeenCalledWith(
          sessionId,
          undefined,
          body,
          "127.0.0.1",
        );
      });
    });

    describe("endMeeting", () => {
      it("завершает встречу через sessionsService.endMeeting", async () => {
        await controller.endMeeting(sessionId, ownerId);

        expect(sessionsServiceMock.endMeeting).toHaveBeenCalledWith(
          sessionId,
          ownerId,
        );
      });
    });
  });
});
