import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  SecurityEventDto,
  UnseenSecurityEventsResponseDto,
} from "@packages/dto";
import type { Prisma } from "../../generated/prisma/client";
import { SecurityEventType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/** Параметры записи события безопасности. */
export interface RecordSecurityEventParams {
  userId: string;
  type: SecurityEventType;
  /** Транзакция вызывающего: аудит пишется вместе с изменением (ADR-005:95). */
  tx?: Prisma.TransactionClient;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

/**
 * Сервис аудита событий безопасности (ADR-005:90-95).
 *
 * `SecurityEvent` — не журнал «для отчётности», а носитель состояния доставки:
 * записанное событие обязано быть либо доставлено в push-канал, либо показано
 * in-app при следующем входе (D7, D8). Поэтому запись всегда идёт в одной
 * транзакции с изменением, которое она фиксирует.
 */
@Injectable()
export class SecurityEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записывает событие безопасности.
   *
   * @param params - Тип, пользователь, контекст (ip/ua) и опциональная транзакция.
   * @returns `{ id, createdAt }` созданного события.
   */
  async record(
    params: RecordSecurityEventParams,
  ): Promise<{ id: string; createdAt: Date }> {
    const client = params.tx ?? this.prisma;

    return client.securityEvent.create({
      data: {
        userId: params.userId,
        type: params.type,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        ...(params.metadata === undefined || params.metadata === null
          ? {}
          : { metadata: params.metadata }),
      },
      select: { id: true, createdAt: true },
    });
  }

  /**
   * Возвращает непросмотренные и недоставленные события пользователя.
   *
   * Это компенсирующий in-app-канал (D8): сюда попадает всё, что не ушло в
   * Telegram — недоставленное по сбою и то, для чего канала не было вовсе
   * (`TG_UNLINKED` после сброса `telegramChatId`). Доставленное в Telegram
   * повторно в приложении не показывается.
   */
  async getUnseen(userId: string): Promise<UnseenSecurityEventsResponseDto> {
    const events = await this.prisma.securityEvent.findMany({
      where: { userId, seenAt: null, notifiedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, type: true, createdAt: true },
    });

    const items: SecurityEventDto[] = events.map((event) => ({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt.toISOString(),
    }));

    return { items };
  }

  /**
   * Помечает событие просмотренным (D8).
   *
   * Повторная отметка идемпотентна: клиент может повторить запрос после
   * сетевого сбоя, и второй вызов не должен превращаться в `404`.
   *
   * @throws {NotFoundException} Событие не найдено или принадлежит другому пользователю.
   */
  async markSeen(userId: string, eventId: string): Promise<void> {
    const updated = await this.prisma.securityEvent.updateMany({
      where: { id: eventId, userId, seenAt: null },
      data: { seenAt: new Date() },
    });

    if (updated.count > 0) {
      return;
    }

    const exists = await this.prisma.securityEvent.count({
      where: { id: eventId, userId },
    });

    if (exists === 0) {
      throw new NotFoundException("Security event not found");
    }
  }
}
