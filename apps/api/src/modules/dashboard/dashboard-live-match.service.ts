import { Injectable, Logger } from "@nestjs/common";
import type {
  LiveMatchStatusResponseDto,
  LiveMatchToggleDto,
} from "@packages/dto";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class DashboardLiveMatchService {
  private readonly logger = new Logger(DashboardLiveMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Включение / отключение режима живого поиска напарника в реальном времени.
   */
  async toggleLiveMatch(
    userId: string,
    dto: LiveMatchToggleDto,
  ): Promise<LiveMatchStatusResponseDto> {
    const spec = dto.specialization ?? "FRONTEND";
    const level = dto.level ?? "MIDDLE";
    const queueKey = `live_queue:${spec}:${level}`;

    // Если пользователь отключает поиск — убираем его из очереди
    if (!dto.isSearching) {
      await this.redisService.srem(queueKey, userId);
      return { status: "IDLE" };
    }

    // Проверяем, есть ли уже ожидающий кандидат в очереди
    const partnerId = await this.redisService.spop(queueKey);

    if (partnerId && partnerId !== userId) {
      this.logger.log(
        `Live match found: ${userId} <-> ${partnerId} (${spec}/${level})`,
      );

      try {
        // Создаем активную сессию для двоих участников
        const session = await this.prisma.interviewSession.create({
          data: {
            userId,
            status: "ACTIVE",
            startedAt: new Date(),
            participants: {
              create: [
                { userId, role: "CANDIDATE" },
                { userId: partnerId, role: "INTERVIEWER" },
              ],
            },
          },
        });

        // Оповещаем второго участника через Redis Pub/Sub
        await this.redisService.publish(
          `live_match:notify:${partnerId}`,
          JSON.stringify({ sessionId: session.id }),
        );

        return {
          status: "MATCHED",
          sessionId: session.id,
        };
      } catch (error) {
        this.logger.error(
          `Failed to create live session: ${(error as Error).message}`,
        );
        // Возвращаем напарника обратно в очередь
        await this.redisService.sadd(queueKey, partnerId);
      }
    }

    // Если напарник не найден — добавляем себя в очередь с TTL 5 минут
    await this.redisService.sadd(queueKey, userId);
    await this.redisService.expire(queueKey, 300);

    return {
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    };
  }
}
