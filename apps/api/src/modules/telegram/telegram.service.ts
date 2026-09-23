import { createHash, randomBytes } from "node:crypto";
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  TelegramInterviewDto,
  TelegramInterviewsListDto,
  TelegramUserProfileDto,
} from "@packages/dto";
import type { Prisma } from "../../generated/prisma/client";
import {
  InterviewParticipantRole,
  InterviewSessionStatus,
} from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

const TELEGRAM_LINK_KEY_PREFIX = "tg:link:";

/** Строка таблицы users c подгруженной ролью (для сериализации профиля). */
type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

/**
 * Сервис интеграции с Telegram-ботом (`/api/v1/telegram/*`, §6–7
 * docs/TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * Отвечает за:
 * - генерацию одноразовых токенов привязки (`createLinkToken`);
 * - привязку/отвязку `telegramChatId` к пользователю (`link`, `unlink`);
 * - отдачу профиля и списка собеседований по `telegramChatId`
 *   (`getProfileByChatId`, `getInterviewsByChatId`);
 * - обновление сохранённой локали (`updatePreferences`).
 *
 * Одноразовый токен хранится в Redis **только как SHA-256 хеш**
 * (компрометация Redis не раскрывает raw-токен) и атомарно расходуется
 * через `GETDEL` (single-use, §13).
 */
