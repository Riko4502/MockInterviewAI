import "multer";
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PublicUserProfileDto,
  UpdateProfileDto,
  UserProfileDto,
} from "@packages/dto";
import type { User } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { StorageService } from "../storage/storage.service";

/** Регулярное выражение для проверки UUID v4 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 30 дней в миллисекундах (период на восстановление аккаунта) */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/** Селектор полей для полного профиля пользователя (без passwordHash) */
const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  telegramUsername: true,
  gitUrl: true,
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
 * Предоставляет поиск по email, id и username, создание пользователя,
 * обновление хеша пароля и управление профилями (§9, §10 SPEC.md).
 * Работает уже с захешированным паролем — хеширование
 * является ответственностью вызывающего модуля (AuthService).
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly redisService: RedisService,
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
   * Ищет пользователя по email.
   *
   * @param email - Нормализованный email (lowercase).
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
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
   * Создаёт нового пользователя.
   *
   * @param data - Обязательные поля: `email` (нормализованный), `passwordHash` (Argon2id).
   * @returns Созданный объект пользователя.
   */
  async create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data });
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

    return profile;
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
      },
      select: USER_PROFILE_SELECT,
    });

    return updated;
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    // Отзываем текущую сессию в Redis
    if (sessionId) {
      await this.redisService.delete(`auth:session:${sessionId}`);
    }

    // Оповещаем Realtime WebSocket сервис через Pub/Sub о блокировке/деактивации
    try {
      await this.redisService.publish(
        "auth:revocations",
        JSON.stringify({ userId, reason: "account_deactivated" }),
      );
    } catch {
      // Игнорируем ошибку публикации, если realtime сервис не слушает
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

    return updated;
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

    return user;
  }
}
