import { createHmac, timingSafeEqual } from "node:crypto";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { publishUserRevocation } from "../../common/pubsub/revocation";
import {
  InterviewParticipantRole,
  InterviewSessionStatus,
} from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

import { sessionActiveKey, sessionMembersKey } from "./session-keys";

const ACTIVE_VALUE = "true";
const CLOSED_VALUE = "closed";
const MAX_SESSION_PARTICIPANTS = 10;

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
  private readonly jwtAccessSecret: string;
  private readonly maxSessionParticipants = MAX_SESSION_PARTICIPANTS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.mirrorTtlSeconds =
      configService.get<number>("sessions.mirrorTtlSeconds") ?? 2 * 60 * 60;
    this.jwtAccessSecret =
      configService.get<string>("jwt.accessSecret") ||
      "default-mock-interview-access-secret";
  }

  /**
   * Генерирует детерминированный HMAC SHA-256 inviteToken на основе sessionId и секрета.
   */
  generateInviteToken(sessionId: string): string {
    return createHmac("sha256", this.jwtAccessSecret)
      .update(`session-invite:${sessionId}`)
      .digest("hex");
  }

  /**
   * Выполняет timing-safe валидацию HMAC inviteToken (защита от CWE-208 Timing Attacks).
   */
  validateInviteToken(sessionId: string, token?: string): boolean {
    if (!token || typeof token !== "string" || token.length !== 64) {
      return false;
    }
    try {
      const expectedHex = this.generateInviteToken(sessionId);
      const expectedBuf = Buffer.from(expectedHex, "hex");
      const receivedBuf = Buffer.from(token, "hex");
      if (expectedBuf.length !== receivedBuf.length) {
        return false;
      }
      return timingSafeEqual(expectedBuf, receivedBuf);
    } catch {
      return false;
    }
  }

  /**
   * Создаёт интервью-сессию. Создатель становится владельцем и участником
   * с ролью `interviewer`. Возвращает `{ sessionId, inviteToken }`.
   */
  async createSession(
    creatorUserId: string,
  ): Promise<{ sessionId: string; inviteToken: string }> {
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

    const inviteToken = this.generateInviteToken(session.id);

    this.logger.log(
      `created session ${session.id} (owner ${creatorUserId}) and warmed mirror`,
    );
    return { sessionId: session.id, inviteToken };
  }

  /**
   * Присоединяет пользователя к сессии.
   *
   * 1. В транзакции проверяет существование сессии (404) и статус (403 если CLOSED).
   * 2. Если пользователь уже участник — сохраняет его существующую роль и возвращает токен.
   * 3. Если пользователь новый:
   *    - Проверяет лимит участников (< 10).
   *    - Проверяет валидность HMAC inviteToken (403 если невалиден).
   *    - Регистрирует в Postgres с ролью CANDIDATE.
   * 4. Перед записью зеркала проверяет, что сессия не закрыта (не перезаписывает closed).
   * 5. Прогревает / обновляет запись в Redis-зеркале для авторизации в realtime.
   */
  async joinSession(
    sessionId: string,
    userId: string,
    inviteToken?: string,
  ): Promise<{ role: InterviewParticipantRole; inviteToken: string }> {
    const generatedInviteToken = this.generateInviteToken(sessionId);

    const participant = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.interviewSession.findUnique({
        where: { id: sessionId },
        include: {
          participants: true,
        },
      });

      if (!fresh) {
        throw new NotFoundException("Session not found");
      }

      if (fresh.status === InterviewSessionStatus.CLOSED) {
        throw new ForbiddenException("Session is closed");
      }

      const existingParticipant = fresh.participants.find(
        (p) => p.userId === userId,
      );
      if (existingParticipant) {
        return existingParticipant;
      }

      if (fresh.participants.length >= this.maxSessionParticipants) {
        throw new ForbiddenException("Interview session is full");
      }

      const isInviteValid = this.validateInviteToken(sessionId, inviteToken);
      if (!isInviteValid) {
        throw new ForbiddenException(
          "User is not invited to this interview session",
        );
      }

      return tx.interviewParticipant.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: {
          sessionId,
          userId,
          role: InterviewParticipantRole.CANDIDATE,
        },
        update: {},
      });
    });

    const currentActive = await this.redis.get(sessionActiveKey(sessionId));
    if (currentActive === CLOSED_VALUE) {
      throw new ForbiddenException("Session is closed");
    }

    await this.redis.set(
      sessionActiveKey(sessionId),
      ACTIVE_VALUE,
      this.mirrorTtlSeconds,
    );
    await this.redis.hset(
      sessionMembersKey(sessionId),
      userId,
      participant.role,
      this.mirrorTtlSeconds,
    );

    this.logger.log(
      `user ${userId} joined session ${sessionId} as ${participant.role}`,
    );

    return {
      role: participant.role as InterviewParticipantRole,
      inviteToken: generatedInviteToken,
    };
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

    // Room-scoped evict: публикуем ревокацию по каждому участнику с sessionId.
    // Используем список участников из Postgres (считан до записи зеркала).
    // Публикуем ДО обновления зеркала `active="closed"` (P2), чтобы
    // переподключившийся в окне закрытия получил 1008 по ревокации, а не
    // 403 по зеркалу. `prisma.update` (CLOSED) уже подтверждён выше — это
    // исключает «выкидывание при формально открытой сессии».
    for (const participant of participants) {
      await publishUserRevocation(this.redis, participant.userId, sessionId);
    }

    await this.redis.set(
      sessionActiveKey(sessionId),
      CLOSED_VALUE,
      this.mirrorTtlSeconds,
    );
  }

  /**
   * Восстанавливает зеркало ACTIVE-сессий из Postgres после потери/flush Redis
   * (P3). Интервал захардкожен (`EVERY_HOUR`): `@nestjs/schedule` не позволяет
   * вычислить выражение декоратора динамически из `ConfigService`.
   * Если нужен другой интервал — замените `CronExpression` ниже.
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