@Injectable()
export class TelegramService {
  private readonly botUsername: string;
  private readonly linkTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    configService: ConfigService,
  ) {
    this.botUsername =
      configService.get<string>("telegram.botUsername") ?? "MockInterviewBot";
    this.linkTtlSeconds =
      configService.get<number>("telegram.linkTtlSeconds") ?? 900;
  }

  /**
   * Генерирует одноразовый токен привязки Telegram и ссылку `t.me/...?start=`.
   *
   * Raw-токен — `randomBytes(24).toString("hex")` (48 символов из набора
   * `[0-9a-f]`, допустимого для deep-link параметра `?start=`).
   * В Redis сохраняется только `sha256(rawToken)` с TTL.
   *
   * @param userId - UUID пользователя, инициировавшего привязку.
   * @returns `{ linkUrl }` — ссылка `https://t.me/{botUsername}?start={rawToken}`.
   */
  async createLinkToken(userId: string): Promise<{ linkUrl: string }> {
    const rawToken = randomBytes(24).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    await this.redis.set(
      `${TELEGRAM_LINK_KEY_PREFIX}${tokenHash}`,
      JSON.stringify({ userId }),
      this.linkTtlSeconds,
    );

    return {
      linkUrl: `https://t.me/${this.botUsername}?start=${rawToken}`,
    };
  }

  /**
   * Привязывает `telegramChatId` к пользователю по одноразовому токену.
   *
   * Атомарное чтение+удаление ключа (`GETDEL`) делает токен single-use:
   * повторное использование и истечение TTL → `410 Gone`. Уникальный индекс
   * `telegramChatId @unique` защищает от повторной привязки на уровне БД
   * (`P2002` → `409 Conflict`).
   *
   * Условный апдейт `where: { id, telegramChatId: null }` закрывает гонку
   * двух одновременных привязок одному пользователю из разных чатов:
   * второй апдейт обновит 0 строк и получит `409 Conflict`, а чат
   * с неуспешной привязкой не получит ложный успех (race-safe).
   *
   * @param token - Raw-токен из `/start <token>`.
   * @param chatId - Идентификатор Telegram-чата.
   * @returns Профиль пользователя после привязки.
   * @throws {GoneException} Токен не найден/истёк/использован или аккаунт удалён (410).
   * @throws {ConflictException} Чат уже привязан к аккаунту (409).
   */
  async link(token: string, chatId: string): Promise<TelegramUserProfileDto> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const value = await this.redis.getdel(
      `${TELEGRAM_LINK_KEY_PREFIX}${tokenHash}`,
    );

    if (!value) {
      throw new GoneException("Telegram link token is invalid or has expired");
    }

    let payload: { userId?: string } | null = null;
    try {
      payload = JSON.parse(value) as { userId?: string };
    } catch {
      throw new GoneException("Telegram link token is invalid or has expired");
    }

    if (!payload?.userId) {
      throw new GoneException("Telegram link token is invalid or has expired");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || user.deletedAt) {
      throw new GoneException("Account has been deleted");
    }

    if (user.telegramChatId) {
      throw new ConflictException("Telegram account is already linked");
    }

    let result: { count: number };
    try {
      result = await this.prisma.user.updateMany({
        where: { id: user.id, telegramChatId: null },
        data: { telegramChatId: chatId, telegramLocale: null },
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "P2002") {
        throw new ConflictException("Telegram chat is already linked");
      }
      throw error;
    }

    if (result.count === 0) {
      throw new ConflictException("Telegram account is already linked");
    }

    const updated = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });

    if (!updated || updated.deletedAt) {
      throw new GoneException("Account has been deleted");
    }

    return this.toProfileDto(updated);
  }

  /**
   * Отвязывает Telegram-чат от аккаунта (идемпотентно-безопасно).
   *
   * Вместе с `telegramChatId` очищается сохранённая локаль `telegramLocale` —
   * при следующей привязке локаль определяется заново (§10.2).
   *
   * @param chatId - Идентификатор Telegram-чата.
   * @throws {NotFoundException} Чат не привязан ни к одному аккаунту (404).
   */
  async unlink(chatId: string): Promise<{ success: true }> {
    const result = await this.prisma.user.updateMany({
      where: { telegramChatId: chatId },
      data: { telegramChatId: null, telegramLocale: null },
    });

    if (result.count === 0) {
      throw new NotFoundException("Telegram chat is not linked");
    }

    return { success: true };
  }

  /**
   * Возвращает профиль пользователя по `telegramChatId`.
   *
   * @param chatId - Идентификатор Telegram-чата.
   * @throws {NotFoundException} Пользователь с таким чатом не найден (404).
   */
  async getProfileByChatId(chatId: string): Promise<TelegramUserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { telegramChatId: chatId },
      include: { role: true },
    });

    if (!user || user.deletedAt) {
      throw new NotFoundException("User not found");
    }

    return this.toProfileDto(user);
  }

  /**
   * Возвращает предстоящие собеседования пользователя по `telegramChatId`
   * (владение или участие, статусы `CREATED`/`ACTIVE`, сортировка по
   * `createdAt: desc`, лимит 10).
   *
   * Роль: для владельца сессии — `INTERVIEWER`, иначе роль из
   * `InterviewParticipant` (§7.3).
   *
   * @param chatId - Идентификатор Telegram-чата.
   * @throws {NotFoundException} Пользователь с таким чатом не найден (404).
   */
  async getInterviewsByChatId(
    chatId: string,
  ): Promise<TelegramInterviewsListDto> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: chatId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const sessions = await this.prisma.interviewSession.findMany({
      where: {
        OR: [
          { userId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
        status: {
          in: [InterviewSessionStatus.CREATED, InterviewSessionStatus.ACTIVE],
        },
      },
      include: { participants: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      items: sessions.map((session): TelegramInterviewDto => {
        const isOwner = session.userId === user.id;
        const participant = session.participants.find(
          (p) => p.userId === user.id,
        );
        return {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          role:
            isOwner ||
            participant?.role === InterviewParticipantRole.INTERVIEWER
              ? "INTERVIEWER"
              : (participant?.role ?? InterviewParticipantRole.OBSERVER),
          createdAt: session.createdAt,
        };
      }),
    };
  }

  /**
   * Обновляет сохранённую локаль (`telegramLocale`) пользователя.
   *
   * @param chatId - Идентификатор Telegram-чата.
   * @param locale - Нормализованный код локали (`ru`/`en`), валидируется на уровне DTO.
   * @throws {NotFoundException} Пользователь с таким чатом не найден (404).
   */
  async updatePreferences(
    chatId: string,
    locale: "ru" | "en",
  ): Promise<TelegramUserProfileDto> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: chatId, deletedAt: null },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { telegramLocale: locale },
      include: { role: true },
    });

    return this.toProfileDto(updated);
  }

  /**
   * Сериализует пользователя в `TelegramUserProfileDto`.
   *
   * `telegramId`/`telegramChatId` — строки; `telegramLocale` нормализуется
   * к `ru`/`en` или `null`; роль — slug роли или fallback `USER`.
   */
  private toProfileDto(user: UserWithRole): TelegramUserProfileDto {
    const locale = user.telegramLocale;
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      telegramUsername: user.telegramUsername,
      telegramChatId: user.telegramChatId,
      telegramLocale: locale === "ru" || locale === "en" ? locale : null,
      role: user.role?.slug ?? "USER",
    };
  }
}
