import { randomBytes, timingSafeEqual } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as Y from "yjs";
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
  sessionSeededTasksKey,
  sessionTaskUpdatesKey,
} from "./session-keys";

const ACTIVE_VALUE = "true";
const CLOSED_VALUE = "closed";
const MAX_SESSION_PARTICIPANTS = 10;

export const DEFAULT_TASK_KEY = "two-sum:typescript";
export const TASK_DOC_TTL_SECONDS = 86400; // 24 часа

/**
 * Создаёт начальный бинарный Yjs апдейт (Base64) для заданного текста.
 */
export function createStarterYjsUpdate(initialContent = ""): string {
  const doc = new Y.Doc();
  const yText = doc.getText("monaco");
  if (initialContent) {
    yText.insert(0, initialContent);
  }
  const update = Y.encodeStateAsUpdate(doc);
  return Buffer.from(update).toString("base64");
}

/**
 * Резервная копия Lua-скрипта сидинга для автономных окружений (контейнеров).
 * Источник истины: apps/realtime/internal/storage/scripts/seed_task_doc.lua
 */
export const FALLBACK_SEED_TASK_DOC_LUA = `
-- KEYS[1]: {session:<sessionId>}:seeded_tasks (Redis Hash маркеров задач)
-- KEYS[2]: {session:<sessionId>}:task:<taskKey>:updates (Redis Stream конкретной задачи)
-- ARGV[1]: task_key (строка вида "<taskId>:<lang>")
-- ARGV[2]: base64_starter_update (Yjs update со стартовым кодом)
-- ARGV[3]: ttl_seconds (например, 86400)

local has_marker = (redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1)
local stream_exists = (redis.call('EXISTS', KEYS[2]) == 1)
local stream_len = 0
if stream_exists then
    stream_len = redis.call('XLEN', KEYS[2])
end

if has_marker and stream_len > 0 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
    return 0
end

if (not stream_exists) or (stream_len == 0) then
    local ok_xadd, err_or_id = pcall(redis.call, 'XADD', KEYS[2], '*', 'data', ARGV[2])
    if not ok_xadd then
        return redis.error_reply("ERR_XADD_FAILED: " .. tostring(err_or_id))
    end

    local ok_hset, err_hset = pcall(redis.call, 'HSET', KEYS[1], ARGV[1], '1')
    if not ok_hset then
        return redis.error_reply("ERR_HSET_FAILED: " .. tostring(err_hset))
    end

    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))

    if has_marker then
        return 3
    else
        return 1
    end
end

if (not has_marker) and (stream_len > 0) then
    local ok_hset, err_hset = pcall(redis.call, 'HSET', KEYS[1], ARGV[1], '1')
    if not ok_hset then
        return redis.error_reply("ERR_HSET_FAILED: " .. tostring(err_hset))
    end

    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
    redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
    return 2
end

return 0
`;

/**
 * Относительный путь от текущего модуля к единому источнику истины скрипта сидинга в apps/realtime.
 */
export const REALTIME_SEED_TASK_DOC_LUA_RELATIVE_PATH =
  "../../../../realtime/internal/storage/scripts/seed_task_doc.lua";

/**
 * TODO временное решение
 * Загружает скрипт seed_task_doc.lua из единого источника истины (apps/realtime).
 */
export function loadSeedTaskDocLua(): string {
  const candidatePaths = [
    path.resolve(__dirname, REALTIME_SEED_TASK_DOC_LUA_RELATIVE_PATH),
    path.resolve(
      process.cwd(),
      "../realtime/internal/storage/scripts/seed_task_doc.lua",
    ),
    path.resolve(
      process.cwd(),
      "apps/realtime/internal/storage/scripts/seed_task_doc.lua",
    ),
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        return fs.readFileSync(candidate, "utf-8");
      }
    } catch {
      // Игнорируем ошибки доступа и пробуем следующий путь
    }
  }

  return FALLBACK_SEED_TASK_DOC_LUA;
}

