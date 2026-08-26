import {
  ConflictException,
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

/** Регулярное выражение для проверки UUID v4 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * Сервис управления пользователями и профилями.
 */
@Injectable()
export class UsersService {
  /**
   * @param prisma - Глобальный `PrismaService` для доступа к PostgreSQL.
   */
  constructor(private readonly prisma: PrismaService) {}

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
   * Проверяет уникальность username при его изменении.
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
   * Получает публичный профиль пользователя по ID или уникальному username.
   *
   * @param idOrUsername - UUID или username.
   * @returns Публичный DTO профиля.
   * @throws {NotFoundException} Если пользователь не найден.
   */
  async getPublicProfile(idOrUsername: string): Promise<PublicUserProfileDto> {
    const isUuid = UUID_REGEX.test(idOrUsername);

    const user = await this.prisma.user.findFirst({
      where: isUuid ? { id: idOrUsername } : { username: idOrUsername },
      select: PUBLIC_PROFILE_SELECT,
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }
}
