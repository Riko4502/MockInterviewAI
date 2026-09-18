import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateShowcaseCardDto,
  normalizeSkill,
  PaginatedResponseDto,
  parseSearchQuery,
  ShowcaseCardResponseDto,
  ShowcaseQueryDto,
  UpdateShowcaseCardDto,
  UpdateShowcaseCardStatusDto,
} from "@packages/dto";
import { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PUBLIC_USER_SELECT, SHOWCASE_LIMITS } from "./showcase.constants";

@Injectable()
export class ShowcaseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Публикация новой анкеты на витрине.
   *
   * Правила и проверки:
   * - Профиль автора должен быть заполнен: имя (>= 2 символов) и никнейм (@username).
   * - Лимит: не более 5 активных анкет на одного пользователя.
   * - Уникальность: запрещено создавать дубликат активной анкеты с теми же специализацией и уровнем.
   * - Срок жизни: автоматически выставляется expiresAt на 15 дней вперед.
   */
  async create(
    userId: string,
    dto: CreateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Проверяем заполненность профиля автора
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
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

    // 2. Проверяем лимит активных анкет (максимум 5 на пользователя)
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

    // 3. Проверяем отсутствие дубликата по специализации и уровню среди активных
    const existingActiveCard = await this.prisma.showcaseCard.findFirst({
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

    // 4. Вычисляем дату истечения срока жизни (текущее время + 15 дней)
    const expiresAt = new Date(
      Date.now() + SHOWCASE_LIMITS.CARD_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    // 5. Сохраняем новую анкету в базе данных с публичными данными автора
    return await this.prisma.showcaseCard.create({
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
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });
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
        andConditions.push({
          OR: [
            { title: { contains: term, mode: "insensitive" } }, // совпадение в заголовке
            { bio: { contains: term, mode: "insensitive" } }, // совпадение в описании
            { skills: { has: term } }, // точное совпадение навыка
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
      data: cards,
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
    const statsMap = new Map<
      string,
      { pendingRequestsCount: number; acceptedRequestsCount: number }
    >();

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
    return cards.map((card) => ({
      ...card,
      stats: statsMap.get(card.id) ?? {
        pendingRequestsCount: 0,
        acceptedRequestsCount: 0,
      },
    }));
  }

  /**
   * Получение одной карточки витрины по её ID.
   *
   * Правила и особенности:
   * - Выбрасывает NotFoundException, если анкета с таким ID не существует.
   * - Принудительно скрывает telegramUsername для защиты личных данных на витрине.
   */
  async findOne(id: string): Promise<ShowcaseCardResponseDto> {
    // 1. Ищем анкету по ID вместе с публичным профилем автора
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
      include: {
        user: {
          select: PUBLIC_USER_SELECT,
        },
      },
    });

    // 2. Если карточка не найдена — отдаем 404
    if (!card) {
      throw new NotFoundException("Анкета не найдена");
    }

    // 3. Скрываем Telegram в публичном просмотре (открывается только после взаимного ACCEPTED)
    card.user.telegramUsername = null;

    return card;
  }

  /**
   * Редактирование карточки витрины её автором.
   *
   * Правила и проверки:
   * - Редактировать анкету может только её автор (иначе 403 Forbidden).
   * - При изменении specialization или level проверяет, чтобы у активной анкеты
   *   не возникло дубликата с другой активной анкетой того же пользователя.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateShowcaseCardDto,
  ): Promise<ShowcaseCardResponseDto> {
    // 1. Ищем текущую карточку в базе
    const card = await this.prisma.showcaseCard.findUnique({
      where: { id },
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

    // 5. Применяем только переданные поля и сохраняем обновления
    return this.prisma.showcaseCard.update({
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
        ...(dto.autoRenew !== undefined && { autoRenew: dto.autoRenew }),
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });
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
      select: {
        userId: true,
        status: true,
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

    // 3. Если статус совпадает с текущим — ничего не меняем
    if (card.status === dto.status) {
      return this.findOne(id);
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
    return this.prisma.showcaseCard.update({
      where: { id },
      data: { status: dto.status },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });
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
    return this.prisma.showcaseCard.update({
      where: { id },
      data: { bumpedAt: new Date() },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });
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
    return this.prisma.showcaseCard.update({
      where: { id },
      data: {
        status: "ACTIVE",
        expiresAt,
        bumpedAt: now,
      },
      include: {
        user: { select: PUBLIC_USER_SELECT },
      },
    });
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
  }
}
