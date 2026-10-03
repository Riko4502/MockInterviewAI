import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import {
  CreateShowcaseCardDto,
  MAX_SLOTS_PER_CARD,
  normalizeSkill,
  PaginatedResponseDto,
  parseSearchQuery,
  ShowcaseCardResponseDto,
  type ShowcaseCardStatsDto,
  ShowcaseQueryDto,
  sanitizeSearchTerm,
  UpdateShowcaseCardDto,
  UpdateShowcaseCardStatusDto,
} from "@packages/dto";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { type ResolvedSlot, resolveSlots } from "./availability-slots";
import {
  CARD_SLOTS_INCLUDE,
  PUBLIC_USER_SELECT,
  SHOWCASE_LIMITS,
  SURVIVING_SLOT_STATUS,
  slotIdentity,
} from "./showcase.constants";
import { toShowcaseCardResponse } from "./showcase.mapper";

/**
 * Слоты карточки целиком, без фильтра по статусу: пересборке расписания нужны и
 * `BOOKED`, и `CANCELLED`, а ответ клиенту собирается из тех же строк.
 */
type CardSlots = Prisma.ShowcaseCardGetPayload<{
  include: { slots: true };
}>["slots"];

@Injectable()
export class ShowcaseService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Инвалидирует кэш витрины и готовности пользователя на дашборде (TASK-BACK-45).
   */
  private async invalidateShowcaseCache(userId: string): Promise<void> {
    if (!this.redisService) return;
    try {
      await Promise.all([
        this.redisService.delete(`cache:dashboard:showcase:${userId}`),
        this.redisService.delete(`cache:dashboard:readiness:${userId}`),
      ]);
    } catch {
      // Игнорируем сетевые сбои кэша
    }
  }

  /**
   * Публикация новой анкеты на витрине.
   *
   * Правила и проверки:
   * - Профиль автора должен быть заполнен: имя (>= 2 символов) и никнейм (@username).
   * - Лимит: не более 5 активных анкет на одного пользователя.
   * - Уникальность: запрещено создавать дубликат активной анкеты с теми же специализацией и уровнем.
   * - Срок жизни: автоматически выставляется expiresAt на 15 дней вперед.
   * - Слоты расписания, если они присланы, пишутся в той же транзакции, что и
   *   карточка: иначе карточка осталась бы в каталоге без расписания, о котором
   *   клиент сообщил, что оно создано (ADR-002:104).
   */
  async create(
    userId: string,
    dto: CreateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Проверяем заполненность профиля автора
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      // Таймзона нужна для перевода слотов из локального времени в UTC
      select: { ...PUBLIC_USER_SELECT, timezone: true },
    });

    if (!user) {
      throw new NotFoundException("Пользователь не найден");
    }

    if (
      !user.displayName ||
      user.displayName.trim().length < 2 ||
      !user.username
    ) {
      throw new BadRequestException(
        "Для публикации анкеты на витрине заполните профиль: имя (от 2 символов) и никнейм (@username)",
      );
    }

    // 2. Вычисляем дату истечения срока жизни (текущее время + 15 дней)
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SHOWCASE_LIMITS.CARD_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // 3. Сохраняем новую анкету вместе со слотами в одной транзакции
    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          // 3.1. Лимит активных анкет (максимум 5 на пользователя)
          const activeCardsCount = await tx.showcaseCard.count({
            where: { userId, status: "ACTIVE" },
          });

          if (activeCardsCount >= SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER) {
            throw new BadRequestException(
              `Достигнут лимит активных анкет (максимум ${SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER})`,
            );
          }

          // 3.2. Запрет дубликата по специализации и уровню среди активных
          const existingActiveCard = await tx.showcaseCard.findFirst({
            where: {
              userId,
              specialization: dto.specialization,
              level: dto.level,
              status: "ACTIVE",
            },
            select: { id: true },
          });

          if (existingActiveCard) {
            throw new ConflictException(
              "У вас уже есть активная анкета с такой специализацией и уровнем",
            );
          }

          // 3.3. Анкета с публичными данными автора
          const card = await tx.showcaseCard.create({
            data: {
              userId,
              title: dto.title,
              specialization: dto.specialization,
              level: dto.level,
              language: dto.language,
              skills: dto.skills,
              bio: dto.bio,
              scheduleInfo: dto.scheduleInfo,
              isUrgent: dto.isUrgent,
              autoRenew: dto.autoRenew,
              expiresAt,
            },
            include: { user: { select: PUBLIC_USER_SELECT } },
          });

          // 3.4. Слоты расписания в зоне владельца
          const slots = dto.slots
            ? await this.createSlots(tx, card.id, dto.slots, {
                timeZone: user.timezone,
                now,
                cardExpiresAt: expiresAt,
              })
            : [];

          return { ...card, slots };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.invalidateShowcaseCache(userId);
      return toShowcaseCardResponse(created);
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException(
          "Не удалось сохранить анкету из-за высокой конкуренции параллельных запросов. Пожалуйста, повторите попытку.",
        );
      }

      this.handleUniqueConflict(
        error,
        "У вас уже есть активная анкета с такой специализацией и уровнем",
      );
    }
  }

  /**
   * Переводит слоты в UTC-инстанты и записывает их (ADR-002:65).
   *
   * Проверки живут в `resolveSlots`, запись — здесь: преобразование не должно
   * молча пройти, а сохранение не должно произойти без преобразования.
   */
  private async createSlots(
    tx: Prisma.TransactionClient,
    cardId: string,
    slots: CreateShowcaseCardDto["slots"],
    context: {
      timeZone: string;
      now: Date;
      cardExpiresAt: Date;
    },
  ) {
    const resolved = resolveSlots(slots ?? [], { ...context, existing: [] });

    // `createManyAndReturn` вместо `create` по одному: слотов максимум 10, а
    // одним запросом к базе меньше шансов, что часть вставки пройдёт мимо
    // `expiresAt`-проверки, если её придётся повторять.
    return tx.availabilitySlot.createManyAndReturn({
      data: resolved.map((slot) => this.slotCreateData(cardId, slot)),
    });
  }

  /** Данные слота для вставки; `endsAt` проверяется CHECK-ограничением в БД. */
  private slotCreateData(cardId: string, slot: ResolvedSlot) {
    return {
      cardId,
      startsAt: slot.startsAt,
      durationMinutes: slot.durationMinutes,
      endsAt: slot.endsAt,
    };
  }

  /**
   * Каталог витрины: поиск, фильтрация и пагинация активных карточек.
   *
   * Правила и особенности:
   * - Отображает только карточки в статусе ACTIVE.
   * - Исключает анкеты текущего авторизованного пользователя (currentUserId), чтобы не откликаться на себя.
   * - Поддерживает точные фильтры (specialization, level, language, isUrgent), выбор скилла и умный поиск (+/-).
   * - Контактные данные (telegramUsername) всегда скрыты для публичной ленты.
   */
  async findAll(
    query: ShowcaseQueryDto,
    currentUserId?: string,
  ): Promise<PaginatedResponseDto<ShowcaseCardResponseDto>> {
    // 1. Базовые условия выборки: на витрине показываем только активные карточки
    const where: Prisma.ShowcaseCardWhereInput = {
      status: "ACTIVE",
    };

    // Исключаем карточки текущего пользователя (чтобы не откликаться на самого себя)
    if (currentUserId) {
      where.userId = { not: currentUserId };
    }

    // 2. Точные фильтры из выпадающих списков (дропдаунов)
    if (query.specialization) {
      where.specialization = query.specialization; // например: FRONTEND
    }
    if (query.level) {
      where.level = query.level; // например: MIDDLE
    }
    if (query.language) {
      where.language = query.language; // например: RU
    }
    if (query.isUrgent !== undefined) {
      where.isUrgent = query.isUrgent; // бейдж "Готов сегодня" (true/false)
    }

    // 3. Собираем условия поиска по навыкам и ключевым словам в массив AND
    const andConditions: Prisma.ShowcaseCardWhereInput[] = [];

    // Фильтр по конкретному навыку из дропдауна (skills @> [skill])
    if (query.skill) {
      andConditions.push({ skills: { has: normalizeSkill(query.skill) } });
    }

    // Полнотекстовый и операторный поиск строки (например: "+react -vue middle")
    if (query.search) {
      const parsed = parseSearchQuery(query.search);

      // Обязательные навыки (+react) — карточка ДОЛЖНА содержать каждый из них
      if (parsed.include.length > 0) {
        andConditions.push({ skills: { hasEvery: parsed.include } });
      }

      // Исключаемые навыки (-vue) — карточка НЕ ДОЛЖНА содержать ни одного из них
      if (parsed.exclude.length > 0) {
        andConditions.push({ NOT: { skills: { hasSome: parsed.exclude } } });
      }

      // Свободные поисковые слова (middle) — ищем совпадение в title, bio ИЛИ skills
      for (const term of parsed.terms) {
        const sanitizedTerm = sanitizeSearchTerm(term);
        andConditions.push({
          OR: [
            { title: { contains: sanitizedTerm, mode: "insensitive" } }, // совпадение в заголовке
            { bio: { contains: sanitizedTerm, mode: "insensitive" } }, // совпадение в описании
            { skills: { has: term } }, // точное совпадение навыка (без LIKE-экранирования)
          ],
        });
      }
    }

    // Если есть условия по скиллам/поиску — прикрепляем их к главному where через AND
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // 4. Определение направления сортировки
    // По умолчанию: сначала карточки, которые недавно поднимали в топ (bumpedAt)
    let orderBy: Prisma.ShowcaseCardOrderByWithRelationInput = {
      bumpedAt: "desc",
    };
    if (query.sortBy === "NEWEST") {
      orderBy = { createdAt: "desc" }; // по дате создания (новые сверху)
    } else if (query.sortBy === "LEVEL_ASC") {
      orderBy = { level: "asc" }; // по возрастанию грейда (Junior -> Lead)
    } else if (query.sortBy === "LEVEL_DESC") {
      orderBy = { level: "desc" }; // по убыванию грейда (Lead -> Junior)
    }

    // 5. Расчет смещения для пагинации
    const page = query.page ?? 1; // текущая страница (по умолчанию 1)
    const limit = query.limit ?? 20; // карточек на странице (по умолчанию 20)
    const skip = (page - 1) * limit; // сколько записей пропустить в БД

    // 6. Выполняем два запроса параллельно: подсчёт общего числа и выборку страницы
    const [total, rawCards] = await Promise.all([
      this.prisma.showcaseCard.count({ where }),
      this.prisma.showcaseCard.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: { select: PUBLIC_USER_SELECT },
          ...CARD_SLOTS_INCLUDE,
        },
      }),
    ]);

    // 7. Скрываем контакты в публичной ленте для всех пользователей
    const cards = rawCards.map((card) => {
      card.user.telegramUsername = null;
      return card;
    });

    // 8. Считаем общее количество страниц
    const totalPages = Math.ceil(total / limit);

    // 9. Возвращаем данные с мета-информацией для навигации
    return {
      data: cards.map((card) => toShowcaseCardResponse(card)),
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
   * Получение всех карточек автора для личного кабинета со статистикой откликов.
   *
   * Правила и особенности:
   * - Возвращает карточки во всех статусах (ACTIVE, INACTIVE, EXPIRED).
   * - Агрегирует количество заявок в статусах PENDING и ACCEPTED через один SQL-запрос без N+1.
   */
  async findMyCards(userId: string): Promise<ShowcaseCardResponseDto[]> {
    // 1. Загружаем все карточки автора, отсортированные от новых к старым
    const cards = await this.prisma.showcaseCard.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        ...CARD_SLOTS_INCLUDE,
      },
    });

    // Если карточек нет — сразу возвращаем пустой массив
    if (cards.length === 0) {
      return [];
    }

    // 2. Собираем массив ID карточек для группового подсчёта заявок
    const cardIds = cards.map((c) => c.id);

    // 3. Считаем заявки одним SQL-запросом через groupBy (по карточке и статусу)
    const requestStats = await this.prisma.matchRequest.groupBy({
      by: ["targetCardId", "status"],
      where: {
        targetCardId: { in: cardIds },
        status: { in: ["PENDING", "ACCEPTED"] },
      },
      _count: { _all: true },
    });

    // 4. Раскладываем результат подсчёта в словарь Map для быстрого доступа O(1)
    const statsMap = new Map<string, ShowcaseCardStatsDto>();

    for (const stat of requestStats) {
      const current = statsMap.get(stat.targetCardId) ?? {
        pendingRequestsCount: 0,
        acceptedRequestsCount: 0,
      };

      if (stat.status === "PENDING") {
        current.pendingRequestsCount = stat._count._all;
      } else if (stat.status === "ACCEPTED") {
        current.acceptedRequestsCount = stat._count._all;
      }

      statsMap.set(stat.targetCardId, current);
    }

    // 5. Прикрепляем объект stats к каждой карточке (с нулями по умолчанию)
    return cards.map((card) =>
      toShowcaseCardResponse(
        card,
        statsMap.get(card.id) ?? {
          pendingRequestsCount: 0,
          acceptedRequestsCount: 0,
        },
      ),
    );
  }

  /**
   * Получение одной карточки витрины по её ID.
   *
   * Правила и особенности:
   * - Выбрасывает NotFoundException, если анкета с таким ID не существует.
   * - Принудительно скрывает telegramUsername для защиты личных данных на витрине.
   */
  async findOne(
    id: string,
    currentUserId?: string,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Ищем анкету по ID вместе с публичным профилем автора
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
        ...CARD_SLOTS_INCLUDE,
      },
    });

    // 2. Если карточка не найдена — отдаем 404
    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    // 3. Защита приватности: неактивные карточки (INACTIVE/EXPIRED) может просматривать только их владелец
    if (card.status !== "ACTIVE" && card.userId !== currentUserId) {
      throw new NotFoundException("Анкета не найдена");
    }

    // 4. Скрываем Telegram в публичном просмотре (открывается только после взаимного ACCEPTED)
    card.user.telegramUsername = null;

    return toShowcaseCardResponse(card);
  }

  /**
   * Редактирование карточки витрины её автором.
   *
   * Правила и проверки:
   * - Редактировать анкету может только её автор (иначе 403 Forbidden).
   * - При изменении specialization или level проверяет, чтобы у активной анкеты
   *   не возникло дубликата с другой активной анкетой того же пользователя.
   * - `slots` — полная замена расписания: слоты, которых нет в запросе,
   *   погашаются, а занятые заявками слоты сохраняются (ADR-002:62, :117).
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Ищем текущую карточку вместе со слотами: сравнение нового расписания
    //    с текущим обязано видеть то же состояние, в котором будет запись.
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      include: {
        slots: { orderBy: { startsAt: "asc" } },
      },
    });

    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    // 2. Проверяем, что запрос выполняет именно автор карточки
    if (card.userId !== userId) {
      throw new ForbiddenException(
        "Недостаточно прав для редактирования чужой анкеты",
      );
    }

    // 3. Вычисляем будущие специализацию и уровень после обновления
    const nextSpecialization = dto.specialization ?? card.specialization;
    const nextLevel = dto.level ?? card.level;

    // 4. Если анкета активна и меняются специализация/уровень — проверяем отсутствие дубликата
    if (
      card.status === "ACTIVE" &&
      (dto.specialization !== undefined || dto.level !== undefined)
    ) {
      const duplicate = await this.prisma.showcaseCard.findFirst({
        where: {
          userId,
          specialization: nextSpecialization,
          level: nextLevel,
          status: "ACTIVE",
          id: { not: id }, // исключаем саму редактируемую карточку
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new ConflictException(
          "У вас уже есть активная анкета с такой специализацией и уровнем",
        );
      }
    }

    // 5. Пересборка расписания и запись полей анкеты — в одной транзакции:
    //    частично применённое расписание выглядело бы валидным, хотя часть
    //    слотов уже погашена (ADR-002:65, :104).
    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const slots =
            dto.slots === undefined
              ? undefined
              : await this.replaceSlots(tx, card, dto.slots);

          const saved = await tx.showcaseCard.update({
            where: { id },
            data: {
              ...(dto.title !== undefined && { title: dto.title }),
              ...(dto.specialization !== undefined && {
                specialization: dto.specialization,
              }),
              ...(dto.level !== undefined && { level: dto.level }),
              ...(dto.language !== undefined && { language: dto.language }),
              ...(dto.skills !== undefined && { skills: dto.skills }),
              ...(dto.bio !== undefined && { bio: dto.bio }),
              ...(dto.scheduleInfo !== undefined && {
                scheduleInfo: dto.scheduleInfo,
              }),
              ...(dto.isUrgent !== undefined && { isUrgent: dto.isUrgent }),
              ...(dto.autoRenew !== undefined && {
                autoRenew: dto.autoRenew,
              }),
            },
            include: {
              user: { select: PUBLIC_USER_SELECT },
              ...CARD_SLOTS_INCLUDE,
            },
          });

          // Ответ собирается из прочитанных слотов: повторный include вернул бы
          // слоты, прочитанные до записи анкеты, и не увидел бы новые.
          return slots === undefined ? saved : { ...saved, slots };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.invalidateShowcaseCache(userId);
      return toShowcaseCardResponse(updated);
    } catch (error) {
      if (this.isSerializationConflict(error)) {
        throw new ConflictException(
          "Не удалось сохранить анкету из-за высокой конкуренции параллельных запросов. Пожалуйста, повторите попытку.",
        );
      }

      this.handleUniqueConflict(
        error,
        "У вас уже есть активная анкета с такой специализацией и уровнем",
      );
    }
  }

  /**
   * Пересобирает расписание карточки целиком (ADR-002:62, :117).
   *
   * Занятые слоты не трогаются: `BOOKED` означает, что время принадлежит уже
   * созданной заявке, а не расписанию, поэтому снять его может только сама
   * заявка. Остальные слоты, отсутствующие в запросе, гасятся, совпавшие — остаются,
   * а новые добавляются. Погашенные слоты освобождают интервал: иначе удаление
   * слота и добавление нового на его месте были бы невозможны в одном запросе.
   */
  private async replaceSlots(
    tx: Prisma.TransactionClient,
    card: {
      id: string;
      userId: string;
      expiresAt: Date;
      slots: CardSlots;
    },
    requested: NonNullable<UpdateShowcaseCardDto["slots"]>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: card.userId },
      select: { timezone: true },
    });

    // Зона владельца обязательна: без неё локальное время слота некуда переводить.
    if (!user?.timezone) {
      throw new BadRequestException(
        "Укажите таймзону в профиле, чтобы добавить слоты расписания",
      );
    }

    const takenByRequests = card.slots.filter(
      (slot) => slot.status === SURVIVING_SLOT_STATUS,
    );
    const openSlots = card.slots.filter((slot) => slot.status === "OPEN");

    // Пересечение с занятым слотом отклоняется здесь: освободить его может
    // только сама заявка, поэтому «освободить» его здесь нечем — а exclusion
    // constraint в БД всё равно отверг бы такую вставку.
    const resolved = resolveSlots(requested, {
      timeZone: user.timezone,
      now: new Date(),
      cardExpiresAt: card.expiresAt,
      existing: takenByRequests,
    });

    const openByIdentity = new Map(
      openSlots.map((slot) => [slotIdentity(slot), slot]),
    );

    const keptIdentities = new Set<string>();
    const created: ResolvedSlot[] = [];

    for (const slot of resolved) {
      const identity = slotIdentity(slot);

      // Совпавший слот не вставляется заново: exclusion constraint в БД считает
      // два одинаковых интервала пересечением, то есть вернуть «тот же» слот
      // без изменения не получилось бы.
      if (openByIdentity.has(identity)) {
        keptIdentities.add(identity);
        continue;
      }

      created.push(slot);
    }

    if (keptIdentities.size + created.length > MAX_SLOTS_PER_CARD) {
      throw new BadRequestException(
        `На карточке может быть не более ${MAX_SLOTS_PER_CARD} слотов, с учётом занятых заявками`,
      );
    }

    const removedIds = openSlots
      .filter((slot) => !keptIdentities.has(slotIdentity(slot)))
      .map((slot) => slot.id);

    if (removedIds.length > 0) {
      // `status: "OPEN"` в условии: погасить можно только свободный слот, иначе
      // запрос отнял бы время у заявки, которая его заняла между чтением и записью.
      await tx.availabilitySlot.updateMany({
        where: { id: { in: removedIds }, status: "OPEN" },
        data: { status: "CANCELLED" },
      });
    }

    const kept = openSlots.filter((slot) =>
      keptIdentities.has(slotIdentity(slot)),
    );

    if (created.length === 0) {
      return kept;
    }

    const inserted = await tx.availabilitySlot.createManyAndReturn({
      data: created.map((slot) => this.slotCreateData(card.id, slot)),
    });

    return [...kept, ...inserted].sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
  }

  /**
   * Переключение статуса анкеты (ACTIVE <-> INACTIVE).
   *
   * Правила и проверки:
   * - Изменять статус может только автор анкеты (иначе 403 Forbidden).
   * - Нельзя перевести из EXPIRED через смену статуса — для этого есть метод renew.
   * - При активации (переход в ACTIVE) проверяется лимит: не более 5 активных анкет.
   */
  async updateStatus(
    id: string,
    userId: string,
    dto: UpdateShowcaseCardStatusDto,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Находим карточку и проверяем права автора
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        ...CARD_SLOTS_INCLUDE,
      },
    });

    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    if (card.userId !== userId) {
      throw new ForbiddenException("Вы не можете изменить статус чужой анкеты");
    }

    // 2. Запрещаем переводить просроченную (EXPIRED) анкету через смену статуса
    if (card.status === "EXPIRED") {
      throw new BadRequestException(
        "Истекшую анкету нельзя активировать через смену статуса. Используйте продление.",
      );
    }

    // 3. Если статус совпадает с текущим — возвращаем данные владельца без повторной мутации
    if (card.status === dto.status) {
      return toShowcaseCardResponse(card);
    }

    // 4. При включении (ACTIVE) проверяем лимит 5 активных анкет
    if (dto.status === "ACTIVE") {
      const activeCardsCount = await this.prisma.showcaseCard.count({
        where: {
          userId,
          status: "ACTIVE",
        },
      });

      if (activeCardsCount >= SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER) {
        throw new BadRequestException(
          `Достигнут лимит активных анкет (максимум ${SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER})`,
        );
      }
    }

    // 5. Обновляем статус в базе данных
    try {
      const updated = await this.prisma.showcaseCard.update({
        where: { id },
        data: { status: dto.status },
        include: {
          user: { select: PUBLIC_USER_SELECT },
          ...CARD_SLOTS_INCLUDE,
        },
      });

      await this.invalidateShowcaseCache(userId);
      return toShowcaseCardResponse(updated);
    } catch (error) {
      this.handleUniqueConflict(
        error,
        "У вас уже есть активная анкета с такой специализацией и уровнем",
      );
    }
  }

  /**
   * Поднятие анкеты в топ каталога витрины (обновление даты bumpedAt).
   *
   * Правила и проверки:
   * - Поднять анкету может только её автор (иначе 403 Forbidden).
   * - Анкета должна быть в статусе ACTIVE.
   * - Кулдаун: не чаще одного раза в 24 часа. При повторной попытке сообщает, сколько часов осталось.
   */
  async bump(id: string, userId: string): Promise<ShowcaseCardResponseDto> {
    // 1. Загружаем анкету и проверяем авторство
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
        bumpedAt: true,
      },
    });

    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    if (card.userId !== userId) {
      throw new ForbiddenException(
        "Недостаточно прав для поднятия чужой анкеты",
      );
    }

    // 2. Поднимать в топ разрешено только активные анкеты
    if (card.status !== "ACTIVE") {
      throw new BadRequestException(
        "Поднять в топ можно только активную анкету",
      );
    }

    // 3. Проверяем, прошло ли 24 часа с момента последнего бампа
    const cooldownMs = SHOWCASE_LIMITS.BUMP_COOLDOWN_HOURS * 60 * 60 * 1000;
    const timeSinceLastBump = Date.now() - new Date(card.bumpedAt).getTime();

    // 4. Если кулдаун не прошёл — рассчитываем оставшиеся часы и возвращаем ошибку 400
    if (timeSinceLastBump < cooldownMs) {
      const remainingHours = Math.ceil(
        (cooldownMs - timeSinceLastBump) / (60 * 60 * 1000),
      );

      throw new BadRequestException(
        `Поднять анкету можно не чаще одного раза в сутки. Попробуйте через ${remainingHours} ч.`,
      );
    }

    // 5. Обновляем время bumpedAt на текущее
    const updated = await this.prisma.showcaseCard.update({
      where: { id },
      data: { bumpedAt: new Date() },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        ...CARD_SLOTS_INCLUDE,
      },
    });

    await this.invalidateShowcaseCache(userId);
    return toShowcaseCardResponse(updated);
  }

  /**
   * Перепубликация истекшей анкеты (EXPIRED -> ACTIVE).
   *
   * Правила и проверки:
   * - Продлевать анкету может только её автор (иначе 403 Forbidden).
   * - Продлить можно только анкету со статусом EXPIRED.
   * - Проверяется лимит: не более 5 активных анкет на пользователя.
   * - Обновляет expiresAt на now + 15 дней и сбрасывает bumpedAt на текущее время.
   */
  async renew(id: string, userId: string): Promise<ShowcaseCardResponseDto> {
    // 1. Находим карточку и проверяем права автора
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      select: {
        userId: true,
        status: true,
      },
    });

    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    if (card.userId !== userId) {
      throw new ForbiddenException("Вы не можете продлить чужую анкету");
    }

    // 2. Продление допустимо исключительно для анкет со статусом EXPIRED
    if (card.status !== "EXPIRED") {
      throw new BadRequestException("Продлить можно только истекшую анкету");
    }

    // 3. Проверяем лимит: у пользователя должно быть свободно место среди 5 активных
    const activeCardsCount = await this.prisma.showcaseCard.count({
      where: {
        userId,
        status: "ACTIVE",
      },
    });

    if (activeCardsCount >= SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER) {
      throw new BadRequestException(
        `Достигнут лимит активных анкет (максимум ${SHOWCASE_LIMITS.MAX_ACTIVE_CARDS_PER_USER})`,
      );
    }

    // 4. Рассчитываем новую дату истечения (текущее время + 15 дней)
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + SHOWCASE_LIMITS.CARD_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // 5. Переводим в ACTIVE, продлеваем срок и поднимаем в топ
    try {
      const renewed = await this.prisma.showcaseCard.update({
        where: { id },
        data: {
          status: "ACTIVE",
          expiresAt,
          bumpedAt: now,
        },
        include: {
          user: { select: PUBLIC_USER_SELECT },
          ...CARD_SLOTS_INCLUDE,
        },
      });

      await this.invalidateShowcaseCache(userId);
      return toShowcaseCardResponse(renewed);
    } catch (error) {
      this.handleUniqueConflict(
        error,
        "У вас уже есть активная анкета с такой специализацией и уровнем",
      );
    }
  }

  /**
   * Удаление карточки с витрины.
   *
   * Правила и проверки:
   * - Удалять анкету может только её автор (иначе 403 Forbidden).
   * - Каскадно удаляет связанные заявки в базе данных.
   */
  async remove(id: string, userId: string): Promise<void> {
    // 1. Находим анкету для проверки существования и владельца
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      select: {
        userId: true,
      },
    });

    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    // 2. Проверяем, что запрос выполняет именно автор анкеты
    if (card.userId !== userId) {
      throw new ForbiddenException(
        "Недостаточно прав для удаления чужой анкеты",
      );
    }

    // 3. Удаляем карточку из базы данных
    await this.prisma.showcaseCard.delete({
      where: { id },
    });

    await this.invalidateShowcaseCache(userId);
  }

  /**
   * Перехватывает конфликт сериализации (Prisma P2034).
   *
   * Отдельный тип ошибки, а не повтор: P2034 означает, что параллельная
   * транзакция изменила те же строки, поэтому исход решения «кто первый» здесь
   * нет — его должен повторить клиент.
   */
  private isSerializationConflict(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2034"
    );
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
}
