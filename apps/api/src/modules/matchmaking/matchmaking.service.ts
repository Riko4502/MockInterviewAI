import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
import { MailService } from "../mail/mail.service";
import { NotificationDispatcher } from "../notifications/notification-dispatcher.service";
import {
  LiveMatchPostCommitError,
  SessionsService,
} from "../sessions/sessions.service";
import {
  CARD_SLOTS_INCLUDE,
  PUBLIC_USER_SELECT,
} from "../showcase/showcase.constants";
import { toShowcaseCardResponse } from "../showcase/showcase.mapper";
import {
  MATCHMAKING_LIMITS,
  REDIS_MATCHMAKING_EVENTS_CHANNEL,
} from "./matchmaking.constants";

/**
 * Внутренняя структура выборки заявки из базы данных с авторами и карточками.
 *
 * `slot` нужен клиенту, чтобы показать, какое время уже занято, а `sessionId` —
 * чтобы после `accept` открыть встречу одним запросом (ADR-002:62). Карточки
 * читаются со слотами тем же `CARD_SLOTS_INCLUDE`, что и в витрине, иначе
 * карточка в заявке и карточка в каталоге отвечали бы на разные вопросы.
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
      ...CARD_SLOTS_INCLUDE,
    },
  },
  senderCard: {
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
      ...CARD_SLOTS_INCLUDE,
    },
  },
  slot: {
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      status: true,
    },
  },
  session: true,
} as const;

type MatchRequestWithRelations = Prisma.MatchRequestGetPayload<{
  include: typeof MATCH_REQUEST_INCLUDE;
}>;

/**
 * Проекция слота для проверок перед заявкой.
 *
 * Отдельная константа, а не `CARD_SLOTS_INCLUDE`: витрине нужен весь набор
 * слотов карточки с сортировкой, а матчмейкингу — один конкретный слот и его
 * состояние, чтобы решить, резервировать его или отклонить запрос.
 */
