import { randomBytes, timingSafeEqual } from "node:crypto";
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

import {
  sessionActiveKey,
  sessionInviteKey,
  sessionMembersKey,
} from "./session-keys";

const ACTIVE_VALUE = "true";
const CLOSED_VALUE = "closed";
const MAX_SESSION_PARTICIPANTS = 10;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lua-скрипт для атомарной проверки активности сессии и добавления участника (CWE-367 TOCTOU).
 *
 * Если ключ активности равен "closed" — прерывается с кодом 0 (сессия закрыта).
 * Если нет — атомарно выставляет "true", сохраняет участника в hash и продлевает TTL.
 */
const ACTIVATE_SESSION_MEMBER_LUA = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[2] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[5])
redis.call('HSET', KEYS[2], ARGV[3], ARGV[4])
redis.call('EXPIRE', KEYS[2], ARGV[5])
return 1
`;

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
  private readonly maxSessionParticipants = MAX_SESSION_PARTICIPANTS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.mirrorTtlSeconds =
      configService.get<number>("sessions.mirrorTtlSeconds") ?? 2 * 60 * 60;
  }

  /**
   * Генерирует криптографически стойкий случайный inviteToken (256 бит энтропии).
   * Недетерминирован, защищён от прогнозирования и подбора (CWE-613).
   */
  generateInviteToken(_sessionId?: string): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Выполняет timing-safe валидацию inviteToken (защита от CWE-208 Timing Attacks).
   */
  validateInviteToken(
    expectedToken?: string | null,
    receivedToken?: string,
  ): boolean {
    if (
      !expectedToken ||
      !receivedToken ||
      typeof expectedToken !== "string" ||
      typeof receivedToken !== "string"
    ) {
      return false;
    }
    if (expectedToken.length !== 64 || receivedToken.length !== 64) {
      return false;
    }
    try {
      const expectedBuf = Buffer.from(expectedToken, "hex");
      const receivedBuf = Buffer.from(receivedToken, "hex");
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
   * с ролью `interviewer`. Сохраняет сгенерированный инвайт-токен в Redis
   * и возвращает `{ sessionId, inviteToken }`.
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
    await this.redis.set(
      sessionInviteKey(session.id),
      inviteToken,
      this.mirrorTtlSeconds,
    );

    this.logger.log(
      `created session ${session.id} (owner ${creatorUserId}) and warmed mirror`,
    );
    return { sessionId: session.id, inviteToken };
  }

  /**
   * Присоединяет пользователя к сессии.
   *
   * 1. В транзакции эксклюзивно блокирует строку сессии (FOR UPDATE) для сериализации
   *    проверки лимита участников и предотвращения race conditions при параллельных запросах.
   * 2. Проверяет существование сессии (404) и статус (403 если CLOSED).
   * 3. Если пользователь уже участник — сохраняет его существующую роль и возвращает токен.
   * 4. Если пользователь новый:
   *    - Проверяет лимит участников (< 10).
   *    - Проверяет валидность HMAC inviteToken (403 если невалиден).
   *    - Регистрирует в Postgres с ролью CANDIDATE.
   * 5. Перед записью зеркала проверяет, что сессия не закрыта (не перезаписывает closed).
   * 6. Прогревает / обновляет запись в Redis-зеркале для авторизации в realtime.
   */
  async joinSession(
    sessionId: string,
    userId: string,
    inviteToken?: string,
  ): Promise<{ role: InterviewParticipantRole; inviteToken: string }> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    let activeInviteToken: string | null = null;

    const participant = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "interview_sessions" WHERE id = ${sessionId}::uuid FOR UPDATE
      `;

      if (!locked.length) {
        throw new NotFoundException("Session not found");
      }

      // Считываем активный invite-токен из Redis под FOR UPDATE замком (CWE-613)
      activeInviteToken = await this.redis.get(sessionInviteKey(sessionId));

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

      const isInviteValid = this.validateInviteToken(
        activeInviteToken,
        inviteToken,
      );
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

    // Атомарно проверяем и активируем зеркало сессии в Redis (CWE-367 TOCTOU)
    const activated = await this.redis.eval<number>(
      ACTIVATE_SESSION_MEMBER_LUA,
      2,
      sessionActiveKey(sessionId),
      sessionMembersKey(sessionId),
      ACTIVE_VALUE,
      CLOSED_VALUE,
      userId,
      participant.role,
      this.mirrorTtlSeconds,
    );

    if (activated === 0) {
      throw new ForbiddenException("Session is closed");
    }

    // Если токен в Redis отсутствовал (холодное зеркало), гарантируем его наличие
    let effectiveInviteToken: string | null = activeInviteToken;
    if (!effectiveInviteToken) {
      const generatedToken = this.generateInviteToken(sessionId);
      await this.redis.set(
        sessionInviteKey(sessionId),
        generatedToken,
        this.mirrorTtlSeconds,
      );
      effectiveInviteToken = generatedToken;
    }

    this.logger.log(
      `user ${userId} joined session ${sessionId} as ${participant.role}`,
    );

    return {
      role: participant.role as InterviewParticipantRole,
      inviteToken: effectiveInviteToken,
    };
  }

  /**
   * Ротирует invite-токен сессии: генерирует новый криптографически стойкий токен,
   * сохраняет его в Redis с обновлением TTL и возвращает `{ inviteToken }`.
   * Старый токен мгновенно становится невалидным (CWE-613).
   */
  async rotateInviteToken(sessionId: string): Promise<{ inviteToken: string }> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    if (session.status === InterviewSessionStatus.CLOSED) {
      throw new ForbiddenException("Session is closed");
    }

    const newInviteToken = this.generateInviteToken(sessionId);
    await this.redis.set(
      sessionInviteKey(sessionId),
      newInviteToken,
      this.mirrorTtlSeconds,
    );

    this.logger.log(`rotated invite token for session ${sessionId}`);
    return { inviteToken: newInviteToken };
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
   * Удаляет участника из сессии:
   * 1. В транзакции блокирует строку сессии (FOR UPDATE), ротирует invite-токен
   *    в Redis и удаляет участника из Postgres под тем же замком, исключая race condition с joinSession (CWE-613).
   * 2. После завершения транзакции выполняет HDEL из зеркала и публикует
   *    room-scoped ревокацию в realtime (WS 1008).
   */
  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "interview_sessions" WHERE id = ${sessionId}::uuid FOR UPDATE
      `;

      if (!locked.length) {
        throw new NotFoundException("Session not found");
      }

      // Инвалидируем старый инвайт-токен путём ротации нового под тем же lock
      const newInviteToken = this.generateInviteToken(sessionId);
      await this.redis.set(
        sessionInviteKey(sessionId),
        newInviteToken,
        this.mirrorTtlSeconds,
      );

      await tx.interviewParticipant.delete({
        where: { sessionId_userId: { sessionId, userId } },
      });
    });

    // HDEL и publishUserRevocation выполняются после завершения транзакции
    await this.redis.hdel(
      sessionMembersKey(sessionId),
      userId,
      this.mirrorTtlSeconds,
    );

    // Выселяем участника из активного realtime WS (1008)
    await publishUserRevocation(this.redis, userId, sessionId);

    this.logger.log(
      `removed user ${userId} from session ${sessionId} and rotated invite token`,
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

    // Удаляем инвайт-токен закрытой сессии
    await this.redis.delete(sessionInviteKey(sessionId));
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
        const inviteKey = sessionInviteKey(session.id);

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

        const existingInvite = await this.redis.get(inviteKey);
        if (!existingInvite) {
          const token = this.generateInviteToken(session.id);
          await this.redis.set(inviteKey, token, this.mirrorTtlSeconds);
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
