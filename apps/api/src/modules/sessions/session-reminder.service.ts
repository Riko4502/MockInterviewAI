import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { InterviewSessionStatus } from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { NotificationDispatcher } from "../notifications/notification-dispatcher.service";

/**
 * Планировщик напоминаний о запланированных сессиях.
 *
 * Каждую минуту сканирует сессии со статусом CREATED или ACTIVE,
 * назначенное время которых (scheduledAt) наступает через 14–16 минут.
 * Отправляет участникам событие interview.reminder_15m с кнопкой перехода в комнату.
 * Защищён от повторной отправки через Redis setNx.
 */
@Injectable()
export class SessionReminderService {
  private readonly logger = new Logger(SessionReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @Cron("0 * * * * *")
  async checkUpcomingSessions(force = false): Promise<void> {
    if (process.env.NODE_ENV === "test" && !force) {
      return;
    }

    const now = new Date();
    // Окно проверки: от +14 до +16 минут от текущего момента
    const windowStart = new Date(now.getTime() + 14 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 16 * 60 * 1000);

    try {
      const sessions = await this.prisma.interviewSession.findMany({
        where: {
          status: {
            in: [InterviewSessionStatus.CREATED, InterviewSessionStatus.ACTIVE],
          },
          scheduledAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  displayName: true,
                },
              },
            },
          },
        },
      });

      for (const session of sessions) {
        const scheduledAt = session.scheduledAt;
        if (!scheduledAt) continue;

        const participants = session.participants;
        if (participants.length < 2) continue;

        for (const p of participants) {
          const other = participants.find((item) => item.userId !== p.userId);
          const otherName = other?.user.displayName ?? "Собеседник";

          const lockKey = `session:${session.id}:reminder_15m_sent:${p.userId}`;
          const acquired = await this.redis.setNx(lockKey, "1", 7200);
          if (!acquired) {
            continue;
          }

          try {
            await this.prisma.$transaction(async (tx) => {
              await this.dispatcher.dispatch(
                {
                  type: "interview.reminder_15m",
                  payload: {
                    sessionId: session.id,
                    startUtc: scheduledAt.toISOString(),
                    otherParticipantName: otherName,
                  },
                },
                p.userId,
                tx,
                `/dashboard/sandbox?room=${session.id}`,
              );
            });

            this.logger.log(
              `Dispatched 15m reminder for session ${session.id} to user ${p.userId}`,
            );
          } catch (dispatchError) {
            this.logger.error(
              `Failed to dispatch reminder for session ${session.id} to user ${p.userId}: ${dispatchError}`,
            );
          }
        }
      }
    } catch (scanError) {
      this.logger.error(
        `Error during scheduled session scan: ${scanError instanceof Error ? scanError.message : scanError}`,
      );
    }
  }
}