const SLOT_SELECT = {
  id: true,
  startsAt: true,
  status: true,
} as const;

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationDispatcher: NotificationDispatcher,
    private readonly redisService: RedisService,
    private readonly sessionsService: SessionsService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
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
    // 1. Считаем количество входящих активных заявок в статусе PENDING (не просроченных)
    const pendingCount = await this.prisma.matchRequest.count({
      where: {
        receiverId: userId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    });

    // 2. Возвращаем структурированный ответ для бейджа интерфейса
    return { pendingCount };
  }

  /**
   * Отправка заявки (отклика) на карточку собеседования с витрины.
   *
   * Выполняет 8 строгих бизнес-проверок:
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
   * Слоты (ADR-002:62):
   * - Если у целевой карточки есть расписание, отклик обязан содержать `slotId`;
   * - слот резервируется атомарно в той же транзакции, что и сама заявка;
   * - повторный выбор слота обновляет существующую PENDING-заявку, а не создаёт вторую;
   * - авто-матч не выполняется, если слоты есть хотя бы у одной из сторон.
   *
   * @param senderId - ID отправителя отклика
   * @param dto - Данные заявки (целевая карточка, своя карточка, слот, сообщение, тема)
   * @returns Созданная или обновлённая заявка
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
    //    Слоты читаются здесь же: по их наличию определяется, обязателен ли
    //    `slotId`, и именно они проверяются перед тем, как клиент увидит 409
    //    на самом резервировании (ADR-002:62).
    const targetCard = await this.prisma.showcaseCard.findUnique({
      where: { id: dto.targetCardId },
      select: {
        id: true,
        userId: true,
        status: true,
        expiresAt: true,
        slots: { select: SLOT_SELECT },
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

    const now = new Date();
    // 4. Слот, если он есть, должен принадлежать целевой карточке и быть свободным
    const targetSlot = this.validateRequestedSlot(targetCard, dto.slotId, now);

    let senderCardHasSlots = false;

    // 5. Если отправитель прикрепил свою карточку — проверяем её принадлежность и активность
    if (dto.senderCardId) {
      const senderCard = await this.prisma.showcaseCard.findUnique({
        where: { id: dto.senderCardId },
        select: {
          id: true,
          userId: true,
          status: true,
          expiresAt: true,
          slots: { select: SLOT_SELECT },
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

      senderCardHasSlots = senderCard.slots.some(
        (slot) => slot.status !== "CANCELLED",
      );
    }

    // 6. Срок жизни новой заявки (текущее время + 72 часа)
    const expiresAt = new Date(
      now.getTime() + MATCHMAKING_LIMITS.REQUEST_TTL_HOURS * 60 * 60 * 1000,
    );

    // Слоты есть хотя бы у одной из сторон — авто-матч не выполняется: слот
    // является частью заявки, а в авто-матче он не выбирается, поэтому из
    // такой записи нельзя построить InterviewSession (ADR-002:109-111).
    const scheduleInvolved =
      targetSlot !== undefined ||
      senderCardHasSlots ||
      targetCard.slots.some((slot) => slot.status !== "CANCELLED");

    const MAX_RETRIES = 3;
    let retries = 0;

    while (true) {
      let createdLiveSessionId: string | null = null;
      try {
        const { createdRequest, isAutoMatch } = await this.prisma.$transaction(
          async (tx) => {
            // 7. Проверяем лимит входящих заявок на карточку получателя (максимум 10 PENDING)
            const incomingPendingCount = await tx.matchRequest.count({
              where: {
                targetCardId: dto.targetCardId,
                status: "PENDING",
              },
            });

            if (
              incomingPendingCount >=
              MATCHMAKING_LIMITS.MAX_PENDING_INCOMING_PER_CARD
            ) {
              throw new BadRequestException(
                `На данную карточку достигнут лимит входящих заявок (максимум ${MATCHMAKING_LIMITS.MAX_PENDING_INCOMING_PER_CARD})`,
              );
            }

            // 8. Проверяем лимит исходящих заявок от автора (максимум 5 PENDING -> 429 Too Many Requests)
            const outgoingPendingCount = await tx.matchRequest.count({
              where: {
                senderId,
                status: "PENDING",
              },
            });

            if (
              outgoingPendingCount >=
              MATCHMAKING_LIMITS.MAX_PENDING_OUTGOING_PER_USER
            ) {
              throw new HttpException(
                `Превышен лимит активных исходящих заявок (максимум ${MATCHMAKING_LIMITS.MAX_PENDING_OUTGOING_PER_USER})`,
                HttpStatus.TOO_MANY_REQUESTS,
              );
            }

            // 9. Проверяем 24-часовой кулдаун после предыдущего отклонения (REJECTED) от этого же адресата
            const cooldownLimitDate = new Date(
              now.getTime() -
                MATCHMAKING_LIMITS.REJECT_COOLDOWN_HOURS * 60 * 60 * 1000,
            );

            const recentRejection = await tx.matchRequest.findFirst({
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

            // 10. Повторный выбор слота обновляет существующую заявку, а не
            //     создаёт вторую: частичный уникальный индекс
            //     (senderId, targetCardId, status = PENDING) делает создание
            //     второй такой заявки невозможным в принципе (ADR-002:113-117).
            if (targetSlot) {
              const existingRequest = await tx.matchRequest.findFirst({
                where: {
                  senderId,
                  targetCardId: dto.targetCardId,
                  status: "PENDING",
                },
                include: MATCH_REQUEST_INCLUDE,
              });

              if (existingRequest) {
                const updatedRequest = await this.switchRequestSlot(
                  tx,
                  existingRequest,
                  targetSlot,
                );

                return { createdRequest: updatedRequest };
              }
            }

            // 11. Проверяем наличие встречной заявки (Cross-invite -> Auto-match)
            const crossRequest = scheduleInvolved
              ? null
              : await tx.matchRequest.findFirst({
                  where: {
                    senderId: targetCard.userId,
                    receiverId: senderId,
                    status: "PENDING",
                    expiresAt: { gt: now },
                  },
                  include: MATCH_REQUEST_INCLUDE,
                });

            // Если есть встречная заявка — оформляем взаимный Auto-Match
            if (crossRequest) {
              // 1. Создаем общую интерактивную сессию интервью для обоих участников
              const liveSession =
                await this.sessionsService.createLiveMatchSession(
                  crossRequest.senderId,
                  senderId,
                );
              createdLiveSessionId = liveSession.sessionId;

              // 2. Атомарно переводим встречную заявку в ACCEPTED с привязкой sessionId
              const updateResult = await tx.matchRequest.updateMany({
                where: {
                  id: crossRequest.id,
                  status: "PENDING",
                  expiresAt: { gt: now },
                },
                data: {
                  status: "ACCEPTED",
                  sessionId: liveSession.sessionId,
                },
              });

              // Если встречная заявка всё ещё была PENDING и успешно обновлена
              if (updateResult.count === 1) {
                // Создаём текущую заявку сразу в статусе ACCEPTED с той же сессией
                const newRequest = await tx.matchRequest.create({
                  data: {
                    senderId,
                    receiverId: targetCard.userId,
                    targetCardId: dto.targetCardId,
                    senderCardId: dto.senderCardId,
                    message: dto.message,
                    preferredTopic: dto.preferredTopic,
                    status: "ACCEPTED",
                    sessionId: liveSession.sessionId,
                    expiresAt,
                  },
                  include: MATCH_REQUEST_INCLUDE,
                });

                // Успешно сохранено — очистка не требуется
                createdLiveSessionId = null;
                return { createdRequest: newRequest, isAutoMatch: true };
              } else {
                // Встречная заявка больше не активна — очищаем созданную сессию
                await this.sessionsService.cleanupOrphanedSession(
                  liveSession.sessionId,
                );
                createdLiveSessionId = null;
              }
            }

            // Если встречной заявки нет — создаем обычную заявку в статусе PENDING
            const newRequest = await tx.matchRequest.create({
              data: {
                senderId,
                receiverId: targetCard.userId,
                targetCardId: dto.targetCardId,
                senderCardId: dto.senderCardId,
                slotId: targetSlot?.id,
                message: dto.message,
                preferredTopic: dto.preferredTopic,
                status: "PENDING",
                expiresAt,
              },
              include: MATCH_REQUEST_INCLUDE,
            });

            // 12. Резервируем слот: переход OPEN -> BOOKED выполняется только
            //     для действительно свободного слота, поэтому два отклика на
            //     одно и то же время не могут выиграть гонку (ADR-002:73).
            //     Заявка создана раньше, потому что `bookedByRequestId` ссылается
            //     на её id; при неудаче транзакция откатывает и заявку.
            if (targetSlot) {
              await this.claimSlot(tx, targetSlot.id, newRequest.id);
              await this.notifySlotProposed(
                tx,
                targetSlot,
                newRequest.id,
                // displayName уже проверен выше на непустоту, но TypeScript
                // не переносит это сужение внутрь замыкания транзакции.
                senderUser.displayName ?? "Кандидат",
                targetCard.userId,
              );
            }

            return { createdRequest: newRequest };
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );

        if (isAutoMatch) {
          // Публикуем событие подтверждения матча в Redis Pub/Sub (best-effort)
          await this.publishMatchAcceptedEvent(createdRequest);
        }

        return this.formatMatchRequest(createdRequest);
      } catch (error) {
        const orphanId =
          createdLiveSessionId ??
          (error instanceof LiveMatchPostCommitError ? error.sessionId : null);
        if (orphanId) {
          await this.sessionsService.cleanupOrphanedSession(orphanId);
          createdLiveSessionId = null;
        }

        // При конфликте сериализации параллельных транзакций (P2034) повторяем транзакцию
        if (
          (error instanceof Prisma.PrismaClientKnownRequestError ||
            (error instanceof Error && "code" in error)) &&
          (error as { code?: string }).code === "P2034"
        ) {
          if (retries < MAX_RETRIES) {
            retries++;
            continue;
          }
          throw new ConflictException(
            "Не удалось завершить операцию из-за высокой конкуренции параллельных запросов. Пожалуйста, повторите попытку.",
          );
        }

        this.handleUniqueConflict(
          error,
          "Вы уже отправили активную заявку на эту анкету",
        );
      }
    }
  }

  /**
   * Проверяет слот, присланный вместе с заявкой.
   *
   * Проверка вне транзакции — только чтобы отклонить заведомо негодный слот
   * (чужой карточки, отменённый, уже прошедший) с внятным сообщением. Само
   * резервирование внутри транзакции повторяет проверку `OPEN` через
   * `updateMany`: состояние слота между этими двумя точками может измениться,
   * и доверять прочитанному ранее значению нельзя (ADR-002:73).
   */
  private validateRequestedSlot(
    card: {
      id: string;
      expiresAt: Date;
      slots: {
        id: string;
        startsAt: Date;
        status: "OPEN" | "BOOKED" | "CANCELLED";
      }[];
    },
    slotId: string | undefined,
    now: Date,
  ):
    | { id: string; startsAt: Date; status: "OPEN" | "BOOKED" | "CANCELLED" }
    | undefined {
    // Отмена слотов не должна делать карточку «карточкой без расписания»:
    // ориентиром служат только те слоты, которые ещё показываются клиенту.
    const liveSlots = card.slots.filter((slot) => slot.status !== "CANCELLED");

    if (liveSlots.length > 0 && !slotId) {
      throw new BadRequestException(
        "Выберите слот в расписании карточки: заявка без слота не объясняет, о каком времени идёт речь",
      );
    }

    if (!slotId) {
      return undefined;
    }

    const slot = liveSlots.find((candidate) => candidate.id === slotId);

    if (!slot) {
      throw new BadRequestException(
        "Слот не найден в расписании этой карточки",
      );
    }

    if (slot.startsAt.getTime() <= now.getTime()) {
      throw new BadRequestException("Время слота уже прошло, выберите другое");
    }

    return slot;
  }

  /**
   * Переносит существующую PENDING-заявку на другой слот (ADR-002:115).
   *
   * Текст заявки сохраняется: клиент меняет время, а не содержание обращения.
   * Срок жизни обновляется, иначе заявка, созданная до выбора слота, могла бы
   * истечь сразу после резервирования.
   */
  private async switchRequestSlot(
    tx: Prisma.TransactionClient,
    request: MatchRequestWithRelations,
    slot: { id: string; startsAt: Date },
  ): Promise<MatchRequestWithRelations> {
    if (request.slotId === slot.id) {
      return request;
    }

    // Старый слот освобождается до резервирования нового: пока старый числится
    // BOOKED, exclusion constraint в БД считает новое пересечение конфликтом
    // даже после того, как клиент от него отказался.
    if (request.slotId) {
      await this.releaseSlot(tx, request.slotId, request.id);
    }

    await this.claimSlot(tx, slot.id, request.id);

    await this.notifySlotProposed(
      tx,
      slot,
      request.id,
      request.sender.displayName ?? "Кандидат",
      request.receiverId,
    );

    return tx.matchRequest.update({
      where: { id: request.id },
      data: {
        slotId: slot.id,
        expiresAt: new Date(
          Date.now() + MATCHMAKING_LIMITS.REQUEST_TTL_HOURS * 60 * 60 * 1000,
        ),
      },
      include: MATCH_REQUEST_INCLUDE,
    });
  }

  /**
   * Атомарно резервирует слот: OPEN -> BOOKED.
   *
   * `updateMany` с условием по статусу — это и есть проверка «свободен ли
   * слот», выполненная базой: `count === 0` означает, что параллельный отклик
   * занял его раньше (ADR-002:73).
   */
  private async claimSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
    requestId: string,
  ): Promise<void> {
    const claimed = await tx.availabilitySlot.updateMany({
      where: { id: slotId, status: "OPEN" },
      data: { status: "BOOKED", bookedByRequestId: requestId },
    });

    if (claimed.count === 0) {
      throw new ConflictException(
        "Выбранный слот уже занят. Выберите другое время.",
      );
    }
  }

  /**
   * Освобождает слот заявки: BOOKED -> OPEN.
   *
   * Условие по `bookedByRequestId` освобождает только тот слот, который
   * зарезервировала именно эта заявка: слот мог быть уже переназначен, и тогда
   * молчаливый `OPEN` отнял бы время у новой заявки.
   */
  private async releaseSlot(
    tx: Prisma.TransactionClient,
    slotId: string,
    requestId: string,
  ): Promise<void> {
    await tx.availabilitySlot.updateMany({
      where: { id: slotId, status: "BOOKED", bookedByRequestId: requestId },
      data: { status: "OPEN", bookedByRequestId: null },
    });
  }

  /**
   * Кладёт в outbox предложение встречи.
   *
   * Payload несёт `requestId`, а не `sessionId`: на этом шаге сессии ещё нет,
   * она создаётся на `accept` (ADR-002:62). Время уходит в UTC-инстанте,
   * потому что рендер выполняется в зоне читателя (ADR-002:55).
   */
  private async notifySlotProposed(
    tx: Prisma.TransactionClient,
    slot: { id: string; startsAt: Date },
    requestId: string,
    senderName: string,
    recipientId: string,
  ): Promise<void> {
    await this.notificationDispatcher.dispatch(
      {
        type: "interview.match_proposed",
        payload: {
          requestId,
          proposedSlotId: slot.id,
          proposedStartUtc: slot.startsAt.toISOString(),
          senderName,
        },
      },
      recipientId,
      tx,
      `/matchmaking/requests/${requestId}`,
    );
  }

  /**
   * Кладёт в outbox подтверждение брони слота обеим сторонам.
   *
   * Получатели различаются только именем другого участника, поэтому в payload
   * каждому уходит его собственное имя собеседника, а не общее «кто-то».
   */
  private async notifySlotBooked(
    tx: Prisma.TransactionClient,
    slot: { id: string; startsAt: Date },
    sessionId: string,
    sender: { id: string; name: string },
    receiver: { id: string; name: string },
  ): Promise<void> {
    const recipients = [
      { userId: sender.id, otherName: receiver.name },
      { userId: receiver.id, otherName: sender.name },
    ];

    for (const recipient of recipients) {
      await this.notificationDispatcher.dispatch(
        {
          type: "interview.slot_booked",
          payload: {
            sessionId,
            slotId: slot.id,
            startUtc: slot.startsAt.toISOString(),
            otherParticipantName: recipient.otherName,
          },
        },
        recipient.userId,
        tx,
        `/interviews/${sessionId}`,
      );
    }
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
   * - Если заявка занимает слот, в той же транзакции создаётся `InterviewSession`
   *   со `scheduledAt = slot.startsAt` и заявка связывается с ней (ADR-002:62).
   * - Бронь подтверждается уведомлением `interview.slot_booked` обеим сторонам;
   *   уведомление о записи в outbox происходит в той же транзакции, поэтому
   *   принятая заявка без уведомления невозможна (ADR-003:65-66).
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
    // 1. Ищем заявку по ID со слотом и визитками обеих сторон
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      include: MATCH_REQUEST_INCLUDE,
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
    const now = new Date();

    if (request.expiresAt.getTime() <= now.getTime()) {
      // Слот освобождается вместе с заявкой: иначе время, за которое никто не
      // придёт, осталось бы занятым до конца резервирования.
      await this.prisma.$transaction(async (tx) => {
        const expired = await tx.matchRequest.updateMany({
          where: { id: requestId, status: "PENDING" },
          data: { status: "EXPIRED" },
        });

        if (expired.count === 1 && request.slotId) {
          await this.releaseSlot(tx, request.slotId, request.id);
        }
      });

      throw new BadRequestException("Срок действия заявки истек");
    }

    // 5. Переводим статус в ACCEPTED, создаём сессию и подтверждаем бронь в одной
    //    транзакции: сессия без ACCEPTED и ACCEPTED без сессии — оба состояния
    //    означали бы, что встреча подтверждена, но встречи нет (ADR-002:62).
    const updated = await this.prisma.$transaction(
      async (tx) => {
        // 5.1. Атомарный переход: параллельный accept второго получателя
        //      проиграет на `count === 0`, а не создаст вторую сессию.
        const accepted = await tx.matchRequest.updateMany({
          where: { id: requestId, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });

        if (accepted.count === 0) {
          throw new BadRequestException(
            "Можно принять только заявку в статусе ожидания (PENDING)",
          );
        }

        // 5.2. Заявка без слота остаётся без сессии: это карточка, у которой
        //      расписание не задано, и создавать встречу «без времени» значило бы
        //      выдумать расписание, которого нет (ADR-002:62).
        if (!request.slot) {
          return tx.matchRequest.findUniqueOrThrow({
            where: { id: requestId },
            include: MATCH_REQUEST_INCLUDE,
          });
        }

        const slot = request.slot;

        if (slot.startsAt.getTime() <= now.getTime()) {
          throw new BadRequestException(
            "Время слота уже прошло, принять заявку невозможно",
          );
        }

        // Владелец карточки витрины — кандидат, отправитель заявки — интервьюер:
        // так же назначаются роли в мгновенном матче (`createLiveMatchSession`),
        // иначе одна и та же пара получила бы разные роли в двух сценариях.
        const session = await tx.interviewSession.create({
          data: {
            userId: request.targetCard.userId,
            status: "CREATED",
            scheduledAt: slot.startsAt,
            participants: {
              create: [
                {
                  userId: request.targetCard.userId,
                  role: "CANDIDATE",
                },
                {
                  userId: request.senderId,
                  role: "INTERVIEWER",
                },
              ],
            },
          },
        });

        await tx.matchRequest.update({
          where: { id: requestId },
          data: { sessionId: session.id },
        });

        await this.notifySlotBooked(
          tx,
          slot,
          session.id,
          {
            id: request.senderId,
            name: request.sender.displayName ?? "Собеседник",
          },
          {
            id: request.receiverId,
            name: request.receiver.displayName ?? "Собеседник",
          },
        );

        return tx.matchRequest.findUniqueOrThrow({
          where: { id: requestId },
          include: MATCH_REQUEST_INCLUDE,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // 6. Публикуем событие подтверждения матча в Redis Pub/Sub (best-effort)
    await this.publishMatchAcceptedEvent(updated);

    // 7. Отправляем email-уведомления обоим участникам
    if (updated.sessionId) {
      await this.sendMatchAcceptedEmails(updated, updated.sessionId);
    }

    // 8. Возвращаем заявку с открытыми контактами
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
   * - Занятый заявкой слот освобождается в той же транзакции: иначе отказ
   *   оставлял бы время в расписании занятым навсегда (ADR-002:62).
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
    // 1. Ищем заявку по ID вместе со ссылкой на занятый слот
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        receiverId: true,
        status: true,
        slotId: true,
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

    // 4. Обновляем статус на REJECTED атомарно, фиксируем причину и освобождаем слот
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.matchRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: "REJECTED",
          rejectReason: dto.reason ?? null,
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          "Можно отклонить только заявку в статусе ожидания (PENDING)",
        );
      }

      if (request.slotId) {
        await this.releaseSlot(tx, request.slotId, requestId);
      }

      return tx.matchRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: MATCH_REQUEST_INCLUDE,
      });
    });

    return this.formatMatchRequest(updated);
  }

  /**
   * Отмена исходящей заявки отправителем (PENDING -> CANCELLED).
   *
   * Правила и проверки:
   * - Отменить заявку может только её инициатор (senderId).
   * - Заявка должна быть в статусе PENDING.
   * - Занятый заявкой слот возвращается в расписание в той же транзакции
   *   (ADR-002:62): отмена без освобождения лишала бы карточку этого времени.
   *
   * @param requestId - ID заявки
   * @param userId - ID отправителя
   * @returns Обновленная отмененная заявка
   */
  async cancel(
    requestId: string,
    userId: string,
  ): Promise<MatchRequestResponseDto> {
    // 1. Ищем заявку по ID вместе со ссылкой на занятый слот
    const request = await this.prisma.matchRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        senderId: true,
        status: true,
        slotId: true,
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

    // 4. Обновляем статус на CANCELLED атомарно и освобождаем слот
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.matchRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          "Можно отменить только заявку в статусе ожидания (PENDING)",
        );
      }

      if (request.slotId) {
        await this.releaseSlot(tx, request.slotId, requestId);
      }

      return tx.matchRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: MATCH_REQUEST_INCLUDE,
      });
    });

    return this.formatMatchRequest(updated);
  }

  /**
   * Публикация события подтверждения матча в шину событий Redis Pub/Sub.
   *
   * Уведомляет сервис уведомлений и сторонние realtime-обработчики о взаимном согласии.
   * Best-effort: падение публикации не ломает бизнес-транзакцию.
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
          sessionId: request.sessionId,
          preferredTopic: request.preferredTopic,
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (error) {
      // Логируем ошибку для диагностики, сохраняя best-effort поведение без падения бизнес-транзакции
      this.logger.error(
        `Failed to publish match.accepted event for request ${request.id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
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
      return toShowcaseCardResponse({
        ...card,
        user: {
          ...card.user,
          telegramUsername: null,
        },
      });
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
      slot: request.slot
        ? {
            id: request.slot.id,
            startsAt: request.slot.startsAt.toISOString(),
            durationMinutes: request.slot.durationMinutes,
            status: request.slot.status,
          }
        : null,
      sessionId: request.sessionId,
      status: request.status,
      sessionStatus:
        request.session?.status || (request.sessionId ? "ACTIVE" : null),
      message: request.message,
      preferredTopic: request.preferredTopic,
      rejectReason: request.rejectReason,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
    };
  }

  /**
   * Перехватывает ошибку нарушения уникального индекса базы данных (Prisma P2002)
   * и преобразует её в понятный клиенту ConflictException (HTTP 409) для защиты от race condition.
   */
  private handleUniqueConflict(error: unknown, message: string): never {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError ||
        (error instanceof Error && "code" in error)) &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }

  /**
   * Отправляет email-уведомления обоим участникам при принятии заявки на интервью.
   */
  private async sendMatchAcceptedEmails(
    request: MatchRequestWithRelations,
    sessionId: string,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [request.senderId, request.receiverId] } },
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
        },
      });

      const sender = users.find((u) => u.id === request.senderId);
      const receiver = users.find((u) => u.id === request.receiverId);

      if (!sender || !receiver) {
        return;
      }

      if (!request.slot) {
        return;
      }

      const isProduction =
        this.configService.get<string>("env") === "production";
      const webUrl =
        this.configService.get<string>("webUrl") ??
        (isProduction ? "" : "http://localhost:3000");

      const roomUrl = `${webUrl}/dashboard/sandbox?room=${sessionId}`;
      const scheduledTime = request.slot.startsAt.toLocaleString("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
      });
      const topic = request.preferredTopic ?? "Тренировочное собеседование";

      await Promise.allSettled([
        this.mailService.sendTemplate({
          to: sender.email,
          template: "interview-scheduled",
          props: {
            username: sender.displayName || sender.username || "Пользователь",
            partnerName: receiver.displayName || receiver.username || "Партнер",
            scheduledTime,
            roomUrl,
            topic,
          },
        }),
        this.mailService.sendTemplate({
          to: receiver.email,
          template: "interview-scheduled",
          props: {
            username:
              receiver.displayName || receiver.username || "Пользователь",
            partnerName: sender.displayName || sender.username || "Партнер",
            scheduledTime,
            roomUrl,
            topic,
          },
        }),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to send match accepted emails for request ${request.id}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
