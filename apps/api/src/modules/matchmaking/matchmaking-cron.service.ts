import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "../../generated/prisma/client";
import {
  AvailabilitySlotStatus,
  MatchRequestStatus,
} from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  MATCHMAKING_CRON_MAX_RETRIES,
  MATCHMAKING_EXPIRY_LOCK_KEY,
  MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
} from "./matchmaking.constants";

/**
 * Конфликт сериализации Prisma: параллельная транзакция изменила те же строки.
 *
 * Проверяется и по классу ошибки, и по коду на объекте: обёртки провайдера
 * (пул соединений, прокси) иногда теряют прототип Prisma-ошибки, но код
 * доезжает, и молча перестав повторять означало бы тихо терять чистку.
 */
function isSerializationConflict(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError ||
      (error instanceof Error && "code" in error)) &&
    (error as { code?: string }).code === "P2034"
  );
}

/**
 * Результат выполнения крон-задачи очистки просроченных заявок.
 */
export interface MatchmakingCronResult {
  expired: number;
  /** Сколько слотов расписания вернулось из брони после истечения заявок. */
  slotsReleased: number;
}

/**
 * Фоновый крон-сервис для системы матчмейкинга.
 *
 * Запускается каждый час, захватывает распределённый Redis-лок и переводит заявки
 * со статусом PENDING и истёкшим сроком жизни (expiresAt <= now) в статус EXPIRED.
 */
@Injectable()
export class MatchmakingCronService {
  private readonly logger = new Logger(MatchmakingCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Точка входа фоновой задачи. Запускается каждый час.
   */
  @Cron("0 * * * *")
  async handleCron(): Promise<MatchmakingCronResult> {
    const lockToken = randomUUID();

    // 1. Захват Distributed Lock в Redis с уникальным токеном владельца
    const lockAcquired = await this.redisService.setNx(
      MATCHMAKING_EXPIRY_LOCK_KEY,
      lockToken,
      MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      this.logger.debug(
        "Matchmaking expiry cron job is already running on another instance, skipping...",
      );
      return { expired: 0, slotsReleased: 0 };
    }

    this.logger.log("Starting expired match requests check...");

    try {
      // 2. Обработка просроченных заявок
      const result = await this.processExpiredRequests();
      this.logger.log(
        `Matchmaking cron completed: ${result.expired} request(s) marked as expired.`,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Error during matchmaking expiry cron execution: ${String(err)}`,
      );
      return { expired: 0, slotsReleased: 0 };
    } finally {
      // 3. Безопасное атомарное освобождение распределенного лока только владельцем (safe unlock via Lua compare-and-delete)
      await this.redisService.compareAndDelete(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        lockToken,
      );
    }
  }

  /**
   * Атомарный перевод просроченных заявок в статус EXPIRED с освобождением слотов.
   *
   * Транзакция `Serializable` обязательна: список истекающих заявок читается
   * до обновления, и без сериализации параллельный `accept` мог бы успеть
   * перевести заявку в ACCEPTED между чтением и записью — тогда её слот
   * освободился бы, а InterviewSession осталась бы без времени (ADR-002:62).
   * Конкуренция вместо этого приводит к откату транзакции, а не к порче данных.
   *
   * @returns Количество переведённых в статус EXPIRED заявок и освобождённых слотов.
   */
  async processExpiredRequests(): Promise<MatchmakingCronResult> {
    // Конкуренция с accept вызывает откат сериализации, а не порчу данных, но
    // повтор не повредит: крон часовой, а без него просроченная заявка жила бы
    // до следующего тика, удерживая слот.
    for (let attempt = 0; attempt <= MATCHMAKING_CRON_MAX_RETRIES; attempt++) {
      try {
        return await this.expireRequestsOnce();
      } catch (error) {
        if (
          attempt === MATCHMAKING_CRON_MAX_RETRIES ||
          !isSerializationConflict(error)
        ) {
          throw error;
        }

        this.logger.debug(
          `Matchmaking expiry transaction conflicted, retry ${attempt + 1}/${MATCHMAKING_CRON_MAX_RETRIES}`,
        );
      }
    }

    // Цикл всегда возвращает значение или пробрасывает ошибку.
    return { expired: 0, slotsReleased: 0 };
  }

  private async expireRequestsOnce(): Promise<MatchmakingCronResult> {
    const now = new Date();

    return this.prisma.$transaction(
      async (tx) => {
        const expiring = await tx.matchRequest.findMany({
          where: {
            status: MatchRequestStatus.PENDING,
            expiresAt: { lte: now },
          },
          select: { id: true },
        });

        if (expiring.length === 0) {
          return { expired: 0, slotsReleased: 0 };
        }

        const expiringIds = expiring.map((request) => request.id);

        // Возвращаются именно те заявки, которые действительно перешли в
        // EXPIRED: по одному `count` нельзя определить, какие строки обновились,
        // а освобождать слот заявки, которую параллельно приняли, нельзя — у
        // принятой заявки уже есть InterviewSession, и молчаливый OPEN отнял бы
        // у встречи её время.
        const expired = await tx.matchRequest.updateManyAndReturn({
          where: {
            id: { in: expiringIds },
            status: MatchRequestStatus.PENDING,
          },
          data: { status: MatchRequestStatus.EXPIRED },
          select: { id: true },
        });

        if (expired.length === 0) {
          return { expired: 0, slotsReleased: 0 };
        }

        const expiredIds = expired.map((request) => request.id);

        const releasedResult = await tx.availabilitySlot.updateMany({
          where: {
            status: AvailabilitySlotStatus.BOOKED,
            bookedByRequestId: { in: expiredIds },
          },
          data: {
            status: AvailabilitySlotStatus.OPEN,
            bookedByRequestId: null,
          },
        });

        return {
          expired: expired.length,
          slotsReleased: releasedResult.count,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
