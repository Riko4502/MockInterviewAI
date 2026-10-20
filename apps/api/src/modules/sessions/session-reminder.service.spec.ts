import { InterviewSessionStatus } from "@packages/dto";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import type { NotificationDispatcher } from "../notifications/notification-dispatcher.service";
import { SessionReminderService } from "./session-reminder.service";

describe("SessionReminderService", () => {
  let service: SessionReminderService;
  let prismaMock: {
    interviewSession: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let redisMock: {
    setNx: jest.Mock;
  };
  let dispatcherMock: {
    dispatch: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      interviewSession: { findMany: jest.fn() },
      $transaction: jest.fn(async (cb) => cb({})),
    };

    redisMock = {
      setNx: jest.fn().mockResolvedValue(true),
    };

    dispatcherMock = {
      dispatch: jest.fn().mockResolvedValue({}),
    };

    service = new SessionReminderService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      dispatcherMock as unknown as NotificationDispatcher,
    );
  });

  it("находит сессии через 15 минут и отправляет напоминание обоим участникам", async () => {
    const scheduledAt = new Date(Date.now() + 15 * 60 * 1000);
    const mockSession = {
      id: "session-1",
      scheduledAt,
      status: InterviewSessionStatus.CREATED,
      participants: [
        {
          userId: "user-1",
          user: { id: "user-1", displayName: "Алиса" },
        },
        {
          userId: "user-2",
          user: { id: "user-2", displayName: "Боб" },
        },
      ],
    };

    prismaMock.interviewSession.findMany.mockResolvedValue([mockSession]);

    await service.checkUpcomingSessions(true);

    expect(redisMock.setNx).toHaveBeenCalledWith(
      "session:session-1:reminder_15m_sent:user-1",
      "1",
      7200,
    );
    expect(redisMock.setNx).toHaveBeenCalledWith(
      "session:session-1:reminder_15m_sent:user-2",
      "1",
      7200,
    );

    expect(dispatcherMock.dispatch).toHaveBeenCalledTimes(2);

    // Алисе отправляется напоминание о встрече с Бобом
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      {
        type: "interview.reminder_15m",
        payload: {
          sessionId: "session-1",
          startUtc: scheduledAt.toISOString(),
          otherParticipantName: "Боб",
        },
      },
      "user-1",
      expect.anything(),
      "/dashboard/sandbox?room=session-1",
    );

    // Бобу отправляется напоминание о встрече с Алисой
    expect(dispatcherMock.dispatch).toHaveBeenCalledWith(
      {
        type: "interview.reminder_15m",
        payload: {
          sessionId: "session-1",
          startUtc: scheduledAt.toISOString(),
          otherParticipantName: "Алиса",
        },
      },
      "user-2",
      expect.anything(),
      "/dashboard/sandbox?room=session-1",
    );
  });

  it("пропускает отправку, если лок в Redis уже существует (повторный запуск)", async () => {
    const scheduledAt = new Date(Date.now() + 15 * 60 * 1000);
    const mockSession = {
      id: "session-1",
      scheduledAt,
      status: InterviewSessionStatus.CREATED,
      participants: [
        {
          userId: "user-1",
          user: { id: "user-1", displayName: "Алиса" },
        },
        {
          userId: "user-2",
          user: { id: "user-2", displayName: "Боб" },
        },
      ],
    };

    prismaMock.interviewSession.findMany.mockResolvedValue([mockSession]);
    // Лок не получен (уже было отправлено)
    redisMock.setNx.mockResolvedValue(false);

    await service.checkUpcomingSessions(true);
    expect(dispatcherMock.dispatch).not.toHaveBeenCalled();
  });
});