/**
 * Единый атомарный Lua-скрипт сидинга и восстановления служебных структур документа задачи (5 состояний).
 */
export const SEED_TASK_DOC_LUA = loadSeedTaskDocLua();

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
 * Lua-скрипт для атомарной сверки зеркала сессии в Redis.
 *
 * Гарантирует:
 * 1. Защиту от race conditions с closeSession: если статус в Redis уже "closed",
 *    сессия не воскрешается (возвращает 0).
 * 2. Атомарную очистку и полную замену участников (session:<id>:members) для исключения зомби-доступа.
 * 3. Продление TTL существующего инвайт-токена или установку fallback-токена, исключая поломку валидных ссылок.
 * 4. Батчинг всех Redis-операций в 1 сетевой roundtrip.
 *
 * KEYS[1]: sessionActiveKey (session:<id>:active)
 * KEYS[2]: sessionMembersKey (session:<id>:members)
 * KEYS[3]: sessionInviteKey (session:<id>:invite)
 * ARGV[1]: activeValue ("true")
 * ARGV[2]: closedValue ("closed")
 * ARGV[3]: ttlSeconds
 * ARGV[4]: fallbackInviteToken
 * ARGV[5..]: userId1, role1, userId2, role2...
 */
export const RECONCILE_SESSION_MIRROR_LUA = `
local activeVal = redis.call('GET', KEYS[1])
if activeVal == ARGV[2] then
  return { 0, '' }
end

redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))

redis.call('DEL', KEYS[2])
local numArgs = #ARGV
if numArgs >= 6 then
  for i = 5, numArgs, 2 do
    redis.call('HSET', KEYS[2], ARGV[i], ARGV[i + 1])
  end
  redis.call('EXPIRE', KEYS[2], tonumber(ARGV[3]))
end

local existingInvite = redis.call('GET', KEYS[3])
local chosenInvite = existingInvite
if chosenInvite and chosenInvite ~= '' then
  redis.call('EXPIRE', KEYS[3], tonumber(ARGV[3]))
else
  chosenInvite = ARGV[4]
  redis.call('SET', KEYS[3], chosenInvite, 'EX', tonumber(ARGV[3]))
end

return { 1, chosenInvite }
`;

/** Участник интервью-сессии для синхронизации зеркала в Redis. */
export interface SessionMirrorParticipant {
  userId: string;
  role: InterviewParticipantRole;
}

/** Данные интервью-сессии для сверки и прогрева зеркала в Redis. */
export interface SessionMirrorData {
  id: string;
  inviteToken?: string | null;
  participants: SessionMirrorParticipant[];
}

/**
 * Ошибка выполнения post-commit операций (Redis, Pub/Sub, кэш) при создании live-match сессии.
 * Сигнализирует о том, что сессия успешно закоммичена в PostgreSQL (ACTIVE),
 * поэтому участников нельзя возвращать в очередь, а сессию нельзя удалять.
 */
