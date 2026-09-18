import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateMatchRequestDto,
  MatchRequestQueryDto,
  MatchRequestResponseDto,
  PaginatedResponseDto,
  RejectMatchRequestDto,
  ShowcaseCardResponseDto,
  UnreadMatchRequestsCountDto,
} from "@packages/dto";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { PUBLIC_USER_SELECT } from "../showcase/showcase.constants";
import {
  MATCHMAKING_LIMITS,
  REDIS_MATCHMAKING_EVENTS_CHANNEL,
} from "./matchmaking.constants";

/**
 * Внутренняя структура выборки заявки из базы данных с авторами и карточками.
 */
const MATCH_REQUEST_INCLUDE = {
  sender: {
    select: PUBLIC_USER_SELECT,
  },
  receiver: {
    select: PUBLIC_USER_SELECT,
  },
  targetCard: {
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
    },
  },
  senderCard: {
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
    },
  },
} as const;

type MatchRequestWithRelations = Prisma.MatchRequestGetPayload<{
  include: typeof MATCH_REQUEST_INCLUDE;
}>;

@Injectable()
export class MatchmakingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Получение количества непрочитанных (ожидающих ответа) входящих заявок.
   *
   * Используется для отображения бейджа со счётчиком в шапке сайта и в колокольчике.
   * Считаются только заявки в статусе PENDING, адресованные текущему пользователю.
   *
   * @param userId - ID текущего авторизованного пользователя
   * @returns Объект с числом входящих заявок в ожидании
   */
  async getUnreadCount(userId: string): Promise<UnreadMatchRequestsCountDto> {
    // 1. Считаем количество входящих заявок в статусе PENDING
    const pendingCount = await this.prisma.matchRequest.count({
      where: {
        receiverId: userId,
        status: "PENDING",
      },
    });

    // 2. Возвращаем структурированный ответ для бейджа интерфейса
    return { pendingCount };
  }

  /**
   * Отправка заявки (отклика) на карточку собеседования с витрины.
   *
   * Выполняет 7 строгих бизнес-проверок:
   * 1. Профиль автора отклика должен быть заполнен (имя >= 2 символов, username).
   * 2. Целевая карточка витрины должна существовать, быть активной (ACTIVE) и не просроченной.
   * 3. Запрет отклика на собственную карточку (self-invite).
   * 4. Если прикреплена своя карточка (senderCardId) — проверка авторства, активности и срока.
   * 5. Лимит входящих заявок на целевую карточку (не более 10 в статусе PENDING).
   * 6. Лимит исходящих заявок от автора (не более 5 в статусе PENDING, ошибка 429 TooManyRequests).
   * 7. Кулдаун после отклонения (нельзя откликаться 24 часа после предыдущего REJECTED).
   * 8. Логика авто-матча (Cross-invite): если получатель уже отправлял заявку автору,
   *    обе заявки сразу переходят в ACCEPTED и публикуется событие в Redis Pub/Sub.
   *
   * @param senderId - ID отправителя отклика
   * @param dto - Данные заявки (целевая карточка, своя карточка, сообщение, тема)
   * @returns Созданная заявка
   */
  async create(
    senderId: string,
    dto: CreateMatchRequestDto,
  ): Promise<MatchRequestResponseDto> {
    // 1. Проверяем заполненность профиля отправителя
    const senderUser = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: PUBLIC_USER_SELECT,
    });

    if (!senderUser) {
      throw new NotFoundException("Пользователь не найден");
    }

    if (
      !senderUser.displayName ||
      senderUser.displayName.trim().length < 2 ||
      !senderUser.username
    ) {
      throw new BadRequestException(
        "Для отправки заявки заполните профиль: имя (от 2 символов) и никнейм (@username)",
      );
    }

    // 2. Ищем целевую карточку витрины и проверяем её валидность
    const targetCard = await this.prisma.showcaseCard.findUnique({
      where: { id: dto.targetCardId },
      select: {
        id: true,
        userId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (
      !targetCard ||
      targetCard.status !== "ACTIVE" ||
      new Date(targetCard.expiresAt).getTime() <= Date.now()
    ) {
      throw new NotFoundException("Карточка витрины не найдена или не активна");
    }

    // 3. Запрещаем отклик на собственную карточку (self-invite)
    if (targetCard.userId === senderId) {
      throw new BadRequestException(
        "Нельзя отправить заявку на собственную карточку",
      );
    }

    // 4. Если отправитель прикрепил свою карточку — проверяем её принадлежность и активность
    if (dto.senderCardId) {
      const senderCard = await this.prisma.showcaseCard.findUnique({
        where: { id: dto.senderCardId },
        select: {
          id: true,
          userId: true,
          status: true,
          expiresAt: true,
        },
      });

      if (!senderCard || senderCard.userId !== senderId) {
        throw new ForbiddenException(
          "Указанная карточка отправителя вам не принадлежит",
        );
      }

      if (
        senderCard.status !== "ACTIVE" ||
        new Date(senderCard.expiresAt).getTime() <= Date.now()
      ) {
        throw new BadRequestException(
          "Прикрепленная карточка отправителя не активна или просрочена",
        );
      }
    }

    // 5. Проверяем лимит входящих заявок на карточку получателя (максимум 10 PENDING)
    const incomingPendingCount = await this.prisma.matchRequest.count({
      where: {
        targetCardId: dto.targetCardId,
        status: "PENDING",
      },
    });

    if (
      incomingPendingCount >= MATCHMAKING_LIMITS.MAX_PENDING_INCOMING_PER_CARD
    ) {
      throw new BadRequestException(
        `На данную карточку достигнут лимит входящих заявок (максимум ${MATCHMAKING_LIMITS.MAX_PENDING_INCOMING_PER_CARD})`,
      );
    }

    // 6. Проверяем лимит исходящих заявок от автора (максимум 5 PENDING -> 429 Too Many Requests)
    const outgoingPendingCount = await this.prisma.matchRequest.count({
      where: {
        senderId,
        status: "PENDING",
      },
    });

    if (
      outgoingPendingCount >= MATCHMAKING_LIMITS.MAX_PENDING_OUTGOING_PER_USER
    ) {
      throw new HttpException(
        `Превышен лимит активных исходящих заявок (максимум ${MATCHMAKING_LIMITS.MAX_PENDING_OUTGOING_PER_USER})`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 7. Проверяем 24-часовой кулдаун после предыдущего отклонения (REJECTED) от этого же адресата
    const cooldownLimitDate = new Date(
      Date.now() - MATCHMAKING_LIMITS.REJECT_COOLDOWN_HOURS * 60 * 60 * 1000,
    );

    const recentRejection = await this.prisma.matchRequest.findFirst({
      where: {
        senderId,
        receiverId: targetCard.userId,
        status: "REJECTED",
        updatedAt: { gt: cooldownLimitDate },
      },
      select: { id: true },
    });

    if (recentRejection) {
      throw new BadRequestException(
        `Вы не можете отправить заявку этому пользователю в течение ${MATCHMAKING_LIMITS.REJECT_COOLDOWN_HOURS} часов после предыдущего отклонения`,
      );
    }

    // 8. Проверяем наличие встречной заявки (Cross-invite -> Auto-match)
    const crossRequest = await this.prisma.matchRequest.findFirst({
      where: {
        senderId: targetCard.userId,
        receiverId: senderId,
        status: "PENDING",
      },
      include: MATCH_REQUEST_INCLUDE,
    });

    // Срок жизни новой заявки (текущее время + 72 часа)
    const expiresAt = new Date(
      Date.now() + MATCHMAKING_LIMITS.REQUEST_TTL_HOURS * 60 * 60 * 1000,
    );

    // Если есть встречная заявка — оформляем взаимный Auto-Match
    if (crossRequest) {
      const createdRequest = await this.prisma.$transaction(async (tx) => {
        // Создаём текущую заявку сразу в статусе ACCEPTED
        const newRequest = await tx.matchRequest.create({
          data: {
            senderId,
            receiverId: targetCard.userId,
            targetCardId: dto.targetCardId,
            senderCardId: dto.senderCardId,
            message: dto.message,
            preferredTopic: dto.preferredTopic,
            status: "ACCEPTED",
            expiresAt,
          },
          include: MATCH_REQUEST_INCLUDE,
        });

        // Переводим встречную заявку также в статус ACCEPTED
        await tx.matchRequest.update({
          where: { id: crossRequest.id },
          data: { status: "ACCEPTED" },
        });

        return newRequest;
      });

      // Публикуем событие авто-матчинга в Redis Pub/Sub для уведомлений
      await this.publishMatchAcceptedEvent(createdRequest);

      return this.formatMatchRequest(createdRequest);
    }

    // Если встречной заявки нет — создаем обычную заявку в статусе PENDING
    const createdRequest = await this.prisma.matchRequest.create({
      data: {
        senderId,
        receiverId: targetCard.userId,
        targetCardId: dto.targetCardId,
        senderCardId: dto.senderCardId,
        message: dto.message,
        preferredTopic: dto.preferredTopic,
        status: "PENDING",
        expiresAt,
      },
      include: MATCH_REQUEST_INCLUDE,
    });

    return this.formatMatchRequest(createdRequest);
  }

  /**
   * Получение списка входящих заявок для текущего пользователя.
   *
   * Правила и особенности:
   * - Фильтрует заявки, где receiverId === userId.
   * - Опционально фильтрует по статусу (PENDING, ACCEPTED, REJECTED...).
   * - Сортировка: от новых к старым (createdAt desc).
   * - Контакты (telegramUsername) раскрываются только если статус заявки ACCEPTED.
   *
   * @param userId - ID получателя заявок
   * @param query - Параметры пагинации и фильтрации
   * @returns Пагинированный список входящих заявок
   */
  async findIncoming(
    userId: string,
    query: MatchRequestQueryDto,
  ): Promise<PaginatedResponseDto<MatchRequestResponseDto>> {
    // 1. Формируем условия поиска для входящих заявок
    const where: Prisma.MatchRequestWhereInput = {
      receiverId: userId,
      ...(query.status && { status: query.status }),
    };

    // 2. Расчет смещения пагинации
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // 3. Загружаем общее число записей и срез данных параллельно
    const [total, items] = await Promise.all([
      this.prisma.matchRequest.count({ where }),
      this.prisma.matchRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: MATCH_REQUEST_INCLUDE,
      }),
    ]);

    // 4. Форматируем заявки с защитой контактных данных
    const data = items.map((item) => this.formatMatchRequest(item));
    const totalPages = Math.ceil(total / limit);

    // 5. Возвращаем пагинированную структуру
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Получение списка исходящих заявок текущего пользователя.
   *
   * Правила и особенности:
   * - Фильтрует заявки, где senderId === userId.
   * - Опционально фильтрует по статусу (PENDING, ACCEPTED, CANCELLED...).
   * - Сортировка: от новых к старым (createdAt desc).
   * - Контакты (telegramUsername) раскрываются только если статус заявки ACCEPTED.
   *
   * @param userId - ID отправителя заявок
   * @param query - Параметры пагинации и фильтрации
   * @returns Пагинированный список исходящих заявок
   */
  async findOutgoing(
    userId: string,
    query: MatchRequestQueryDto,
  ): Promise<PaginatedResponseDto<MatchRequestResponseDto>> {
    // 1. Формируем условия поиска для исходящих заявок
    const where: Prisma.MatchRequestWhereInput = {
      senderId: userId,
      ...(query.status && { status: query.status }),
    };

    // 2. Расчет смещения пагинации
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // 3. Загружаем общее число записей и срез данных параллельно
    const [total, items] = await Promise.all([
      this.prisma.matchRequest.count({ where }),
      this.prisma.matchRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: MATCH_REQUEST_INCLUDE,
      }),
    ]);

    // 4. Форматируем заявки с защитой контактных данных
    const data = items.map((item) => this.formatMatchRequest(item));
    const totalPages = Math.ceil(total / limit);

    // 5. Возвращаем пагинированную структуру
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Принятие входящей заявки на мок-интервью (PENDING -> ACCEPTED).
   *
   * Правила и проверки:
   * - Принять заявку может только её прямой адресат (receiverId).
   * - Заявка должна находиться строго в статусе PENDING.
   * - Если срок жизни заявки истёк (expiresAt <= now) — переводит в EXPIRED и отклоняет операцию.
   * - Публикует событие match.accepted в Redis Pub/Sub канал matchmaking:events.
   * - Раскрывает контактные данные (telegramUsername) обоим участникам.
   *
   * @param requestId - ID заявки
   * @param userId - ID текущего пользователя (получателя)
   * @returns Обновленная принятая заявка с открытыми контактами
   */
  async accept(
    requestId: string,
    userId: string,
  ): Promise<MatchRequestResponseDto> {
    // 1. Ищем заявку по ID
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        receiverId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!request) {
      throw new NotFoundException("Заявка не найдена");
    }

    // 2. Проверяем права: только получатель может принять заявку
    if (request.receiverId !== userId) {
      throw new ForbiddenException("Вы не можете принять чужую заявку");
    }

    // 3. Проверяем статус: принимать можно только ожидающую заявку
    if (request.status !== "PENDING") {
      throw new BadRequestException(
        "Можно принять только заявку в статусе ожидания (PENDING)",
      );
    }

    // 4. Проверяем, не истек ли срок действия заявки
    if (new Date(request.expiresAt).getTime() <= Date.now()) {
      await this.prisma.matchRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });

      throw new BadRequestException("Срок действия заявки истек");
    }

    // 5. Переводим статус в ACCEPTED
    const updated = await this.prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
      include: MATCH_REQUEST_INCLUDE,
    });

    // 6. Публикуем событие подтверждения матча в Redis Pub/Sub
    await this.publishMatchAcceptedEvent(updated);

    // 7. Возвращаем заявку с открытыми контактами
    return this.formatMatchRequest(updated);
  }

  /**
   * Отклонение входящей заявки (PENDING -> REJECTED).
   *
   * Правила и проверки:
   * - Отклонить заявку может только её адресат (receiverId).
   * - Заявка должна быть в статусе PENDING.
   * - Опционально сохраняется вежливая причина отказа (rejectReason).
   * - Начиная с момента отклонения для отправителя начинает действовать 24-часовой кулдаун.
   *
   * @param requestId - ID заявки
   * @param userId - ID текущего пользователя (получателя)
   * @param dto - Причина отклонения
   * @returns Обновленная отклоненная заявка
   */
  async reject(
    requestId: string,
    userId: string,
    dto: RejectMatchRequestDto,
  ): Promise<MatchRequestResponseDto> {
    // 1. Ищем заявку по ID
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        receiverId: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException("Заявка не найдена");
    }

    // 2. Проверяем права: только получатель может отклонить заявку
    if (request.receiverId !== userId) {
      throw new ForbiddenException("Вы не можете отклонить чужую заявку");
    }

    // 3. Проверяем статус: отклонять можно только ожидающую заявку
    if (request.status !== "PENDING") {
      throw new BadRequestException(
        "Можно отклонить только заявку в статусе ожидания (PENDING)",
      );
    }

    // 4. Обновляем статус на REJECTED и фиксируем причину
    const updated = await this.prisma.matchRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectReason: dto.reason ?? null,
      },
      include: MATCH_REQUEST_INCLUDE,
    });

    return this.formatMatchRequest(updated);
  }

  /**
   * Отмена исходящей заявки отправителем (PENDING -> CANCELLED).
   *
   * Правила и проверки:
   * - Отменить заявку может только её инициатор (senderId).
   * - Заявка должна быть в статусе PENDING.
   *
   * @param requestId - ID заявки
   * @param userId - ID отправителя
   * @returns Обновленная отмененная заявка
   */
  async cancel(
    requestId: string,
    userId: string,
  ): Promise<MatchRequestResponseDto> {
    // 1. Ищем заявку по ID
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        senderId: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundException("Заявка не найдена");
    }

    // 2. Проверяем права: только автор отклика может отменить заявку
    if (request.senderId !== userId) {
      throw new ForbiddenException(
        "Вы можете отменить только свою исходящую заявку",
      );
    }

    // 3. Проверяем статус: отменить можно только ожидающую заявку
    if (request.status !== "PENDING") {
      throw new BadRequestException(
        "Можно отменить только заявку в статусе ожидания (PENDING)",
      );
    }

    // 4. Обновляем статус на CANCELLED
    const updated = await this.prisma.matchRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
      include: MATCH_REQUEST_INCLUDE,
    });

    return this.formatMatchRequest(updated);
  }

  /**
   * Публикация события подтверждения матча в шину событий Redis Pub/Sub.
   *
   * Уведомляет сервис уведомлений и сторонние realtime-обработчики о взаимном согласии.
   */
  private async publishMatchAcceptedEvent(
    request: MatchRequestWithRelations,
  ): Promise<void> {
    try {
      await this.redisService.publish(
        REDIS_MATCHMAKING_EVENTS_CHANNEL,
        JSON.stringify({
          event: "match.accepted",
          requestId: request.id,
          senderId: request.senderId,
          receiverId: request.receiverId,
          targetCardId: request.targetCardId,
          senderCardId: request.senderCardId,
          preferredTopic: request.preferredTopic,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch {
      // Игнорируем ошибки публикации шины, чтобы не прерывать транзакцию пользователя
    }
  }

  /**
   * Форматирование сущности заявки перед отправкой клиенту.
   *
   * Защита приватности:
   * - Если статус ACCEPTED: контакты (telegramUsername) остаются доступны обоим собеседникам.
   * - Если статус НЕ ACCEPTED: контакты маскируются (выставляются в null).
   * - В карточках витрины telegramUsername всегда скрыт согласно контракту каталога.
   */
  private formatMatchRequest(
    request: MatchRequestWithRelations,
  ): MatchRequestResponseDto {
    const isAccepted = request.status === "ACCEPTED";

    const formatCard = (
      card: MatchRequestWithRelations["targetCard"],
    ): ShowcaseCardResponseDto => {
      return {
        ...card,
        user: {
          ...card.user,
          telegramUsername: null,
        },
      };
    };

    return {
      id: request.id,
      senderId: request.senderId,
      receiverId: request.receiverId,
      sender: {
        ...request.sender,
        telegramUsername: isAccepted ? request.sender.telegramUsername : null,
      },
      receiver: {
        ...request.receiver,
        telegramUsername: isAccepted ? request.receiver.telegramUsername : null,
      },
      targetCard: formatCard(request.targetCard),
      senderCard: request.senderCard ? formatCard(request.senderCard) : null,
      status: request.status,
      message: request.message,
      preferredTopic: request.preferredTopic,
      rejectReason: request.rejectReason,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      expiresAt: request.expiresAt,
    };
  }
}
