import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MatchRequestStatus } from "../../generated/prisma/enums";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import {
  MATCHMAKING_EXPIRY_LOCK_KEY,
  MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
} from "./matchmaking.constants";

/**
 * Результат выполнения крон-задачи очистки просроченных заявок.
 */
export interface MatchmakingCronResult {
  expired: number;
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
    // 1. Захват Distributed Lock в Redis
    const lockAcquired = await this.redisService.setNx(
      MATCHMAKING_EXPIRY_LOCK_KEY,
      new Date().toISOString(),
      MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
    );

    if (!lockAcquired) {
      this.logger.debug(
        "Matchmaking expiry cron job is already running on another instance, skipping...",
      );
      return { expired: 0 };
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
      return { expired: 0 };
    } finally {
      // 3. Гарантированное освобождение распределенного лока
      await this.redisService.delete(MATCHMAKING_EXPIRY_LOCK_KEY);
    }
  }

  /**
   * Атомарный пакетный перевод просроченных заявок в статус EXPIRED.
   *
   * Использует updateMany для эффективного выполнения без N+1 запросов:
   * Находит все записи с status = PENDING и expiresAt <= now().
   *
   * @returns Количество переведённых в статус EXPIRED заявок.
   */
  async processExpiredRequests(): Promise<MatchmakingCronResult> {
    const now = new Date();

    const expiredResult = await this.prisma.matchRequest.updateMany({
      where: {
        status: MatchRequestStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: {
        status: MatchRequestStatus.EXPIRED,
      },
    });

    return {
      expired: expiredResult.count,
    };
  }
}
