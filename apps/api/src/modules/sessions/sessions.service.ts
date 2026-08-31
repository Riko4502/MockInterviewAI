import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { publishUserRevocation } from "../../common/pubsub/revocation";
import { InterviewParticipantRole } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

const ACTIVE_VALUE = "true";
const CLOSED_VALUE = "closed";

function sessionActiveKey(sessionId: string): string {
  return `session:${sessionId}:active`;
}

function sessionMembersKey(sessionId: string): string {
  return `session:${sessionId}:members`;
}

/**
 * Управляет интервью-сессиями и их Redis-зеркалом (источник правды о членстве).
 *
 * Postgres (Prisma) — синхронная правда; Redis-зеркало (
 * `session:{id}:active` и `session:{id}:members`) — быстрый lookup для realtime.
 * Зеркало имеет TTL (`SESSION_MIRROR_TTL_SECONDS`) и периодически
 * восстанавливается из Postgres (`reconcileMirrors`, P3).
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);
  private readonly mirrorTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.mirrorTtlSeconds =
      configService.get<number>("sessions.mirrorTtlSeconds") ?? 2 * 60 * 60;
  }

  /**
   * Создаёт интервью-сессию. Создатель становится владельцем и участником
   * с ролью `interviewer`. Зеркало разогревается (`active` + `members`).
   */
  async createSession(creatorUserId: string): Promise<{ sessionId: string }> {
    const session = await this.prisma.interviewSession.create({
      data: {
        userId: creatorUserId,
        participants: {
          create: {
            userId: creatorUserId,
            role: InterviewParticipantRole.INTERVIEWER,
          },
        },
      },
    });

    await this.redis.set(
      sessionActiveKey(session.id),
      ACTIVE_VALUE,
      this.mirrorTtlSeconds,
    );
    await this.redis.hset(
      sessionMembersKey(session.id),
      creatorUserId,
      InterviewParticipantRole.INTERVIEWER,
      this.mirrorTtlSeconds,
    );

    this.logger.log(
      `created session ${session.id} (owner ${creatorUserId}) and warmed mirror`,
    );
    return { sessionId: session.id };
  }

  /**
   * Добавляет участника в сессию (только владелец): запись в Postgres +
   * HSET в зеркало с продлением TTL.
   */
  async addParticipant(
    sessionId: string,
    userId: string,
    role: InterviewParticipantRole,
  ): Promise<void> {
    await this.prisma.interviewParticipant.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, role },
      update: { role },
    });

    await this.redis.hset(
      sessionMembersKey(sessionId),
      userId,
      role,
      this.mirrorTtlSeconds,
    );
  }

  /**
   * Удаляет участника из сессии: запись из Postgres + HDEL из зеркала
   * с продлением TTL.
   */
  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    await this.prisma.interviewParticipant.delete({
      where: { sessionId_userId: { sessionId, userId } },
    });

    await this.redis.hdel(
      sessionMembersKey(sessionId),
      userId,
      this.mirrorTtlSeconds,
    );
  }

  /**
   * Закрывает сессию (только владелец): статус CLOSED в Postgres, зеркало
   * `active="closed"`, публикация ревокаций по каждому участнику с `sessionId`
   * (room-scoped evict в realtime). Ревокации публикуются по участникам ДО
   * удаления зеркала, чтобы закрывающийся не переподключался (P2).
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    const participants = session.participants;

    await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: "CLOSED", endedAt: new Date() },
    });

    await this.redis.set(
      sessionActiveKey(sessionId),
      CLOSED_VALUE,
      this.mirrorTtlSeconds,
    );

    // Room-scoped evict: публикуем ревокацию по каждому участнику с sessionId.
    // Используем список участников из Postgres (считан до очистки зеркала).
    for (const participant of participants) {
      await publishUserRevocation(this.redis, participant.userId, sessionId);
    }
  }

  /**
   * Восстанавливает зеркало ACTIVE-сессий из Postgres после потери/flush Redis
   * (P3). Выполняется периодически (ежечасно) — см. `SESSION_MIRROR_REFRESH_CRON`.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: "session-mirror-reconcile" })
  async reconcileMirrors(): Promise<void> {
    let restored = 0;

    try {
      const sessions = await this.prisma.interviewSession.findMany({
        where: { status: "ACTIVE" },
        include: { participants: true },
      });

      for (const session of sessions) {
        const activeKey = sessionActiveKey(session.id);
        const membersKey = sessionMembersKey(session.id);

        const exists = await this.redis.exists(activeKey);
        await this.redis.set(activeKey, ACTIVE_VALUE, this.mirrorTtlSeconds);
        if (!exists) {
          restored++;
        }

        for (const participant of session.participants) {
          await this.redis.hset(
            membersKey,
            participant.userId,
            participant.role.toString(),
            this.mirrorTtlSeconds,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        "reconcileMirrors: failed to reconcile mirror",
        error instanceof Error ? error.stack : String(error),
      );
      return;
    }

    if (restored > 0) {
      this.logger.log(
        `reconcileMirrors: restored mirror for ${restored} ACTIVE session(s)`,
      );
    }
  }

  /**
   * Возвращает владельца сессии (для авторизации владельцев).
   *
   * @throws {NotFoundException} Если сессия не существует (404).
   */
  async getOwner(sessionId: string): Promise<string> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    return session.userId;
  }
}
