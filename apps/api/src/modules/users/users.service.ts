import "multer";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  CompleteOnboardingDto,
  DeviceSettingsDto,
  Locale,
  PublicUserProfileDto,
  SecurityUnlinkResponseDto,
  TelegramUnlinkRequestResponseDto,
  ThemeMode,
  UpdateDeviceSettingsDto,
  UpdateProfileDto,
  UserProfileDto,
} from "@packages/dto";
import { SECURITY_UNLINK_ERROR_CODES } from "@packages/dto";
import { SystemPermission, SystemRole } from "@packages/types";
import { revokeUserSessionsWithRetry } from "../../common/revocation/sessions-revocation";
import {
  type Prisma,
  type Role,
  SecurityEventType,
  ThemePreference,
  type User,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { REDIS_SESSION_PREFIX } from "../auth/auth.constants";
import { AuthSessionService } from "../auth/services/auth-session.service";
import { NotificationDispatcher } from "../notifications/notification-dispatcher.service";
import { RabbitMqPublisher } from "../notifications/rabbitmq-publisher.service";
import {
  SECURITY_EVENT_UNLINK_METADATA,
  TELEGRAM_UNLINK_MAX_ATTEMPTS,
  TELEGRAM_UNLINK_REDIS_PREFIX,
  TELEGRAM_UNLINK_TTL_MINUTES,
  TELEGRAM_UNLINK_TTL_SECONDS,
} from "../security-events/security-events.constants";
import { SecurityEventsService } from "../security-events/security-events.service";
import { StorageService } from "../storage/storage.service";

/** Регулярное выражение для проверки UUID v4 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 30 дней в миллисекундах (период на восстановление аккаунта) */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Запись кода отвязки исчезла между чтением и инкрементом попыток. */
const UNLINK_RECORD_MISSING = -1;

/** Лимит неверных попыток исчерпан — запись удалена. */
const UNLINK_ATTEMPTS_EXCEEDED = -2;

/**
 * Атомарный инкремент счётчика неверных попыток отвязки Telegram.
 *
 * Читать-и-перезаписывать из Node нельзя: параллельные запросы с неверным
 * кодом прочитали бы `attempts = 0` и обошли лимит в 5 попыток. Скрипт
 * возвращает число попыток, `-1` — записи больше нет, `-2` — лимит исчерпан
 * (запись удаляется). `expiresAt`/TTL не продлеваются: код живёт свои 10 минут
 * независимо от числа опечаток.
 */
const INCREMENT_UNLINK_ATTEMPTS_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then
  return -1
end
local data = cjson.decode(raw)
local attempts = (tonumber(data.attempts) or 0) + 1
if attempts >= tonumber(ARGV[1]) then
  redis.call("DEL", KEYS[1])
  return -2
end
data.attempts = attempts
local ttl = redis.call("TTL", KEYS[1])
redis.call("SET", KEYS[1], cjson.encode(data))
if ttl > 0 then
  redis.call("EXPIRE", KEYS[1], ttl)
end
return attempts
`;

/** Пользователь со связанной ролью */
export type UserWithRoleAndPermissions = User & {
  role: Role | null;
};

/** Селектор полей для полного профиля пользователя (без passwordHash) */
const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  telegramUsername: true,
  telegramLinkVerified: true,
  gitUrl: true,
  githubId: true,
  theme: true,
  locale: true,
  timezone: true,
  onboardingCompleted: true,
  targetRole: true,
  targetLevel: true,
  targetCompanies: true,
  targetTimeline: true,
  preferredFormat: true,
  onboardingAt: true,
  role: {
    select: {
      slug: true,
      permissions: true,
    },
  },
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Селектор полей для публичного профиля (без email и updatedAt) */
const PUBLIC_PROFILE_SELECT = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  telegramUsername: true,
  gitUrl: true,
  createdAt: true,
} as const;

/**
 * Сервис управления пользователями и профилями (§9, §10 SPEC.md).
 *
 * Предоставляет поиск по email, id и username, создание пользователя с дефолтной ролью USER,
 * обновление хеша пароля и управление профилями (§9, §10 SPEC.md).
 * Работает уже с захешированным паролем — хеширование
 * является ответственностью вызывающего модуля (AuthService).
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => AuthSessionService))
    private readonly authSessionService: AuthSessionService,
    private readonly notificationDispatcher: NotificationDispatcher,
    private readonly securityEventsService: SecurityEventsService,
    private readonly rabbitMqPublisher: RabbitMqPublisher,
  ) {}

  /**
   * Инвалидирует кэш готовности профиля для дашборда (TASK-BACK-45).
   */
  async invalidateReadinessCache(userId: string): Promise<void> {
    try {
      await this.redisService.delete(`cache:dashboard:readiness:${userId}`);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate readiness cache for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Ищет пользователя по ID.
   *
   * @param id - UUID пользователя.
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Ищет пользователя по ID с подгрузкой роли и прав.
   *
   * @param id - UUID пользователя.
   * @returns Объект пользователя с ролью и правами или `null`.
   */
  async findUserWithRoleById(
    id: string,
  ): Promise<UserWithRoleAndPermissions | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
      },
    });
  }

  /**
   * Ищет пользователя по email.
   *
   * @param email - Нормализованный email (lowercase).
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Ищет пользователя по email с подгрузкой роли и прав.
   *
   * @param email - Нормализованный email (lowercase).
   * @returns Объект пользователя с ролью и правами или `null`.
   */
  async findUserWithRoleByEmail(
    email: string,
  ): Promise<UserWithRoleAndPermissions | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        role: true,
      },
    });
  }

  /**
   * Ищет пользователя по telegramId.
   *
   * @param telegramId - BigInt ID пользователя в Telegram.
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  /**
   * Ищет пользователя по telegramId с подгрузкой роли и прав.
   *
   * @param telegramId - BigInt ID пользователя в Telegram.
   * @returns Объект пользователя с ролью и правами или `null`.
   */
  async findUserWithRoleByTelegramId(
    telegramId: bigint,
  ): Promise<UserWithRoleAndPermissions | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: {
        role: true,
      },
    });
  }

  /**
   * Ищет пользователя по username.
   *
   * @param username - Уникальный username.
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /**
   * Создаёт нового пользователя с назначением дефолтной роли USER.
   *
   * @param data - Обязательные поля: `email` (нормализованный), `passwordHash` (Argon2id), опционально `roleSlug`.
   * @returns Созданный объект пользователя.
   */
  async create(data: {
    email: string;
    passwordHash: string | null;
    githubId?: string;
    roleSlug?: string;
  }): Promise<User> {
    const roleSlug = data.roleSlug ?? SystemRole.USER;
    const defaultRole = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });

    if (!defaultRole) {
      throw new InternalServerErrorException(
        `Default role '${roleSlug}' not found in database.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          ...(data.githubId ? { githubId: data.githubId } : {}),
          roleId: defaultRole.id,
        },
      });

      // Строка outbox пишется в той же транзакции, что и пользователь
      // (ADR-003:65-68). Эмит после commit терял бы событие при падении
      // процесса между ними, а эмит внутри отдельной транзакции показал бы
      // фантом пользователю, для которого транзакция откатилась.
      await this.notificationDispatcher.dispatch(
        { type: "system.welcome", payload: {} },
        user.id,
        tx,
      );

      return user;
    });
  }

  /**
   * Привязывает Telegram-аккаунт к пользователю.
   *
   * @param userId - UUID пользователя.
   * @param data - Telegram данные: `telegramId` и опционально `telegramUsername`.
   * @returns Сообщение об успешной привязке.
   * @throws {NotFoundException} Если пользователь не найден (или P2025).
   * @throws {ConflictException} Если у пользователя уже привязан иной Telegram аккаунт или этот TelegramId занят другим пользователем (или P2002).
   */
  async linkTelegram(
    userId: string,
    data: { telegramId: bigint; telegramUsername?: string | null },
  ): Promise<{ message: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.telegramId !== null) {
      if (user.telegramId === data.telegramId && !user.telegramLinkVerified) {
        throw new BadRequestException(
          "Cannot verify unconfirmed Telegram link without independent email verification",
        );
      }
      throw new ConflictException(
        "Telegram account is already linked to this user",
      );
    }

    const existingTgUser = await this.findByTelegramId(data.telegramId);
    if (existingTgUser && existingTgUser.id !== userId) {
      throw new ConflictException(
        "Telegram account is already linked to another user",
      );
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          telegramId: data.telegramId,
          telegramUsername: data.telegramUsername ?? null,
          telegramLinkVerified: true,
        },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        if (error.code === "P2002") {
          throw new ConflictException(
            "Telegram account is already linked to another user",
          );
        }
        if (error.code === "P2025") {
          throw new NotFoundException("User not found");
        }
      }
      throw error;
    }

    await this.invalidateReadinessCache(userId);

    return { message: "Telegram account linked successfully" };
  }

  /**
   * Создаёт нового пользователя через Telegram с назначением дефолтной роли USER.
   *
   * @param data - Данные Telegram регистрации: `email`, `passwordHash`, `telegramId`, `telegramUsername`, `displayName`, `avatarUrl`.
   * @returns Созданный объект пользователя.
   */
  async createTelegramUser(data: {
    email: string;
    passwordHash: string;
    telegramId: bigint;
    telegramUsername?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    roleSlug?: string;
    telegramLinkVerified?: boolean;
  }): Promise<User> {
    const roleSlug = data.roleSlug ?? SystemRole.USER;
    const defaultRole = await this.prisma.role.findUnique({
      where: { slug: roleSlug },
    });

    if (!defaultRole) {
      throw new InternalServerErrorException(
        `Default role '${roleSlug}' not found in database.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          telegramId: data.telegramId,
          telegramUsername: data.telegramUsername ?? null,
          telegramLinkVerified: data.telegramLinkVerified ?? false,
          displayName: data.displayName ?? null,
          avatarUrl: data.avatarUrl ?? null,
          username: null,
          roleId: defaultRole.id,
        },
      });

      // Приветствие шлётся наравне с email-регистрацией: точка входа другая,
      // а инвариант «у созданного пользователя есть приветственное уведомление»
      // должен выполняться всегда.
      await this.notificationDispatcher.dispatch(
        { type: "system.welcome", payload: {} },
        user.id,
        tx,
      );

      return user;
    });
  }

  /**
   * Обновляет хеш пароля пользователя (§67 SPEC.md).
   *
   * @param id - UUID пользователя.
   * @param passwordHash - Новый Argon2id хеш пароля.
   * @returns Обновлённый объект пользователя.
   * @throws {Prisma.PrismaClientKnownRequestError} Если пользователь не найден (P2025).
   */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  /**
   * Получает полный профиль пользователя по ID.
   *
   * @param userId - UUID пользователя.
   * @returns DTO профиля пользователя.
   * @throws {NotFoundException} Если пользователь не найден.
   */
  async getProfile(userId: string): Promise<UserProfileDto> {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_PROFILE_SELECT,
    });

    if (!profile) {
      throw new NotFoundException("User profile not found");
    }

    return this.mapToUserProfile(profile);
  }

  /**
   * Обновляет профиль пользователя.
   *
   * @param userId - UUID пользователя.
   * @param dto - Валидированные данные для обновления.
   * @returns Обновленный DTO профиля.
   * @throws {NotFoundException} Если пользователь не найден.
   * @throws {ConflictException} Если username уже занят другим пользователем.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    // D2: отвязка возможна только отдельными эндпоинтами (код + ревокация +
    // аудит). Обнуление через PATCH обходило бы всю защиту ADR-005, поэтому
    // отклоняется, а не игнорируется — иначе клиент считал бы, что отвязал.
    if (dto.telegramUsername === null || dto.gitUrl === null) {
      throw new BadRequestException(
        "Unlinking accounts via profile update is not allowed. Use the dedicated unlink endpoints.",
      );
    }

    if (dto.username && dto.username !== existing.username) {
      const userWithSameUsername = await this.findByUsername(dto.username);
      if (userWithSameUsername && userWithSameUsername.id !== userId) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
    }

    if (
      dto.telegramUsername !== undefined &&
      dto.telegramUsername !== null &&
      !existing.telegramLinkVerified
    ) {
      throw new BadRequestException(
        "Telegram account cannot be linked manually. Please link it via Telegram widget.",
      );
    }

    if (dto.gitUrl !== undefined && dto.gitUrl !== null && !existing.githubId) {
      throw new BadRequestException(
        "GitHub account cannot be linked manually. Please link it via GitHub OAuth.",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.username !== undefined && { username: dto.username }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
        ...(dto.telegramUsername !== undefined && {
          telegramUsername: dto.telegramUsername,
        }),
        ...(dto.gitUrl !== undefined && {
          gitUrl: dto.gitUrl,
        }),
        ...(dto.theme !== undefined && {
          theme: dto.theme.toUpperCase() as ThemePreference,
        }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
      },
      select: USER_PROFILE_SELECT,
    });

    await this.invalidateReadinessCache(userId);

    return this.mapToUserProfile(updated);
  }

  /**
   * Запускает флоу подтверждаемой отвязки Telegram (D4–D6).
   *
   * Генерирует 6-значный код, кладёт в Redis только его SHA-256 хеш (D14) и
   * отправляет сам код боту через `RabbitMqPublisher`: API не умеет писать в
   * Telegram напрямую, единственный консьюмер очереди — `apps/telegram-bot`.
   * Запись в `notification_outbox` не создаётся намеренно — код не должен
   * осесть в БД (D6).
   *
   * @param userId - UUID пользователя из JWT.
   * @returns `{ sent: true, expiresAt }`.
   * @throws {BadRequestException} Telegram не привязан (`TELEGRAM_NOT_LINKED`).
   * @throws {ServiceUnavailableException} Брокер недоступен — код не доставлен.
   */
  async requestTelegramUnlink(
    userId: string,
  ): Promise<TelegramUnlinkRequestResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramChatId: true,
        telegramLinkVerified: true,
        locale: true,
        telegramLocale: true,
        timezone: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.telegramChatId || !user.telegramLinkVerified) {
      throw new BadRequestException({
        code: SECURITY_UNLINK_ERROR_CODES.TELEGRAM_NOT_LINKED,
        message: "Telegram is not linked",
      });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const key = `${TELEGRAM_UNLINK_REDIS_PREFIX}${userId}`;
    const expiresAtMs = Date.now() + TELEGRAM_UNLINK_TTL_SECONDS * 1000;

    await this.redisService.set(
      key,
      JSON.stringify({
        hash: this.hashUnlinkCode(code),
        attempts: 0,
        expiresAt: expiresAtMs,
      }),
      TELEGRAM_UNLINK_TTL_SECONDS,
    );

    try {
      await this.rabbitMqPublisher.publish(
        {
          event: {
            type: "security.telegram_unlink_code",
            payload: { code, ttlMinutes: TELEGRAM_UNLINK_TTL_MINUTES },
          },
          chatId: user.telegramChatId,
          locale: user.telegramLocale ?? user.locale,
          timeZone: user.timezone,
        },
        `security:tg-unlink:${userId}:${expiresAtMs}`,
      );
    } catch (error) {
      // Код не ушёл: оставлять валидную запись нельзя, иначе код «висит» без
      // получателя. Сам код в лог не пишем (D14).
      await this.redisService.delete(key).catch(() => undefined);
      this.logger.error(
        `Failed to publish Telegram unlink code for user ${userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        "Failed to send the confirmation code",
      );
    }

    return { sent: true, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  /**
   * Подтверждает отвязку Telegram одноразовым кодом (D4–D5).
   *
   * Сравнение кода — `timingSafeEqual` по SHA-256 хешу (D5). Запись
   * расходуется атомарно (`compareAndDelete`) только после успешной проверки:
   * `getdel` до сравнения «сжигал» бы код при опечатке и ломал счётчик попыток.
   * Неверные попытки инкрементируются отдельным Lua-скриптом, чтобы
   * параллельные запросы не обходили лимит (5 попыток, далее инвалидация).
   *
   * @param userId - UUID пользователя из JWT.
   * @param code - 6-значный код из Telegram.
   * @param ipAddress - IP запроса (только для аудита, в DTO не отдаётся).
   * @param userAgent - User-Agent запроса (только для аудита).
   * @returns `{ success: true }`.
   * @throws {BadRequestException} Неверный код (`INVALID_CODE`).
   * @throws {GoneException} Код истёк или отсутствует (`CODE_EXPIRED`, 410).
   * @throws {ConflictException} Уже отвязано (`ALREADY_UNLINKED`, 409).
   * @throws {HttpException} Исчерпан лимит попыток (`ATTEMPTS_EXCEEDED`, 429).
   */
  async confirmTelegramUnlink(
    userId: string,
    code: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<SecurityUnlinkResponseDto> {
    const key = `${TELEGRAM_UNLINK_REDIS_PREFIX}${userId}`;

    let raw: string | null;
    try {
      raw = await this.redisService.get(key);
    } catch (error) {
      this.logger.error(
        "Redis unavailable during confirmTelegramUnlink",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }

    if (!raw) {
      throw new GoneException({
        code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
        message: "Confirmation code has expired",
      });
    }

    const record = this.parseUnlinkRecord(raw);

    if (record.expiresAt !== undefined && record.expiresAt <= Date.now()) {
      await this.redisService.delete(key).catch(() => undefined);
      throw new GoneException({
        code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
        message: "Confirmation code has expired",
      });
    }

    if (!this.safeEqualHex(this.hashUnlinkCode(code), record.hash)) {
      const attempts = await this.registerFailedUnlinkAttempt(key);

      if (attempts === UNLINK_RECORD_MISSING) {
        throw new GoneException({
          code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
          message: "Confirmation code has expired",
        });
      }
      if (attempts === UNLINK_ATTEMPTS_EXCEEDED) {
        throw new HttpException(
          {
            code: SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED,
            message: "Too many invalid attempts, request a new code",
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new BadRequestException({
        code: SECURITY_UNLINK_ERROR_CODES.INVALID_CODE,
        message: "Invalid confirmation code",
      });
    }

    const consumed = await this.redisService.compareAndDelete(key, raw);
    if (!consumed) {
      // Параллельный confirm уже израсходовал код.
      throw new ConflictException({
        code: SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED,
        message: "Telegram is already unlinked",
      });
    }

    let taskId: string | undefined;
    let taskCreatedAt: Date | undefined;
    let taskGeneration: number | undefined;

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { telegramChatId: true, telegramLinkVerified: true },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (!user.telegramChatId || !user.telegramLinkVerified) {
        throw new ConflictException({
          code: SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED,
          message: "Telegram is already unlinked",
        });
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          telegramId: null,
          telegramUsername: null,
          telegramChatId: null,
          telegramLinkVerified: false,
          telegramLocale: null,
          generation: { increment: 1 },
        },
        select: { generation: true },
      });

      const preIncrementGeneration = updated.generation - 1;
      const task = await tx.authRevocationTask.create({
        data: { userId, generation: preIncrementGeneration },
      });
      taskId = task.id;
      taskCreatedAt = task.createdAt;
      taskGeneration = preIncrementGeneration;

      await this.securityEventsService.record({
        tx,
        userId,
        type: SecurityEventType.TG_UNLINKED,
        ipAddress,
        userAgent,
        metadata: SECURITY_EVENT_UNLINK_METADATA,
      });
    });

    await this.finalizeRevocation(userId, {
      taskId,
      taskCreatedAt,
      taskGeneration,
    });

    return { success: true };
  }

  /**
   * Отвязывает GitHub с ревокацией сессий и аудитом (D4, D7, D9).
   *
   * Отвязка последнего способа входа запрещена: `passwordHash` nullable
   * (существуют GitHub-only аккаунты), поэтому без пароля и без Telegram
   * пользователь остался бы без входа вообще. Проверка и изменение — в одной
   * транзакции, чтобы между проверкой и апдейтом не проскочила смена пароля.
   *
   * @param userId - UUID пользователя из JWT.
   * @param ipAddress - IP запроса (только для аудита).
   * @param userAgent - User-Agent запроса (только для аудита).
   * @returns `{ success: true }`.
   * @throws {BadRequestException} GitHub не привязан (`GITHUB_NOT_LINKED`).
   * @throws {ConflictException} Это последний способ входа (`LAST_AUTH_METHOD`, 409).
   */
  async unlinkGithub(
    userId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<SecurityUnlinkResponseDto> {
    let taskId: string | undefined;
    let taskCreatedAt: Date | undefined;
    let taskGeneration: number | undefined;

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          githubId: true,
          passwordHash: true,
          telegramChatId: true,
          telegramLinkVerified: true,
        },
      });

      if (!user) {
        throw new NotFoundException("User not found");
      }

      if (!user.githubId) {
        throw new BadRequestException({
          code: SECURITY_UNLINK_ERROR_CODES.GITHUB_NOT_LINKED,
          message: "GitHub is not linked",
        });
      }

      const hasPassword = Boolean(user.passwordHash);
      const hasTelegram =
        user.telegramLinkVerified && Boolean(user.telegramChatId);

      if (!hasPassword && !hasTelegram) {
        throw new ConflictException({
          code: SECURITY_UNLINK_ERROR_CODES.LAST_AUTH_METHOD,
          message: "Cannot unlink the last sign-in method",
        });
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          githubId: null,
          gitUrl: null,
          generation: { increment: 1 },
        },
        select: { generation: true },
      });

      const preIncrementGeneration = updated.generation - 1;
      const task = await tx.authRevocationTask.create({
        data: { userId, generation: preIncrementGeneration },
      });
      taskId = task.id;
      taskCreatedAt = task.createdAt;
      taskGeneration = preIncrementGeneration;

      await this.securityEventsService.record({
        tx,
        userId,
        type: SecurityEventType.GITHUB_UNLINKED,
        ipAddress,
        userAgent,
        metadata: SECURITY_EVENT_UNLINK_METADATA,
      });
    });

    await this.finalizeRevocation(userId, {
      taskId,
      taskCreatedAt,
      taskGeneration,
    });

    return { success: true };
  }

  /**
   * Завершает ревокацию после транзакции отвязки: отзыв сессий + публикация
   * сигнала, затем удаление durable-задачи. Ошибка не пробрасывается: само
   * изменение и аудит уже зафиксированы, а задача остаётся воркеру
   * `SessionRevocationCron` для повторной попытки (как в `deactivateAccount`).
   */
  private async finalizeRevocation(
    userId: string,
    task: {
      taskId?: string;
      taskCreatedAt?: Date;
      taskGeneration?: number;
    },
  ): Promise<void> {
    try {
      await this.revokeSessionsWithRetry(
        userId,
        task.taskCreatedAt,
        task.taskGeneration,
      );
      if (task.taskId) {
        await this.prisma.authRevocationTask
          .delete({ where: { id: task.taskId } })
          .catch(() => undefined);
      }
    } catch (error) {
      this.logger.error(
        `Failed to revoke sessions / publish revocation for user ${userId} during unlink (persisted for worker retry)`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /** SHA-256 хеш кода отвязки: в Redis и для сравнения хранится только он (D14). */
  private hashUnlinkCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  /**
   * Сравнение хешей в постоянном времени (D5).
   *
   * Через `timingSafeEqual` по буферам одинаковой длины; несовпадение длины
   * (повреждённая запись) трактуется как несовпадение.
   */
  private safeEqualHex(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, "hex");
    const bufferB = Buffer.from(b, "hex");

    if (bufferA.length === 0 || bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  }

  /**
   * Разбирает запись кода отвязки; повреждённая запись трактуется как
   * отсутствующая (`CODE_EXPIRED`), потому что проверить её всё равно нельзя.
   */
  private parseUnlinkRecord(raw: string): { hash: string; expiresAt?: number } {
    try {
      const parsed = JSON.parse(raw) as {
        hash?: unknown;
        expiresAt?: unknown;
      };
      if (typeof parsed.hash === "string" && parsed.hash.length > 0) {
        return {
          hash: parsed.hash,
          expiresAt:
            typeof parsed.expiresAt === "number" ? parsed.expiresAt : undefined,
        };
      }
    } catch {
      // ignore — treated as expired below
    }

    throw new GoneException({
      code: SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
      message: "Confirmation code has expired",
    });
  }

  /**
   * Атомарно инкрементирует счётчик неверных попыток и удаляет запись при
   * исчерпании лимита. Возвращает `-1` (запись исчезла) или `-2` (лимит).
   */
  private async registerFailedUnlinkAttempt(key: string): Promise<number> {
    try {
      return await this.redisService.eval<number>(
        INCREMENT_UNLINK_ATTEMPTS_SCRIPT,
        [key],
        [TELEGRAM_UNLINK_MAX_ATTEMPTS],
      );
    } catch (error) {
      this.logger.error(
        "Redis unavailable during registerFailedUnlinkAttempt",
        error instanceof Error ? error.message : String(error),
      );
      throw new InternalServerErrorException();
    }
  }

  /**
   * Получает настройки медиа/устройств пользователя для конкретного клиентского устройства.
   * Если для данного clientId настроек еще нет в таблице user_device_settings, возвращает значения по умолчанию.
   */
  async getDeviceSettings(
    userId: string,
    clientId: string,
  ): Promise<DeviceSettingsDto> {
    const existing = await this.prisma.userDeviceSettings.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId,
        },
      },
    });

    if (existing) {
      return {
        clientId: existing.clientId,
        deviceName: existing.deviceName,
        audioVolume: existing.audioVolume,
        speechVolume: existing.speechVolume,
        micGain: existing.micGain,
        preferredAudioInputLabel: existing.preferredAudioInputLabel,
        preferredAudioOutputLabel: existing.preferredAudioOutputLabel,
        preferredVideoInputLabel: existing.preferredVideoInputLabel,
        isPersisted: true,
      };
    }

    return {
      clientId,
      deviceName: null,
      audioVolume: 80,
      speechVolume: 80,
      micGain: 100,
      preferredAudioInputLabel: null,
      preferredAudioOutputLabel: null,
      preferredVideoInputLabel: null,
      isPersisted: false,
    };
  }

  /**
   * Сохраняет (upsert) настройки медиа/устройств пользователя для конкретного клиентского устройства.
   * Операция сериализуется в транзакции с блокировкой строки пользователя (FOR UPDATE),
   * что исключает гонки при одновременных запросах и гарантирует жесткий лимит в 10 устройств.
   */
  async upsertDeviceSettings(
    userId: string,
    dto: UpdateDeviceSettingsDto,
  ): Promise<DeviceSettingsDto> {
    if (!UUID_REGEX.test(userId)) {
      throw new BadRequestException("Invalid user ID");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "users" WHERE id = ${userId}::uuid FOR UPDATE
      `;

      if (!locked.length) {
        throw new NotFoundException("User not found");
      }

      const existing = await tx.userDeviceSettings.findUnique({
        where: {
          userId_clientId: {
            userId,
            clientId: dto.clientId,
          },
        },
      });

      const record = await tx.userDeviceSettings.upsert({
        where: {
          userId_clientId: {
            userId,
            clientId: dto.clientId,
          },
        },
        create: {
          userId,
          clientId: dto.clientId,
          deviceName: dto.deviceName ?? null,
          audioVolume: dto.audioVolume ?? existing?.audioVolume ?? 80,
          speechVolume: dto.speechVolume ?? existing?.speechVolume ?? 80,
          micGain: dto.micGain ?? existing?.micGain ?? 100,
          preferredAudioInputLabel:
            dto.preferredAudioInputLabel !== undefined
              ? dto.preferredAudioInputLabel
              : (existing?.preferredAudioInputLabel ?? null),
          preferredAudioOutputLabel:
            dto.preferredAudioOutputLabel !== undefined
              ? dto.preferredAudioOutputLabel
              : (existing?.preferredAudioOutputLabel ?? null),
          preferredVideoInputLabel:
            dto.preferredVideoInputLabel !== undefined
              ? dto.preferredVideoInputLabel
              : (existing?.preferredVideoInputLabel ?? null),
        },
        update: {
          ...(dto.deviceName !== undefined && { deviceName: dto.deviceName }),
          ...(dto.audioVolume !== undefined && {
            audioVolume: dto.audioVolume,
          }),
          ...(dto.speechVolume !== undefined && {
            speechVolume: dto.speechVolume,
          }),
          ...(dto.micGain !== undefined && { micGain: dto.micGain }),
          ...(dto.preferredAudioInputLabel !== undefined && {
            preferredAudioInputLabel: dto.preferredAudioInputLabel,
          }),
          ...(dto.preferredAudioOutputLabel !== undefined && {
            preferredAudioOutputLabel: dto.preferredAudioOutputLabel,
          }),
          ...(dto.preferredVideoInputLabel !== undefined && {
            preferredVideoInputLabel: dto.preferredVideoInputLabel,
          }),
        },
      });

      // Ограничиваем количество сохраненных устройств пользователя до 10 (удаляем самые старые)
      const userDevices = await tx.userDeviceSettings.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });

      if (userDevices.length > 10) {
        const toDelete = userDevices.slice(10).map((d) => d.id);
        await tx.userDeviceSettings.deleteMany({
          where: { id: { in: toDelete } },
        });
      }

      return {
        clientId: record.clientId,
        deviceName: record.deviceName,
        audioVolume: record.audioVolume,
        speechVolume: record.speechVolume,
        micGain: record.micGain,
        preferredAudioInputLabel: record.preferredAudioInputLabel,
        preferredAudioOutputLabel: record.preferredAudioOutputLabel,
        preferredVideoInputLabel: record.preferredVideoInputLabel,
        isPersisted: true,
      };
    });

    await this.invalidateReadinessCache(userId);

    return result;
  }

  /**
   * Загружает и обновляет аватар пользователя.
   *
   * @param userId - UUID пользователя.
   * @param file - Загружаемый файл.
   * @returns Объект с новым URL аватара.
   */
  async updateAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const oldAvatarUrl = existing.avatarUrl;
    const newAvatarUrl = await this.storageService.uploadAvatar(userId, file);

    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: newAvatarUrl },
    });

    // Удаляем старый аватар из S3 после успешного обновления БД
    if (oldAvatarUrl) {
      await this.storageService.deleteFile(oldAvatarUrl);
    }

    await this.invalidateReadinessCache(userId);

    return { avatarUrl: newAvatarUrl };
  }

  /**
   * Удаляет аватар пользователя из S3 и обнуляет avatarUrl в БД.
   *
   * @param userId - UUID пользователя.
   */
  async deleteAvatar(userId: string): Promise<void> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    if (existing.avatarUrl) {
      await this.storageService.deleteFile(existing.avatarUrl);
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: null },
      });
      await this.invalidateReadinessCache(userId);
    }
  }

  /**
   * Деактивирует аккаунт (soft-delete с 30-дневным окном восстановления).
   *
   * @param userId - UUID пользователя.
   * @param sessionId - Опциональный ID текущей сессии для очистки в Redis.
   */
  async deactivateAccount(userId: string, sessionId?: string): Promise<void> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    let taskId: string | undefined;
    let taskCreatedAt: Date | undefined;
    let taskGeneration: number | undefined;

    await this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          generation: { increment: 1 },
        },
        select: {
          generation: true,
        },
      });
      const preIncrementGeneration = updatedUser.generation - 1;
      const task = await tx.authRevocationTask.create({
        data: {
          userId,
          generation: preIncrementGeneration,
        },
      });
      taskId = task.id;
      taskCreatedAt = task.createdAt;
      taskGeneration = preIncrementGeneration;
    });

    try {
      if (sessionId) {
        await this.redisService
          .delete(`${REDIS_SESSION_PREFIX}${sessionId}`)
          .catch(() => undefined);
      }
      await this.revokeSessionsWithRetry(userId, taskCreatedAt, taskGeneration);
      if (taskId) {
        await this.prisma.authRevocationTask
          .delete({ where: { id: taskId } })
          .catch(() => undefined);
      }
    } catch (error) {
      this.logger.error(
        `Failed to revoke sessions / publish revocation for user ${userId} during deactivateAccount (persisted for worker retry)`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Отзывает все активные сессии пользователя с повторными попытками.
   */
  private async revokeSessionsWithRetry(
    userId: string,
    maxCreatedAt?: Date | string,
    maxGeneration?: number,
    retries = 3,
    delayMs = 50,
  ): Promise<void> {
    await revokeUserSessionsWithRetry(
      {
        redisService: this.redisService,
        authSessionService: this.authSessionService,
      },
      userId,
      maxCreatedAt,
      maxGeneration,
      retries,
      delayMs,
    );
  }

  /**
   * Восстанавливает деактивированный аккаунт в течение 30 дней.
   *
   * @param userId - UUID пользователя.
   * @returns Восстановленный профиль.
   * @throws {NotFoundException} Если пользователь не найден.
   * @throws {GoneException} Если прошло более 30 дней с момента удаления.
   */
  async restoreAccount(userId: string): Promise<UserProfileDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (!user.deletedAt) {
      return this.getProfile(userId);
    }

    const elapsedMs = Date.now() - user.deletedAt.getTime();
    if (elapsedMs > GRACE_PERIOD_MS) {
      throw new GoneException(
        "Account deletion period (30 days) has expired and cannot be restored",
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
      select: USER_PROFILE_SELECT,
    });

    return this.mapToUserProfile(updated);
  }

  /**
   * Получает публичный профиль пользователя по ID или уникальному username.
   * Деактивированные аккаунты не возвращаются (404).
   *
   * @param idOrUsername - UUID или username.
   * @returns Публичный DTO профиля.
   * @throws {NotFoundException} Если пользователь не найден или удален.
   */
  async getPublicProfile(idOrUsername: string): Promise<PublicUserProfileDto> {
    const isUuid = UUID_REGEX.test(idOrUsername);

    const user = await this.prisma.user.findFirst({
      where: {
        ...(isUuid ? { id: idOrUsername } : { username: idOrUsername }),
        deletedAt: null,
      },
      select: PUBLIC_PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return this.mapToPublicUserProfile(user);
  }

  /**
   * Преобразует выборку пользователя Prisma в полный UserProfileDto с ISO-строками дат.
   */
  private mapToUserProfile(
    profile: Prisma.UserGetPayload<{ select: typeof USER_PROFILE_SELECT }>,
  ): UserProfileDto {
    return {
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
      telegramUsername: profile.telegramUsername,
      telegramLinkVerified: profile.telegramLinkVerified ?? false,
      gitUrl: profile.gitUrl,
      githubLinkVerified: Boolean(profile.githubId),
      theme: (profile.theme?.toLowerCase() ?? "dark") as ThemeMode,
      locale: (profile.locale === "en" ? "en" : "ru") as Locale,
      timezone: profile.timezone,
      createdAt:
        typeof profile.createdAt === "string"
          ? profile.createdAt
          : profile.createdAt.toISOString(),
      updatedAt:
        typeof profile.updatedAt === "string"
          ? profile.updatedAt
          : profile.updatedAt.toISOString(),
      role: profile.role?.slug ?? SystemRole.USER,
      permissions: (
        profile.role?.permissions ?? SystemPermission.NONE
      ).toString(),
      onboardingCompleted: profile.onboardingCompleted ?? false,
      targetRole: profile.targetRole ?? null,
      targetLevel: profile.targetLevel ?? null,
      targetCompanies: profile.targetCompanies ?? [],
      targetTimeline: profile.targetTimeline ?? null,
      preferredFormat: profile.preferredFormat ?? null,
      onboardingAt: profile.onboardingAt
        ? typeof profile.onboardingAt === "string"
          ? profile.onboardingAt
          : profile.onboardingAt.toISOString()
        : null,
    };
  }

  /**
   * Сохраняет цели подготовки и помечает онбординг как завершенный.
   */
  async completeOnboarding(
    userId: string,
    dto: CompleteOnboardingDto,
  ): Promise<UserProfileDto> {
    const existing = await this.findById(userId);
    if (!existing) {
      throw new NotFoundException("User not found");
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        ...(dto.isSkipped
          ? {}
          : {
              targetRole: dto.role ?? null,
              targetLevel: dto.level ?? null,
              targetCompanies: dto.companies ?? [],
              targetTimeline: dto.timeline ?? null,
              preferredFormat: dto.format ?? null,
            }),
        onboardingAt: new Date(),
      },
      select: USER_PROFILE_SELECT,
    });

    this.logger.log(
      `User ${userId} completed onboarding: role=${dto.role ?? "none"}, level=${dto.level ?? "none"}, skipped=${dto.isSkipped}`,
    );

    await this.invalidateReadinessCache(userId);

    return this.mapToUserProfile(user);
  }

  /**
   * Преобразует выборку публичного профиля Prisma в PublicUserProfileDto с ISO-строкой даты.
   */
  private mapToPublicUserProfile(
    user: Prisma.UserGetPayload<{ select: typeof PUBLIC_PROFILE_SELECT }>,
  ): PublicUserProfileDto {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      telegramUsername: user.telegramUsername,
      gitUrl: user.gitUrl,
      createdAt:
        typeof user.createdAt === "string"
          ? user.createdAt
          : user.createdAt.toISOString(),
    };
  }
}
