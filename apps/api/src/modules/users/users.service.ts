import "multer";
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type {
  DeviceSettingsDto,
  Locale,
  PublicUserProfileDto,
  ThemeMode,
  UpdateDeviceSettingsDto,
  UpdateProfileDto,
  UserProfileDto,
} from "@packages/dto";
import { SystemPermission, SystemRole } from "@packages/types";
import { publishUserRevocationOrThrow } from "../../common/pubsub/revocation";
import {
  type Prisma,
  type Role,
  ThemePreference,
  type User,
} from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { REDIS_SESSION_PREFIX } from "../auth/auth.constants";
import { AuthSessionService } from "../auth/services/auth-session.service";
import { StorageService } from "../storage/storage.service";

/** Регулярное выражение для проверки UUID v4 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 30 дней в миллисекундах (период на восстановление аккаунта) */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

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
  gitUrl: true,
  theme: true,
  locale: true,
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
  ) {}

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

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        ...(data.githubId ? { githubId: data.githubId } : {}),
        roleId: defaultRole.id,
      },
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

    return this.prisma.user.create({
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

    if (dto.username && dto.username !== existing.username) {
      const userWithSameUsername = await this.findByUsername(dto.username);
      if (userWithSameUsername && userWithSameUsername.id !== userId) {
        throw new ConflictException(
          `Username "${dto.username}" is already taken`,
        );
      }
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
        ...(dto.gitUrl !== undefined && { gitUrl: dto.gitUrl }),
        ...(dto.theme !== undefined && {
          theme: dto.theme.toUpperCase() as ThemePreference,
        }),
        ...(dto.locale !== undefined && { locale: dto.locale }),
      },
      select: USER_PROFILE_SELECT,
    });

    return this.mapToUserProfile(updated);
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

    return await this.prisma.$transaction(async (tx) => {
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
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.authSessionService.revokeAllUserSessions(
          userId,
          maxCreatedAt,
          maxGeneration,
        );
        await publishUserRevocationOrThrow(this.redisService, userId);
        return;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
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
      gitUrl: profile.gitUrl,
      theme: (profile.theme?.toLowerCase() ?? "dark") as ThemeMode,
      locale: (profile.locale === "en" ? "en" : "ru") as Locale,
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
    };
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