export class LiveMatchPostCommitError extends Error {
  constructor(
    public readonly sessionId: string,
    public readonly inviteToken: string,
    public readonly cause: unknown,
  ) {
    super(
      `Live match session ${sessionId} committed, but post-commit operations failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "LiveMatchPostCommitError";
  }
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
    const inviteToken = this.generateInviteToken();
    const session = await this.prisma.interviewSession.create({
      data: {
        userId: creatorUserId,
        inviteToken,
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

    await this.redis.set(
      sessionInviteKey(session.id),
      inviteToken,
      this.mirrorTtlSeconds,
    );

    // Сидинг стартового документа задачи через seed_task_doc.lua строго после коммита транзакции сессии
    try {
      const starterUpdate = createStarterYjsUpdate("");
      await this.redis.eval<number>(
        SEED_TASK_DOC_LUA,
        2,
        sessionSeededTasksKey(session.id),
        sessionTaskUpdatesKey(session.id, DEFAULT_TASK_KEY),
        DEFAULT_TASK_KEY,
        starterUpdate,
        TASK_DOC_TTL_SECONDS,
      );
    } catch (error) {
      this.logger.warn(
        `failed to seed initial task doc for session ${session.id}, falling back to lazy seeding in realtime: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    this.logger.log(
      `created session ${session.id} (owner ${creatorUserId}) and warmed mirror`,
    );
    await this.invalidateUserDashboard(creatorUserId);
    return { sessionId: session.id, inviteToken };
  }

  /**
   * Инвалидирует кэш дашборда пользователя (upcoming, stats, readiness, recent).
   * Вызывается при создании, изменении состава и закрытии сессий (TASK-BACK-45).
   */
  private async invalidateUserDashboard(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.redis.delete(`cache:dashboard:upcoming:${userId}`),
        this.redis.delete(`cache:dashboard:stats:${userId}`),
        this.redis.delete(`cache:dashboard:readiness:${userId}`),
      ]);
      const recentKeys = await this.redis.scanKeys(
        `cache:dashboard:recent:${userId}:*`,
      );
      if (recentKeys.length > 0) {
        await Promise.all(recentKeys.map((k) => this.redis.delete(k)));
      }
    } catch (err) {
      this.logger.warn(
        `failed to invalidate dashboard cache for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Идемпотентно прогревает Redis-зеркало для участников сессии мгновенного матча.
   */
  async warmLiveMatchMirror(
    sessionId: string,
    firstUserId: string,
    secondUserId: string,
    inviteToken: string,
  ): Promise<void> {
    await this.redis.set(
      sessionActiveKey(sessionId),
      ACTIVE_VALUE,
      this.mirrorTtlSeconds,
    );
    await this.redis.hset(
      sessionMembersKey(sessionId),
      firstUserId,
      InterviewParticipantRole.CANDIDATE,
      this.mirrorTtlSeconds,
    );
    await this.redis.hset(
      sessionMembersKey(sessionId),
      secondUserId,
      InterviewParticipantRole.INTERVIEWER,
      this.mirrorTtlSeconds,
    );
    await this.redis.set(
      sessionInviteKey(sessionId),
      inviteToken,
      this.mirrorTtlSeconds,
    );

    try {
      await this.seedTaskDoc(sessionId, DEFAULT_TASK_KEY, "");
    } catch (error) {
      this.logger.warn(
        `failed to seed initial task doc for live match session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Создает сессию мгновенного матча для двоих участников со статусом ACTIVE,
   * сохраняет inviteToken в Postgres и прогревает Redis-зеркало для обоих участников (CWE-613).
   * При post-commit ошибках оборачивает исключение в LiveMatchPostCommitError с sessionId.
   */
  async createLiveMatchSession(
    firstUserId: string,
    secondUserId: string,
  ): Promise<{ sessionId: string; inviteToken: string }> {
    const inviteToken = this.generateInviteToken();
    const session = await this.prisma.interviewSession.create({
      data: {
        userId: firstUserId,
        status: InterviewSessionStatus.ACTIVE,
        inviteToken,
        startedAt: new Date(),
        participants: {
          create: [
            {
              userId: firstUserId,
              role: InterviewParticipantRole.CANDIDATE,
            },
            {
              userId: secondUserId,
              role: InterviewParticipantRole.INTERVIEWER,
            },
          ],
        },
      },
    });

    try {
      await this.warmLiveMatchMirror(
        session.id,
        firstUserId,
        secondUserId,
        inviteToken,
      );

      this.logger.log(
        `created live match session ${session.id} for users ${firstUserId} & ${secondUserId}`,
      );
      await Promise.all([
        this.invalidateUserDashboard(firstUserId),
        this.invalidateUserDashboard(secondUserId),
      ]);
    } catch (postCommitError) {
      throw new LiveMatchPostCommitError(
        session.id,
        inviteToken,
        postCommitError,
      );
    }

    return { sessionId: session.id, inviteToken };
  }

  /**
   * Атомарно проверяет и засевает/восстанавливает служебные структуры Yjs-документа задачи.
   */
  async seedTaskDoc(
    sessionId: string,
    taskKey: string,
    initialContent = "",
  ): Promise<number> {
    const starterUpdate = createStarterYjsUpdate(initialContent);
    return this.redis.eval<number>(
      SEED_TASK_DOC_LUA,
      2,
      sessionSeededTasksKey(sessionId),
      sessionTaskUpdatesKey(sessionId, taskKey),
      taskKey,
      starterUpdate,
      TASK_DOC_TTL_SECONDS,
    );
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

      // Синхронизация и сохранение фактически выбранного токена до валидации:
      // 1. Если токен есть в Redis, но отсутствует в Postgres (legacy-сессия) — сохраняем фактически выбранный токен в Postgres
      if (activeInviteToken && !fresh.inviteToken) {
        await tx.interviewSession.update({
          where: { id: sessionId },
          data: { inviteToken: activeInviteToken },
        });
        fresh.inviteToken = activeInviteToken;
      } else if (!activeInviteToken && fresh.inviteToken) {
        // 2. Если зеркало токена в Redis остыло (null), восстанавливаем из БД (TASK-BACK-37)
        activeInviteToken = fresh.inviteToken;
        await this.redis.set(
          sessionInviteKey(sessionId),
          activeInviteToken,
          this.mirrorTtlSeconds,
        );
      } else if (!activeInviteToken && !fresh.inviteToken) {
        // 3. Fallback: в legacy-сессии с истёкшим Redis-ключом токен отсутствует везде.
        // Генерируем fallback-токен и сохраняем согласованно в Postgres и Redis до проверок доступа.
        const fallbackToken = this.generateInviteToken(sessionId);
        activeInviteToken = fallbackToken;
        fresh.inviteToken = fallbackToken;
        await tx.interviewSession.update({
          where: { id: sessionId },
          data: { inviteToken: fallbackToken },
        });
        await this.redis.set(
          sessionInviteKey(sessionId),
          fallbackToken,
          this.mirrorTtlSeconds,
        );
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

    this.logger.log(
      `user ${userId} joined session ${sessionId} as ${participant.role}`,
    );

    await this.invalidateUserDashboard(userId);

    return {
      role: participant.role as InterviewParticipantRole,
      inviteToken: activeInviteToken ?? "",
    };
  }

  /**
   * Ротирует invite-токен сессии: генерирует новый криптографически стойкий токен,
   * сохраняет его в Postgres и Redis с обновлением TTL и возвращает `{ inviteToken }`.
   * Старый токен мгновенно становится невалидным (CWE-613).
   */
  async rotateInviteToken(
    sessionId: string,
    callerUserId?: string,
  ): Promise<{ inviteToken: string }> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    if (callerUserId && session.userId !== callerUserId) {
      throw new ForbiddenException(
        "Only the session owner can perform this action",
      );
    }
    if (session.status === InterviewSessionStatus.CLOSED) {
      throw new ForbiddenException("Session is closed");
    }

    const newInviteToken = this.generateInviteToken(sessionId);
    await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { inviteToken: newInviteToken },
    });
    await this.redis.set(
      sessionInviteKey(sessionId),
      newInviteToken,
      this.mirrorTtlSeconds,
    );

    this.logger.log(`rotated invite token for session ${sessionId}`);
    return { inviteToken: newInviteToken };
  }

  /**
   * Добавляет участника в сессию (только владелец): валидация UUID, проверка
   * статуса (не CLOSED) и лимита участников под FOR UPDATE, запись в Postgres +
   * HSET в зеркало с продлением TTL.
   */
  async addParticipant(
    sessionId: string,
    userId: string,
    role: InterviewParticipantRole,
    callerUserId?: string,
  ): Promise<void> {
    if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(userId)) {
      throw new NotFoundException("Session not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "interview_sessions" WHERE id = ${sessionId}::uuid FOR UPDATE
      `;

      if (!locked.length) {
        throw new NotFoundException("Session not found");
      }

      const session = await tx.interviewSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });

      if (!session) {
        throw new NotFoundException("Session not found");
      }

      if (callerUserId && session.userId !== callerUserId) {
        throw new ForbiddenException(
          "Only the session owner can perform this action",
        );
      }

      if (session.status === InterviewSessionStatus.CLOSED) {
        throw new ForbiddenException("Session is closed");
      }

      const isExisting = session.participants.some((p) => p.userId === userId);
      if (
        !isExisting &&
        session.participants.length >= this.maxSessionParticipants
      ) {
        throw new ForbiddenException("Interview session is full");
      }

      await tx.interviewParticipant.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: { sessionId, userId, role },
        update: { role },
      });
    });

    await this.redis.hset(
      sessionMembersKey(sessionId),
      userId,
      role,
      this.mirrorTtlSeconds,
    );
    await this.invalidateUserDashboard(userId);
  }

  /**
   * Удаляет участника из сессии:
   * 1. В транзакции блокирует строку сессии (FOR UPDATE), ротирует invite-токен
   *    в Postgres и Redis и удаляет участника из Postgres под тем же замком, исключая race condition с joinSession (CWE-613).
   * 2. После завершения транзакции выполняет HDEL из зеркала и публикует
   *    room-scoped ревокацию в realtime (WS 1008).
   */
  async removeParticipant(
    sessionId: string,
    userId: string,
    callerUserId?: string,
  ): Promise<void> {
    if (!UUID_REGEX.test(sessionId) || !UUID_REGEX.test(userId)) {
      throw new NotFoundException("Session not found");
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "interview_sessions" WHERE id = ${sessionId}::uuid FOR UPDATE
      `;

      if (!locked.length) {
        throw new NotFoundException("Session not found");
      }

      const session = await tx.interviewSession.findUnique({
        where: { id: sessionId },
        include: { participants: true },
      });

      if (!session) {
        throw new NotFoundException("Session not found");
      }

      if (callerUserId && session.userId !== callerUserId) {
        throw new ForbiddenException(
          "Only the session owner can perform this action",
        );
      }

      if (session.status === InterviewSessionStatus.CLOSED) {
        throw new ForbiddenException("Session is closed");
      }

      if (session.userId === userId) {
        throw new ForbiddenException("Cannot remove session owner");
      }

      const participant = session.participants.find((p) => p.userId === userId);
      if (!participant) {
        throw new NotFoundException("Participant not found in session");
      }

      // Инвалидируем старый инвайт-токен путём ротации нового под тем же lock
      const newInviteToken = this.generateInviteToken(sessionId);
      await tx.interviewSession.update({
        where: { id: sessionId },
        data: { inviteToken: newInviteToken },
      });
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

    await this.invalidateUserDashboard(userId);

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
  async closeSession(sessionId: string, callerUserId?: string): Promise<void> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

    const session = await this.prisma.interviewSession.findUnique({
      where: { id: sessionId },
      include: { participants: true },
    });
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (callerUserId && session.userId !== callerUserId) {
      throw new ForbiddenException(
        "Only the session owner can perform this action",
      );
    }

    // TASK-BACK-39: Если сессия уже закрыта, не перезаписываем endedAt
    if (session.status === InterviewSessionStatus.CLOSED) {
      return;
    }

    const participants = session.participants;

    await this.prisma.interviewSession.update({
      where: { id: sessionId },
      data: { status: InterviewSessionStatus.CLOSED, endedAt: new Date() },
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

    // TASK-BACK-38: Удаляем инвайт-токен и хэш участников закрытой сессии
    await this.redis.delete(sessionInviteKey(sessionId));
    await this.redis.delete(sessionMembersKey(sessionId));

    // TASK-BACK-45: Инвалидируем кэш дашборда для всех участников завершенной сессии
    await Promise.all(
      participants.map((p) => this.invalidateUserDashboard(p.userId)),
    );
  }

  /**
   * Восстанавливает зеркало ACTIVE-сессий из Postgres после потери/flush Redis
   * с защитой от race conditions, зомби-участников и N+1 через атомарный Lua-скрипт.
   *
   * Использует распределенный замок (`RedisService.setNx`), курсорную пагинацию
   * и изолированный try-catch для каждой сессии.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: "session-mirror-reconcile" })
  async reconcileMirrors(): Promise<void> {
    const lockKey = "lock:cron:session-mirror-reconcile";
    const lockToken = randomBytes(16).toString("hex");
    const lockTtlSeconds = 300;

    let acquired = false;
    try {
      acquired = await this.redis.setNx(lockKey, lockToken, lockTtlSeconds);
    } catch (err) {
      this.logger.warn(
        `reconcileMirrors: failed to acquire lock due to Redis error: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    if (!acquired) {
      this.logger.debug(
        "reconcileMirrors: lock already held by another replica, skipping run",
      );
      return;
    }

    let restored = 0;
    const BATCH_SIZE = 50;
    let cursor: string | undefined;
    let hasMore = true;

    try {
      while (hasMore) {
        let sessions: SessionMirrorData[] = [];

        try {
          sessions = await this.prisma.interviewSession.findMany({
            where: { status: InterviewSessionStatus.ACTIVE },
            include: { participants: true },
            take: BATCH_SIZE,
            skip: cursor ? 1 : 0,
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: { id: "asc" },
          });
        } catch (dbError) {
          this.logger.error(
            "reconcileMirrors: failed to fetch active sessions from Postgres",
            dbError instanceof Error ? dbError.stack : String(dbError),
          );
          break;
        }

        if (sessions.length === 0) {
          break;
        }

        cursor = sessions[sessions.length - 1].id;
        if (sessions.length < BATCH_SIZE) {
          hasMore = false;
        }

        for (const session of sessions) {
          try {
            const restoredCount = await this.reconcileSessionMirror(session);
            restored += restoredCount;
          } catch (sessionError) {
            this.logger.error(
              `reconcileMirrors: failed to reconcile session ${session.id}`,
              sessionError instanceof Error
                ? sessionError.stack
                : String(sessionError),
            );
          }
        }
      }
    } finally {
      try {
        await this.redis.compareAndDelete(lockKey, lockToken);
      } catch (unlockError) {
        this.logger.warn(
          `reconcileMirrors: failed to release lock: ${unlockError instanceof Error ? unlockError.message : String(unlockError)}`,
        );
      }
    }

    if (restored > 0) {
      this.logger.log(
        `reconcileMirrors: restored mirror for ${restored} ACTIVE session(s)`,
      );
    }
  }

  /**
   * Атомарно синхронизирует зеркало одной сессии в Redis через Lua-скрипт.
   *
   * @returns 1, если зеркало было успешно восстановлено/обновлено; 0, если сессия уже закрыта в Redis.
   */
  private async reconcileSessionMirror(
    session: SessionMirrorData,
  ): Promise<number> {
    const activeKey = sessionActiveKey(session.id);
    const membersKey = sessionMembersKey(session.id);
    const inviteKey = sessionInviteKey(session.id);
    const fallbackToken =
      session.inviteToken ?? this.generateInviteToken(session.id);

    const membersArgs: string[] = [];
    for (const p of session.participants) {
      membersArgs.push(p.userId, p.role.toString());
    }

    const result = await this.redis.eval<[number, string] | number>(
      RECONCILE_SESSION_MIRROR_LUA,
      3,
      activeKey,
      membersKey,
      inviteKey,
      ACTIVE_VALUE,
      CLOSED_VALUE,
      this.mirrorTtlSeconds,
      fallbackToken,
      ...membersArgs,
    );

    let status = 0;
    let chosenToken: string | null = null;
    if (Array.isArray(result)) {
      status = Number(result[0]);
      chosenToken =
        typeof result[1] === "string" && result[1].length > 0
          ? result[1]
          : null;
    } else if (typeof result === "number") {
      status = result;
      chosenToken = fallbackToken;
    }

    if (status !== 1) {
      return 0;
    }

    // Сохраняем в Postgres именно фактически выбранный токен (существующий из Redis или сгенерированный fallback)
    if (!session.inviteToken && chosenToken) {
      try {
        await this.prisma.interviewSession.update({
          where: { id: session.id },
          data: { inviteToken: chosenToken },
        });
        session.inviteToken = chosenToken;
      } catch (dbError) {
        this.logger.error(
          `reconcileSessionMirror: failed to update inviteToken in Postgres for session ${session.id}`,
          dbError instanceof Error ? dbError.stack : String(dbError),
        );
      }
    }

    return 1;
  }

  /**
   * Application-level backfill для сохранения legacy-токенов ACTIVE-сессий в Postgres.
   *
   * Считывает текущий токен из sessionInviteKey в Redis и записывает его в Postgres.
   * Для уже истёкших Redis-ключей старый токен восстановить нельзя (пропускаются,
   * для таких сессий потребуется новая ссылка при подключении).
   */
  async backfillActiveInviteTokens(): Promise<{
    total: number;
    updated: number;
    expired: number;
  }> {
    let total = 0;
    let updated = 0;
    let expired = 0;
    const BATCH_SIZE = 50;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      let sessions: Array<{ id: string; inviteToken: string | null }> = [];
      try {
        sessions = await this.prisma.interviewSession.findMany({
          where: {
            status: InterviewSessionStatus.ACTIVE,
            inviteToken: null,
          },
          select: { id: true, inviteToken: true },
          take: BATCH_SIZE,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { id: "asc" },
        });
      } catch (dbError) {
        this.logger.error(
          "backfillActiveInviteTokens: failed to fetch active sessions from Postgres",
          dbError instanceof Error ? dbError.stack : String(dbError),
        );
        break;
      }

      if (sessions.length === 0) {
        break;
      }

      cursor = sessions[sessions.length - 1].id;
      if (sessions.length < BATCH_SIZE) {
        hasMore = false;
      }

      for (const session of sessions) {
        total++;
        try {
          const redisToken = await this.redis.get(sessionInviteKey(session.id));
          if (redisToken && redisToken.trim().length > 0) {
            await this.prisma.interviewSession.update({
              where: { id: session.id },
              data: { inviteToken: redisToken.trim() },
            });
            updated++;
          } else {
            expired++;
            this.logger.warn(
              `backfillActiveInviteTokens: Redis key expired for session ${session.id}; cannot restore legacy token, new link will be required`,
            );
          }
        } catch (sessionError) {
          this.logger.error(
            `backfillActiveInviteTokens: error processing session ${session.id}`,
            sessionError instanceof Error
              ? sessionError.stack
              : String(sessionError),
          );
        }
      }
    }

    this.logger.log(
      `backfillActiveInviteTokens completed: total=${total}, updated=${updated}, expired=${expired}`,
    );

    return { total, updated, expired };
  }

  /**
   * Возвращает владельца сессии (для авторизации владельцев).
   *
   * @throws {NotFoundException} Если сессия не существует (404).
   */
  async getOwner(sessionId: string): Promise<string> {
    if (!UUID_REGEX.test(sessionId)) {
      throw new NotFoundException("Session not found");
    }

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
