import { Injectable } from "@nestjs/common";
import type { User } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Сервис управления пользователями (§9, §10 SPEC.md).
 *
 * Предоставляет поиск по email и по id, создание пользователя и обновление
 * хеша пароля. Работает уже с захешированным паролем — хеширование
 * является ответственностью вызывающего модуля (AuthService).
 */
@Injectable()
export class UsersService {
  /**
   * @param prisma - Глобальный `PrismaService` для доступа к PostgreSQL.
   */
  constructor(private readonly prisma: PrismaService) {}

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
   * Ищет пользователя по id.
   *
   * @param id - UUID пользователя.
   * @returns Объект пользователя или `null`, если не найден.
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Создаёт нового пользователя.
   *
   * @param data - Обязательные поля: `email` (нормализованный), `passwordHash` (Argon2id).
   * @returns Созданный объект пользователя.
   * @throws {Prisma.PrismaClientKnownRequestError} При нарушении уникальности email (P2002).
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
}
