

## 1. Метаданные задачи

| Параметр | Значение |
| --- | --- |
| **Тип задачи** | `Feature / New Domain Module` |
| **Компоненты** | `apps/api`, `packages/dto` |
| **Приоритет** | `High` |
| **Стек** | NestJS 11, Prisma 7, PostgreSQL 16, Redis, Zod, TypeScript Strict |
| **Версия документа** | `v2.0.0` |
| **План реализации** | [`exhibitor-showcase-matchmaking-plan.md`](./exhibitor-showcase-matchmaking-plan.md) |
| **Связанные документы** | `docs/backend/README.md`, `docs/backend/data/database-prisma.md` |

---

## 2. Бизнес-требования и User Stories

### 2.1. Контекст и проблематика

Платформа предоставляет возможность разработчикам находить партнеров для взаимных тренировочных (мок) интервью.

Участники часто развиваются в нескольких направлениях одновременно (например, как **Backend Go** разработчик уровня Middle и как **QA Automation** уровня Junior, или **Frontend React** + **Fullstack Node.js**).

Поэтому данные витрины **не привязываются жестко 1-к-1 к профилю**: пользователь может создавать **множество независимых объявлений (карточек)** под разные роли, грейды, стеки технологий и языки общения, а другие участники откликаются на конкретное объявление.

---

### 2.2. Ключевые бизнес-механизмы

#### 1. Жизненный цикл карточки (TTL 15 дней и триггер `autoRenew`):

* **Срок жизни:** Каждая карточка создается со сроком действия **15 дней** (`expiresAt = now() + 15 days`, `status = ACTIVE`).
* **Триггер авто-продления (`autoRenew: boolean`):**
  * Если `autoRenew = true` — при наступлении `expiresAt` фоновый воркер автоматически продлевает карточку еще на 15 дней и обновляет метку поднятия (`bumpedAt = now()`).
  * Если `autoRenew = false` — карточка переходит в статус `EXPIRED` и скрывается с витрины. Карточка **НЕ удаляется** из базы данных.
* **Ручное перевыставление (`POST /showcase/:id/renew`):** Пользователь может в 1 клик перевыставить архивную карточку из статуса `EXPIRED` обратно в `ACTIVE` еще на 15 дней.
* **Ручное поднятие в топ (`POST /showcase/:id/bump`):** Доступно для активной карточки не чаще **1 раза в 24 часа** (обновляет `bumpedAt = now()`).

#### 2. Продвинутый поисковый синтаксис (Операторы `+` и `-`):

* `+термин` (например, `+react`, `+typescript`) — обязательное присутствие навыка или слова.
* `-термин` (например, `-vue`, `-angular`) — гарантированное исключение карточек с данным навыком/словом.
* Обычные слова (например, `middle backend`) — нестрогий полнотекстовый поиск по заголовку, описанию и имени автора.
* *Пример запроса:* `+react -vue middle frontend`.

#### 3. Язык проведения интервью (`language`):

* Поддержка выбора языка собеседования: `RU` (Русский), `EN` (Английский), `ANY` (Любой).
* Фильтрация на витрине по языку.

#### 4. Срочный поиск / Бейдж «Готов сегодня» (`isUrgent`):

* Флаг `isUrgent: boolean` для участников, готовых созвониться в ближайшие часы.
* На витрине отображается специальный бейдж ⚡ *"Готов сегодня"*.

#### 5. Причина отклонения заявки (`rejectReason`):

* При отклонении инвайта (`REJECT`) получатель может опционально указать причину (например, *"Не подходят слоты времени"*, *"Уже нашел пару на этой неделе"*), которая отображается отправителю в его списке исходящих заявок.

#### 6. Быстрый счетчик непрочитанных заявок (`GET /matchmaking/requests/unread-count`):

* Легковесный эндпоинт для шапки сайта и колокольчика уведомлений фронтенда.

---

### 2.3. User Stories

* **US-1 (Множественные карточки):** Я, как пользователь с заполненным профилем (`displayName`, `username`), хочу создавать до 5 активных карточек под разные специализации и грейды (не более 1 активной карточки на одну комбинацию `specialization + level`).
* **US-2 (Управление карточками и авто-продление):** Я хочу настраивать авто-продление каждые 15 дней (`autoRenew`), поднимать карточку в топ раз в сутки (`bump`), а также перевыставлять истекшие карточки (`renew`).
* **US-3 (Умный поиск и фильтры):** Я хочу находить партнеров с помощью поиска с операторами `+react -vue`, фильтров по грейду, специализации, языку общения (`RU`/`EN`) и флагу срочности `isUrgent`.
* **US-4 (Отклик и защита от перегрузки):** Я хочу отправить заявку на понравившуюся карточку. Если у автора уже 10 необработанных заявок (`PENDING`), система вежливо сообщает о временной занятости автора.
* **US-5 (Жизненный цикл заявок и Cooldown):** Автор карточки может принять заявку (`ACCEPT`) или отклонить ее (`REJECT`) с указанием причины. При отклонении действует 24-часовой Cooldown на повторные заявки — **per-author** (блокируются отправки к любым карточкам этого автора, см. §8.2.4). Встречные заявки автоматически образуют взаимный матч: **обе** заявки переводятся в `ACCEPTED` в одной транзакции (см. §8.2.5). Принятие одной заявки не отменяет другие входящие заявки.
* **US-6 (Обмен контактами после матча):** После перехода заявки в `ACCEPTED` оба участника получают контактные данные друг друга (`telegramUsername`, `email` — через маппинг `telegramUsername`/`gitUrl` в ответах) для оперативной связи. До состояния `ACCEPTED` контактные данные **не публикуются**: `telegramUsername` и `gitUrl` маскируются в `null` для всех, кроме стороны подтверждённого матча (см. §8.2.8).

---

## 3. Архитектурные границы (Scope & Non-Scope)

### ✅ Входит в задачу (In-Scope):

 1. Моделирование и миграции Prisma для `ShowcaseCard` и `MatchRequest` со всеми полями, индексами и перечислениями.
 2. Ограничение уникальности активных карточек на уровне БД: частичный уникальный индекс на `(userId, specialization, level)` при `status = 'ACTIVE'`.
 3. GIN-индексация массивов `skills` в PostgreSQL.
 4. Поисковый парсер операторов `+` (include) и `-` (exclude) с защитой от DoS (макс. 100 символов, макс. 10 токенов, экранирование спецсимволов).
 5. Санитизация полей `bio`, `scheduleInfo`, `message`, `rejectReason` от HTML/XSS тегов.
 6. Контракты DTO и схемы валидации Zod в `@packages/dto`.
 7. Модули NestJS: `ShowcaseModule`, `MatchmakingModule`.
 8. Фоновый Cron-сервис:
    * `ShowcaseCronService` (проверка каждые 15 минут: авто-продление карточек при `autoRenew = true` и перевод в `EXPIRED` при `autoRenew = false`).
    * `MatchmakingCronService` (проверка раз в час: авто-экспирация заявок `MatchRequest` старше 72 часов).
 9. Защитные механизмы: лимит 5 активных карточек, лимит 5 исходящих заявок, лимит 10 входящих заявок на карточку, Cooldown 24ч после `REJECT`, защита от Self-invite.
10. Публикация событий в Redis Pub/Sub (`matchmaking:events`).
11. Документация OpenAPI/Swagger (`@nestjs/swagger`).
12. Полное покрытие Unit-тестами (\>= 85%).

### ❌ НЕ входит в задачу (Non-Scope / Вынесено в следующие задачи):

1. Переход в WebRTC/WebSocket комнату редактора кода (отдельный модуль `sessions`).
2. Отправка Push/Telegram/Email уведомлений (отдельный сервис `notifications`).
3. Видеосвязь и трансляция медиапотоков (LiveKit/WebRTC).
4. Оценка и отзывы после завершения интервью (модуль `feedback`).

---

## 4. Схема данных Prisma (`apps/api/prisma/schema.prisma`)

```prisma
enum Specialization {
  FRONTEND
  BACKEND
  FULLSTACK
  DEVOPS
  QA
  MOBILE
  DATA_ML
  SYSTEM_DESIGN
}

enum ExperienceLevel {
  JUNIOR
  MIDDLE
  SENIOR
  LEAD
}

enum InterviewLanguage {
  RU
  EN
  ANY
}

enum ShowcaseCardStatus {
  ACTIVE    // Активна и отображается на витрине
  INACTIVE  // Временно скрыта пользователем вручную
  EXPIRED   // Истек 15-дневный срок жизни (архив)
}

enum MatchRequestStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
  EXPIRED
}

model ShowcaseCard {
  id              String             @id @default(uuid()) @db.Uuid
  userId          String             @db.Uuid
  user            User               @relation("UserShowcaseCards", fields: [userId], references: [id], onDelete: Cascade)
  
  title           String?            @db.VarChar(100) // Например: "Ищу Middle Go для мока по алгоритмам"
  specialization  Specialization
  level           ExperienceLevel
  language        InterviewLanguage  @default(RU)
  skills          String[]           @default([]) // ["react", "typescript", "tailwind"]
  bio             String?            @db.VarChar(500)
  scheduleInfo    String?            @db.VarChar(300) // Например: "Будни 19:00-22:00 МСК"
  
  isUrgent        Boolean            @default(false) // Бейдж "Готов сегодня"
  status          ShowcaseCardStatus @default(ACTIVE)
  autoRenew       Boolean            @default(false) // Авто-продление каждые 15 дней
  
  bumpedAt        DateTime           @default(now()) // Время последнего поднятия в топ
  expiresAt       DateTime           // now() + 15 days

  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  receivedRequests MatchRequest[]    @relation("TargetCardRequests")
  senderRequests   MatchRequest[]    @relation("SenderCardRequests")

  @@map("showcase_cards")
  @@index([specialization, level])
  @@index([language])
  @@index([status])
  @@index([isUrgent])
  @@index([userId, status])
  @@index([status, expiresAt])
  @@index([bumpedAt(sort: Desc)])
  @@index([skills], type: Gin)
}

model MatchRequest {
  id              String              @id @default(uuid()) @db.Uuid
  
  senderId        String              @db.Uuid
  sender          User                @relation("UserSentMatchRequests", fields: [senderId], references: [id], onDelete: Cascade)
  
  receiverId      String              @db.Uuid
  receiver        User                @relation("UserReceivedMatchRequests", fields: [receiverId], references: [id], onDelete: Cascade)
  
  targetCardId    String              @db.Uuid
  // onDelete: Cascade — осознанный трейдофф (решение PMC v1.0.0): удаление карточки
  // (или purge аккаунта) каскадно удаляет ВСЕ связанные заявки, включая ACCEPTED
  // (история матчей и «обмен контактами» стираются). См. §13.1.
  targetCard      ShowcaseCard        @relation("TargetCardRequests", fields: [targetCardId], references: [id], onDelete: Cascade)

  senderCardId    String?             @db.Uuid
  senderCard      ShowcaseCard?       @relation("SenderCardRequests", fields: [senderCardId], references: [id], onDelete: SetNull)

  status          MatchRequestStatus  @default(PENDING)
  message         String?             @db.VarChar(300)
  preferredTopic  String?             @db.VarChar(100)
  rejectReason    String?             @db.VarChar(200) // Причина отклонения
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  expiresAt       DateTime            // now() + 72h

  @@map("match_requests")
  @@index([receiverId, status])
  @@index([senderId, status])
  @@index([targetCardId, status])
  @@index([status, expiresAt])
  // Индекс для Cooldown 24ч (per-author): поиск последнего REJECTED-запроса
  // от отправителя к любому объявлению автора (см. §8.2.4).
  @@index([receiverId, status, createdAt])
}
```

*Дополнения в модель `User`:*

```prisma
model User {
  // ... существующие поля (id, email, displayName, username, avatarUrl, deletedAt и др.)
  showcaseCards         ShowcaseCard[] @relation("UserShowcaseCards")
  sentMatchRequests     MatchRequest[] @relation("UserSentMatchRequests")
  receivedMatchRequests MatchRequest[] @relation("UserReceivedMatchRequests")
}
```

*Частичные уникальные индексы (PostgreSQL Raw SQL миграция):*

```sql
-- 1. Запрет дубликатов активных заявок от одного пользователя на одну и ту же карточку
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_match_request_per_card 
ON match_requests (senderId, targetCardId) 
WHERE status = 'PENDING';

-- 2. Запрет дублирования активных карточек с одинаковой специализацией и грейдом у одного пользователя
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_user_specialization_level 
ON showcase_cards (userId, specialization, level) 
WHERE status = 'ACTIVE';
```

*Решение PMC: колонки новых таблиц — **camelCase** без `@map`, единообразно с существующей таблицей `users`. Названия таблиц — snake_case во множественном числе через `@@map` (конвенция базы `docs/backend/data/database-prisma.md`), см. §13.4.*

---

## 5. Контракты данных DTO и Поисковый Парсер (`packages/dto`)

Файлы создаются в `packages/dto/src/showcase/` и `packages/dto/src/matchmaking/`.

### 5.1. Перечисления (`packages/dto/src/showcase/showcase.enums.ts`)

```typescript
import { z } from "zod";

export const specializationEnum = z.enum([
  "FRONTEND",
  "BACKEND",
  "FULLSTACK",
  "DEVOPS",
  "QA",
  "MOBILE",
  "DATA_ML",
  "SYSTEM_DESIGN",
]);

export const experienceLevelEnum = z.enum([
  "JUNIOR",
  "MIDDLE",
  "SENIOR",
  "LEAD",
]);

export const interviewLanguageEnum = z.enum([
  "RU",
  "EN",
  "ANY",
]);

export const showcaseCardStatusEnum = z.enum([
  "ACTIVE",
  "INACTIVE",
  "EXPIRED",
]);

export const matchRequestStatusEnum = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

export const showcaseSortByEnum = z.enum([
  "BUMPED",   // По дате поднятия в топ (дефолт)
  "NEWEST",   // По дате создания
  "LEVEL_ASC",
  "LEVEL_DESC",
]);

export type Specialization = z.infer<typeof specializationEnum>;
export type ExperienceLevel = z.infer<typeof experienceLevelEnum>;
export type InterviewLanguage = z.infer<typeof interviewLanguageEnum>;
export type ShowcaseCardStatus = z.infer<typeof showcaseCardStatusEnum>;
export type MatchRequestStatus = z.infer<typeof matchRequestStatusEnum>;
export type ShowcaseSortBy = z.infer<typeof showcaseSortByEnum>;
```

### 5.2. Поисковый парсер операторов `+` и `-` (`packages/dto/src/showcase/search-parser.ts`)

```typescript
export interface ParsedSearchQuery {
  include: string[]; // Обязательные (+react, +nest)
  exclude: string[]; // Обязательно отсутствующие (-vue, -angular)
  terms: string[];   // Обычные слова (middle, junior)
}

/** Максимальное суммарное число токенов для защиты от DoS */
const MAX_SEARCH_TOKENS = 10;

/** Максимальная длина одного токена (защита от длинных псевдо-слов) */
const MAX_TOKEN_LENGTH = 50;

/** Исключение control-символов и непечатных символов */
function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, "");
}

/** Экранирование спецсимволов SQL (%, _, \) */
export function sanitizeSearchTerm(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

/** Очистка строк от потенциально опасных HTML-тегов (XSS prevention).
 *  Важно: это базовая защита (см. §13.3) — фронтенд обязан экранировать
 *  контент при рендере (унаследованные уязвимости регекс-стрипа). */
export function stripHtmlTags(input: string): string {
  return stripControlChars(input).replace(/<[^>]*>?/gm, "").trim();
}

/** Нормализация скилла */
export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseSearchQuery(query?: string): ParsedSearchQuery {
  if (!query || typeof query !== "string") {
    return { include: [], exclude: [], terms: [] };
  }

  const raw = stripControlChars(query.trim()).slice(0, 100);
  if (!raw) {
    return { include: [], exclude: [], terms: [] };
  }

  const tokens = raw.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TOKENS);
  const include: string[] = [];
  const exclude: string[] = [];
  const terms: string[] = [];

  for (const token of tokens) {
    if (token.length > MAX_TOKEN_LENGTH) {
      continue;
    }
    if (token.startsWith("+") && token.length > 1) {
      include.push(sanitizeSearchTerm(token.slice(1).toLowerCase()));
    } else if (token.startsWith("-") && token.length > 1) {
      exclude.push(sanitizeSearchTerm(token.slice(1).toLowerCase()));
    } else {
      terms.push(sanitizeSearchTerm(token.toLowerCase()));
    }
  }

  return {
    include: Array.from(new Set(include)),
    exclude: Array.from(new Set(exclude)),
    terms: Array.from(new Set(terms)),
  };
}
```

### 5.3. Создание и редактирование карточки (`packages/dto/src/showcase/manage-showcase-card.dto.ts`)

```typescript
import { z } from "zod";
import {
  experienceLevelEnum,
  interviewLanguageEnum,
  specializationEnum,
} from "./showcase.enums";
import { normalizeSkill, stripHtmlTags } from "./search-parser";

export const createShowcaseCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Заголовок должен содержать минимум 3 символа")
    .max(100, "Заголовок не должен превышать 100 символов")
    .transform(stripHtmlTags)
    .optional(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
  language: interviewLanguageEnum.default("RU"),
  skills: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Название скилла не может быть пустым")
        .max(30, "Максимальная длина скилла — 30 символов")
        .transform(normalizeSkill),
    )
    .min(1, "Укажите хотя бы один ключевой навык")
    .max(20, "Нельзя указать более 20 навыков")
    .transform((items) => Array.from(new Set(items))),
  bio: z
    .string()
    .trim()
    .max(500, "Описание не должно превышать 500 символов")
    .transform(stripHtmlTags)
    .optional()
    .nullable(),
  scheduleInfo: z
    .string()
    .trim()
    .max(300, "Информация о расписании не должна превышать 300 символов")
    .transform(stripHtmlTags)
    .optional()
    .nullable(),
  isUrgent: z.boolean().default(false),
  autoRenew: z.boolean().default(false),
});

export const updateShowcaseCardSchema = createShowcaseCardSchema.partial();

// Примечание: у update-схемы сохраняется `.min(1)` для `skills` — очистка навыков
// до пустого массива НЕ допускается (карточка всегда имеет >= 1 навык).

export const updateShowcaseCardStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type CreateShowcaseCardDto = z.infer<typeof createShowcaseCardSchema>;
export type UpdateShowcaseCardDto = z.infer<typeof updateShowcaseCardSchema>;
export type UpdateShowcaseCardStatusDto = z.infer<typeof updateShowcaseCardStatusSchema>;
```

### 5.4. Запросы фильтрации витрины (`packages/dto/src/showcase/showcase-query.dto.ts`)

```typescript
import { z } from "zod";
import {
  experienceLevelEnum,
  interviewLanguageEnum,
  showcaseSortByEnum,
  specializationEnum,
} from "./showcase.enums";

export const showcaseQuerySchema = z.object({
  specialization: specializationEnum.optional(),
  level: experienceLevelEnum.optional(),
  language: interviewLanguageEnum.optional(),
  // ВАЖНО: НЕ использовать z.coerce.boolean() — в query-параметрах строка "false"
  // коэрсится в true (классическая ловушка). Строгое "true"/"false" -> boolean.
  isUrgent: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  skill: z.string().trim().toLowerCase().optional(),
  search: z.string().trim().max(100).optional(), // Поддерживает: "+react -vue nodejs"
  sortBy: showcaseSortByEnum.default("BUMPED"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ShowcaseQueryDto = z.infer<typeof showcaseQuerySchema>;
```

### 5.5. Заявки на матч (`packages/dto/src/matchmaking/matchmaking.dto.ts`)

```typescript
import { z } from "zod";
import { stripHtmlTags } from "../showcase/search-parser";
import { matchRequestStatusEnum } from "../showcase/showcase.enums";

export const createMatchRequestSchema = z.object({
  targetCardId: z.string().uuid("Некорректный UUID карточки витрины"),
  senderCardId: z.string().uuid("Некорректный UUID вашей карточки").optional(),
  message: z
    .string()
    .trim()
    .max(300, "Сообщение не должно превышать 300 символов")
    .transform(stripHtmlTags)
    .optional(),
  preferredTopic: z
    .string()
    .trim()
    .max(100, "Тема собеседования не должна превышать 100 символов")
    .transform(stripHtmlTags)
    .optional(),
});

export const rejectMatchRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(200, "Причина отклонения не должна превышать 200 символов")
    .transform(stripHtmlTags)
    .optional(),
});

export const matchRequestQuerySchema = z.object({
  status: matchRequestStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateMatchRequestDto = z.infer<typeof createMatchRequestSchema>;
export type RejectMatchRequestDto = z.infer<typeof rejectMatchRequestSchema>;
export type MatchRequestQueryDto = z.infer<typeof matchRequestQuerySchema>;
```

### 5.6. DTO ответов

```typescript
export interface PublicUserCardDto {
  id: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  telegramUsername: string | null; // МАСКИРОВКА: null, кроме случая, когда
  // текущий пользователь — участник ACCEPTED-заявки с владельцем (см. §8.2.8)
  gitUrl: string | null; // Маскируется аналогично telegramUsername до ACCEPTED
}

/**
 * Правило маппинга контактов (§8.2.8): `telegramUsername` и `gitUrl` заполняются
 * только когда запрос выполняет участник подтверждённого (ACCEPTED) матча
 * с владельцем карточки; во всех остальных случаях — `null`.
 */

export interface ShowcaseCardResponseDto {
  id: string;
  userId: string;
  user: PublicUserCardDto;
  title: string | null;
  specialization: Specialization;
  level: ExperienceLevel;
  language: InterviewLanguage;
  skills: string[];
  bio: string | null;
  scheduleInfo: string | null;
  isUrgent: boolean;
  status: ShowcaseCardStatus;
  autoRenew: boolean;
  bumpedAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Дополнительная статистика (заполняется для автора карточки при GET /showcase/my)
  stats?: {
    pendingRequestsCount: number;
    acceptedRequestsCount: number;
  };
}

export interface MatchRequestResponseDto {
  id: string;
  senderId: string;
  receiverId: string;
  sender: PublicUserCardDto;
  receiver: PublicUserCardDto;
  targetCard: ShowcaseCardResponseDto;
  senderCard: ShowcaseCardResponseDto | null;
  status: MatchRequestStatus;
  message: string | null;
  preferredTopic: string | null;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface UnreadMatchRequestsCountDto {
  pendingCount: number;
}

export interface PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
```

---

## 6. Алгоритм построения поискового запроса в `ShowcaseService`

```typescript
const parsed = parseSearchQuery(query.search);
const andConditions: Prisma.ShowcaseCardWhereInput[] = [
  { status: 'ACTIVE' },
  { expiresAt: { gt: new Date() } },
  { user: { deletedAt: null } },
];

if (currentUserId) {
  andConditions.push({ userId: { not: currentUserId } });
}

if (query.specialization) {
  andConditions.push({ specialization: query.specialization });
}

if (query.level) {
  andConditions.push({ level: query.level });
}

if (query.language) {
  andConditions.push({ language: query.language });
}

if (query.isUrgent !== undefined) {
  andConditions.push({ isUrgent: query.isUrgent });
}

if (query.skill) {
  andConditions.push({ skills: { has: query.skill.toLowerCase() } });
}

// 1. Обязательные включения (+react, +nest)
for (const inc of parsed.include) {
  andConditions.push({
    OR: [
      { skills: { has: inc } },
      { title: { contains: inc, mode: "insensitive" } },
      { bio: { contains: inc, mode: "insensitive" } },
    ],
  });
}

// 2. Обязательные исключения (-vue, -angular)
for (const exc of parsed.exclude) {
  andConditions.push({
    NOT: {
      OR: [
        { skills: { has: exc } },
        { title: { contains: exc, mode: "insensitive" } },
        { bio: { contains: exc, mode: "insensitive" } },
      ],
    },
  });
}

// 3. Общие термины поиска
// СЕМАНТИКА: все обычные термины обязательны (пересечение).
// "middle backend" => middle И backend. Формулировка «нестрогий» в §2.2
// относится к размытому match (ILIKE по полям), но НЕ к булевой логике.
if (parsed.terms.length > 0) {
  const termFilters = parsed.terms.map((term) => ({
    OR: [
      { user: { displayName: { contains: term, mode: "insensitive" } } },
      { user: { username: { contains: term, mode: "insensitive" } } },
      { title: { contains: term, mode: "insensitive" } },
      { bio: { contains: term, mode: "insensitive" } },
      { skills: { has: term } },
    ],
  }));
  andConditions.push({ AND: termFilters });
}

const where: Prisma.ShowcaseCardWhereInput = { AND: andConditions };

// Сортировка
let orderBy: Prisma.ShowcaseCardOrderByWithRelationInput = { bumpedAt: 'desc' };
if (query.sortBy === 'NEWEST') {
  orderBy = { createdAt: 'desc' };
}
```

*Трейдофф производительности (см. §13.2):* `contains` спущен в `ILIKE %term%` — ведущий wildcard не использует индекс (последовательное сканирование по `title`/`bio`/`displayName`). GIN по `skills` покрывает только точное совпадение `has` (include-токены и фильтр `skill`). Для объёмов MVP это приемлемо; при росте базы — `pg_trgm` GIN или полнотекстовый поиск.

---

## 7. Спецификация REST API (`apps/api`)

Базовый префикс: `/api/v1`

### 7.1. Витрина (`ShowcaseController` -\> `/api/v1/showcase`)

| Метод | URL | Guard | Описание |
| --- | --- | --- | --- |
| `GET` | `/showcase` | `JwtAuthGuard` + `ThrottlerGuard`* | Список активных карточек (`status: ACTIVE`, `expiresAt > now()`). Поддержка поиска `+`/`-`, фильтров `language`, `isUrgent` и сортировки. Карточки автора запроса исключаются. |
| `GET` | `/showcase/my` | `JwtAuthGuard` | Список всех карточек текущего пользователя (`ACTIVE`, `INACTIVE`, `EXPIRED`) со статистикой заявок `stats`. |
| `POST` | `/showcase` | `JwtAuthGuard` + `Throttler` | Создание карточки на 15 дней (`expiresAt = now() + 15d`). Проверка профиля, лимита 5 активных карточек и уникальности пары `(specialization, level)` (в `$transaction`, P2002 → `409`, см. §8.1.3). |
| `GET` | `/showcase/:id` | `JwtAuthGuard` | Просмотр подробной карточки. Автор видит свой статус; не-автор — только `ACTIVE` и неистекшую (иначе `404`). Контакты маскируются (§8.2.8). |
| `PATCH` | `/showcase/:id` | `JwtAuthGuard` | Редактирование карточки (**только автор**). При смене `specialization`/`level`: конфликт пары → `409`. `expiresAt`/`bumpedAt` через DTO не обновляются. |
| `PATCH` | `/showcase/:id/status` | `JwtAuthGuard` | Переключение между `ACTIVE` и `INACTIVE` (**только автор**). `INACTIVE→ACTIVE` запрещён при истёкшем `expiresAt` (→ `renew`), проверка уникальности пары. |
| `POST` | `/showcase/:id/bump` | `JwtAuthGuard` | Поднятие карточки в топ выдачи (`bumpedAt = now()`). Не чаще **1 раза в 24 часа**; атомарно через `updateMany` с условием по `bumpedAt` (§8.1.5). |
| `POST` | `/showcase/:id/renew` | `JwtAuthGuard` | Повторная публикация истекшей карточки (`EXPIRED -> ACTIVE`, `expiresAt = now() + 15d`, `bumpedAt = now()`). Только для `EXPIRED`, автор не `deletedAt`, конфликт пары → `409` (§8.1.6). |
| `DELETE` | `/showcase/:id` | `JwtAuthGuard` | Удаление своей карточки (**только автор**). Предупреждение: Cascade стирает связанные заявки, включая `ACCEPTED` (§13.1). |

\* `ThrottlerGuard` (дефолтный) дополнительно применяется на `PATCH /showcase/:id`, `/status`, `/bump`, `/renew` и `DELETE` для защиты от спама.

---

### 7.2. Матчинг (`MatchmakingController` -\> `/api/v1/matchmaking`)

| Метод | URL | Guard | Описание |
| --- | --- | --- | --- |
| `GET` | `/matchmaking/requests/unread-count` | `JwtAuthGuard` | Возвращает количество входящих заявок в статусе `PENDING` для бейджа в шапке. |
| `POST` | `/matchmaking/requests` | `JwtAuthGuard` + `Throttler` | Отправка заявки на интервью по `targetCardId`. Проверки: self-invite, лимит 10 `PENDING` входящих, лимит 5 исходящих, cooldown per-author, авто-матч (§8.2). |
| `GET` | `/matchmaking/requests/incoming` | `JwtAuthGuard` | Список входящих заявок пользователя (с пагинацией и фильтром по `status`). Контакты маскируются до `ACCEPTED`. |
| `GET` | `/matchmaking/requests/outgoing` | `JwtAuthGuard` | Список отправленных заявок пользователя. `rejectReason` виден отправителю. |
| `POST` | `/matchmaking/requests/:id/accept` | `JwtAuthGuard` | Принятие заявки получателем (`status -> ACCEPTED`). Атомарно: `updateMany` по `{ id, receiverId, status: PENDING }` (§8.2.7). Публикация в Redis в `try/catch` (§8.3). Другие заявки остаются в `PENDING`. |
| `POST` | `/matchmaking/requests/:id/reject` | `JwtAuthGuard` | Отклонение заявки с опциональной причиной `rejectReason`. Включает Cooldown 24ч per-author. |
| `POST` | `/matchmaking/requests/:id/cancel` | `JwtAuthGuard` | Отмена отправленной заявки инициатором (`status -> CANCELLED`), **только из `PENDING`**. Повторная отправка после cancel — сразу. |

---

## 8. Полный набор бизнес-правил и защитных механизмов

### 8.1. Правила карточек витрины:

1. **Требование к профилю:** Создавать карточки и отправлять заявки могут только пользователи с заполненными `displayName` (\>= 2 символов) и `username`. Иначе — `400 Bad Request: "Заполните имя и юзернейм в профиле"`.
2. **Лимит активных карточек:** Максимум **5 активных карточек** на одного пользователя (`400 Bad Request`). Проверка выполняется в `$transaction` вместе с созданием (защита от гонок).
3. **Уникальность роли:** Запрещено иметь более 1 активной карточки с одинаковой комбинацией `(specialization, level)` (`409 Conflict: "У вас уже есть активная карточка с такой специализацией и уровнем"`). На уровне БД — partial unique index `unique_active_user_specialization_level`; ошибка Prisma `P2002` маппится в `409`.
4. **Срок жизни 15 дней и `autoRenew`:**
   * Каждая карточка создается со сроком `expiresAt = now() + 15 days`.
   * Cron-воркер `ShowcaseCronService` каждые 15 минут проверяет карточки с `expiresAt <= now()`:
     * Если `autoRenew === true` -\> `expiresAt = now() + 15 days`, `bumpedAt = now()`, `status = ACTIVE`.
     * Если `autoRenew === false` -\> `status = EXPIRED`.
   * Воркер работает идемпотентно и защищён распределённым локом (§8.4).
5. **Поднятие в топ (Bump):** Вызов `POST /showcase/:id/bump` атомарен: `updateMany({ where: { id, bumpedAt: { lte: now - 24h } }, data: { bumpedAt: now() } })`. Если обновлено 0 строк — `400 Bad Request: "Поднять карточку можно будет через X часов"` (X — остаток до 24ч от текущего `bumpedAt`).
6. **Перевыставление (`renew`):** Только из `EXPIRED` (`EXPIRED -> ACTIVE`, `expiresAt = now() + 15d`, `bumpedAt = now()`):
   * `renew` для `ACTIVE`/`INACTIVE` — `400 Bad Request`;
   * владелец с `deletedAt` (soft-delete) — `400 Bad Request`;
   * занятая пара `(specialization, level)` другой активной карточкой — `409` (`P2002`).
7. **`INACTIVE -> ACTIVE` (через `PATCH /status`):** запрещён, если `expiresAt <= now()` (карточка должна пройти `renew`). При активации перепроверяется уникальность пары `(specialization, level)`.
8. **Права доступа:** изменения карточки (`PATCH`, `/status`, `/bump`, `/renew`, `DELETE`) — только автор. `GET /showcase/:id` для не-автора отдаёт только `ACTIVE` и неистекшие карточки (иначе `404`).

### 8.2. Правила матчинга и заявок:

1. **Запрет Self-invite:** Нельзя откликнуться на свою карточку (`targetCard.userId === currentUser.id -> 400 Bad Request`).
2. **Лимит входящей очереди (Backpressure):** Нельзя отправить заявку на карточку, у которой уже есть **10 заявок в статусе `PENDING`** (`400 Bad Request: "У данного кандидата максимальное количество ожидающих заявок. Попробуйте позже"`). Проверка и создание — в `$transaction`.
3. **Лимит исходящих заявок:** Максимум **5 активных (`PENDING`) исходящих заявок** одновременно (`429 Too Many Requests`).
4. **Cooldown 24 часа после отклонения (per-author):** Если автор отклонил заявку (`REJECTED`), отправитель блокируется от новых заявок **этому автору — то есть к любой из его карточек** на 24 часа (`400 Bad Request: "Пользователь отклонил недавний запрос. Повторная отправка доступна через 24 часа"`). Проверка: последний `REJECTED` с `senderId = текущий пользователь` и `receiverId = targetCard.userId`, `createdAt >= now() - 24h`. Опорный индекс: `(receiverId, status, createdAt)`. Исключение: после `CANCELLED` инициатором повторная отправка доступна сразу.
5. **Встречные заявки (Auto-match):** Если **А** отправил заявку **Б**, а **Б** отправляет встречную заявку **А**, система в одной транзакции переводит **обе** заявки в `ACCEPTED` и публикует **два** события (§8.3). Контакты открываются с обеих сторон.
6. **Авто-экспирация заявок (72 часа):** Все `PENDING` заявки старше 72 часов автоматически переводятся в `EXPIRED` через `MatchmakingCronService` (раз в час, пакетно, идемпотентно, с распределённым локом, §8.4).
7. **Принятие заявки (Accept, атомарно):** Принимать может только получатель, и только из `PENDING`. Операция атомарна: `updateMany({ where: { id, receiverId, status: 'PENDING' }, data: { status: 'ACCEPTED' } })`; если обновлено 0 строк — `404`/`409` (заявка не найдена или уже обработана). Повторный accept (double-click) не создаёт двойных событий. Принятие одной заявки **НЕ отменяет** другие входящие заявки на эту же карточку — автор может провести несколько собеседований в разное время.
8. **Приватность контактов:** `telegramUsername` и `gitUrl` в `PublicUserCardDto` публикуются только стороне подтверждённого матча. Во всех остальных запросах (`GET /showcase`, `/showcase/my`, `/showcase/:id`, списки заявок) возвращаются `null`. Маппинг — в сервисе по `currentUserId`. Исключений нет: контакты «открываются» только после `ACCEPTED`.

### 8.3. Интеграция с Redis Pub/Sub

При успешном `ACCEPT` заявки в канал `matchmaking:events` публикуется событие. При auto-match (§8.2.5) публикуются **два** события — по одному на каждую принятую заявку:

```json
{
  "event": "match.accepted",
  "requestId": "uuid",
  "senderId": "uuid",
  "receiverId": "uuid",
  "targetCardId": "uuid",
  "senderCardId": "uuid | null",
  "preferredTopic": "Go Concurrency & Channels",
  "timestamp": "2026-08-30T18:00:00.000Z"
}
```

Публикация оборачивается в `try/catch` (паттерн `deactivateAccount` в `users.service.ts`): недоступность Redis **не** фейлит `accept` — событие логируется и пропускается, клиенту возвращается успех.

### 8.4. Распределённые блокировки Cron

`ShowcaseCronService` (каждые 15 минут) и `MatchmakingCronService` (каждый час) идемпотентны и безопасны на нескольких репликах: перед запуском захват Redis-лока через `setNx` (ключи `lock:cron:showcase`, `lock:cron:matchmaking`, паттерн `UserCleanupCron`); при занятом локе — пропуск запуска (`return 0`); освобождение лока в `finally`.

---

## 9. Структура файлов в репозитории

```
apps/api/src/modules/
├── showcase/
│   ├── showcase.module.ts
│   ├── showcase.controller.ts
│   ├── showcase.controller.spec.ts
│   ├── showcase.service.ts
│   ├── showcase.service.spec.ts
│   └── showcase-cron.service.ts       // Авто-продление 15 дней / EXPIRED
└── matchmaking/
    ├── matchmaking.module.ts
    ├── matchmaking.controller.ts
    ├── matchmaking.controller.spec.ts
    ├── matchmaking.service.ts
    ├── matchmaking.service.spec.ts
    └── matchmaking-cron.service.ts    // Экспирация заявок 72h

packages/dto/src/
├── showcase/
│   ├── showcase.enums.ts
│   ├── search-parser.ts
│   ├── search-parser.spec.ts
│   ├── manage-showcase-card.dto.ts
│   ├── showcase-query.dto.ts
│   └── showcase-response.dto.ts
└── matchmaking/
    ├── matchmaking.dto.ts
    └── match-request-response.dto.ts
```

*Примечание:* для валидации query-схем (`ShowcaseQueryDto`, `MatchRequestQueryDto`) добавляется новый пайп `apps/api/src/common/pipes/zod-query.pipe.ts` — аналог `ZodValidationPipe` для `@Query`. Он же используется и другими доменами в дальнейшем.

---

## 10. План тестирования (Unit Test Cases)

### 10.1. `search-parser.spec.ts`

* [ ] Корректно извлекает `include` токены (`+react`, `+nest`).
* [ ] Корректно извлекает `exclude` токены (`-vue`, `-angular`).
* [ ] Корректно извлекает обычные слова поиска (`middle`, `frontend`).
* [ ] Ограничивает разбор 10 токенами (защита от DoS).
* [ ] Экранирует спецсимволы SQL (`%`, `_`, `\`).
* [ ] Удаляет HTML-теги (`stripHtmlTags`).
* [ ] Edge-кейсы: голые `+` / `-`, `++react`, `-react` без пробела.
* [ ] Control-символы отбрасываются (`stripControlChars`).
* [ ] Токен длиннее 50 символов отбрасывается.
* [ ] Строгий разбор `isUrgent=false` → `false` в query-схеме (без `z.coerce.boolean()`).

### 10.2. `ShowcaseService` и `ShowcaseCronService`

* [ ] **`createCard (Prerequisites)`**: Ошибка `BadRequestException`, если `displayName` или `username` отсутствуют.
* [ ] **`createCard (Success)`**: Создание карточки на 15 дней (`status = ACTIVE`, `language = RU`).
* [ ] **`createCard (Duplicate Role)`**: Ошибка `ConflictException` (маппинг `P2002`) при создании второй активной карточки на ту же комбинацию `specialization + level`.
* [ ] **`createCard (Limit 5)`**: Ошибка при попытке создать 6-ю активную карточку.
* [ ] **`findAll (Operators & Filters)`**: Фильтрация по `+react -vue`, языку `language`, флагу `isUrgent` и сортировка `sortBy`.
* [ ] **`findAll (Privacy)`**: `telegramUsername`/`gitUrl` = `null`, если просматривающий не сторона `ACCEPTED`-матча с владельцем.
* [ ] **`findById (Access)`**: Не-автор не видит карточки c `INACTIVE`/`EXPIRED` или истёкшим `expiresAt` (`404`).
* [ ] **`bumpCard`**: Успешное поднятие в топ; ошибка при повторном поднятии ранее 24 часов; атомарность (`updateMany` + count) при параллельных запросах.
* [ ] **`renewCard`**: `EXPIRED -> ACTIVE` с обновлением срока на 15 дней; `400` для `ACTIVE`/`INACTIVE`; `400` при владельце c `deletedAt`; `409` при занятой паре `(specialization, level)`.
* [ ] **`updateStatus`**: `INACTIVE -> ACTIVE` запрещён при истёкшем `expiresAt`.
* [ ] **`cronHandleExpiredCards`**: Продление карточек с `autoRenew = true` и перевод в `EXPIRED` с `autoRenew = false`; distributed lock (занятый лок — пропуск).

### 10.3. `MatchmakingService`

* [ ] **`getUnreadCount`**: Возвращает точное число входящих `PENDING` заявок.
* [ ] **`createRequest (Success)`**: Создание заявки со статусом `PENDING`, `expiresAt = now() + 72h`.
* [ ] **`createRequest (Queue Limit 10)`**: Ошибка, если у карточки уже 10 входящих `PENDING` заявок.
* [ ] **`createRequest (Self-invite)`**: Ошибка при попытке откликнуться на свою карточку.
* [ ] **`createRequest (Cooldown 24h, per-author)`**: Ошибка, если менее 24ч назад автор (любая его карточка, `receiverId`) отклонил заявку этому отправителю.
* [ ] **`createRequest (Cooldown not blocking after Cancel)`**: После `CANCELLED` повторная отправка доступна сразу.
* [ ] **`createRequest (Cross-invite)`**: При встречном инвайте в одной транзакции принимаются **обе** заявки и публикуются **два** события.
* [ ] **`acceptRequest`**: Атомарный переход в `ACCEPTED` (только receiver, только `PENDING`); повторный вызов не дублирует события; публикация в Redis в `try/catch`; другие заявки остаются активными.
* [ ] **`rejectRequest`**: Перевод в `REJECTED` с сохранением `rejectReason`.
* [ ] **`cancelRequest`**: Перевод в `CANCELLED` отправителем, только из `PENDING`.
* [ ] **`Privacy`**: `telegramUsername`/`gitUrl` маскируются для не-участников `ACCEPTED`-матча во всех ответах.
* [ ] **`cronExpireRequests`**: Пакетный перевод просроченных заявок в `EXPIRED`; distributed lock.

---

## 11. Критерии приемки (Definition of Done)

* [ ] 1\. Prisma-схема расширена (`InterviewLanguage`, `ShowcaseCardStatus`, `autoRenew`, `isUrgent`, `rejectReason`, `expiresAt`, `bumpedAt`, индексы и raw sql constraints, включая `(receiverId, status, createdAt)` для cooldown per-author).
* [ ] 2\. Миграция успешно создана и применена (`pnpm run db:migrate`), partial unique indexes добавлены вручную (`--create-only`) и применены.
* [ ] 3\. Реализован и протестирован парсер поисковой строки `parseSearchQuery` (+include, -exclude, max 100 симв / 10 токенов / 50 симв на токен, DoS sanitization, control chars).
* [ ] 4\. Пакет `@packages/dto` собран (`pnpm --filter @packages/dto build`) и типизирован (`typecheck`); `isUrgent` разбирается строго (`"false"` → `false`).
* [ ] 5\. Реализованы `ShowcaseModule` и `MatchmakingModule` с защитой эндпоинтов и подключением в `AppModule`.
* [ ] 6\. Реализованы фоновые воркеры `ShowcaseCronService` (15 дней TTL / autoRenew) и `MatchmakingCronService` (72ч TTL) с distributed lock (§8.4).
* [ ] 7\. Документация OpenAPI/Swagger проверена в `/api/docs`; новая query-валидация через `zod-query.pipe`.
* [ ] 8\. Unit-тесты для обоих модулей написаны (покрытие \>= **85%**), включая тесты приватности контактов, auto-match обеих сторон, cooldown per-author, P2002→409, атомарного bump/accept и lock'ов cron.
* [ ] 9\. Команды `pnpm lint` и `pnpm test:api` выполняются без ошибок.
* [ ] 10\. Вся логика строго ограничена спецификацией без перехода к WebRTC/сессиям.
* [ ] 11\. Приватность контактов (US-6): `telegramUsername`/`gitUrl` не публикуются до `ACCEPTED`.
* [ ] 12\. Осознанные трейдоффы задокументированы (§13) и согласованы командой (PMC).
* [ ] 13\. Спека и план обновлены и версионированы (Changelog), изменения прошли ревью по `docs/pull-request.md`.

---

## 12. Changelog

### v2.0.0 (2026-09-02)

Ревью спеки и интеграция рекомендаций (см. план [`exhibitor-showcase-matchmaking-plan.md`](./exhibitor-showcase-matchmaking-plan.md)).

* **Приватность контактов (критично):** `telegramUsername`/`gitUrl` публикуются только стороне `ACCEPTED`-матча; US-6, §5.6, §8.2.8, §10.
* **Атомарность:** `bump` и `accept` через `updateMany` с условиями; create карточки/заявки в `$transaction`; маппинг `P2002` → `409` (§8.1.3, §8.1.5, §8.2.7).
* **Cooldown 24ч — per-author** (все карточки автора) + индекс `(receiverId, status, createdAt)`; после `CANCELLED` повторная отправка сразу (§8.2.4).
* **Auto-match:** встречные заявки принимаются **обе** в одной транзакции + два события (§8.2.5, §8.3).
* **Cron + distributed lock** (§8.4); Redis publish в `try/catch` (§8.3).
* **Zod-фиксы:** `isUrgent` без `z.coerce.boolean()`; `skills` не очищаются до `[]`; парсер: control chars, лимит 50 симв/токен, удалён неиспользуемый `raw`.
* **Права доступа и предикаты:** `renew`/`status`/`GET /showcase/:id` — явные правила (§8.1.6–8.1.8, §7.1).
* **DoD** расширен до 13 критериев; добавлены разделы §12 (Changelog) и §13 (трейдоффы).

### v1.0.0 (первая черновая версия)

* Исходная версия спеки: модели, DTO, REST API, бизнес-правила, тест-план, DoD.

---

## 13. Задокументированные трейдоффы (решения PMC)

### 13.1. `onDelete: Cascade` на `MatchRequest.targetCard` (принято)

Решение PMC (план v1.0.0): каскад оставлен. Следствие: удаление карточки или окончательный purge аккаунта каскадно удаляет **все** связанные заявки, включая `ACCEPTED` (история матчей и «обмен контактами» стираются). При `DELETE /showcase/:id` фронтенд предупреждает пользователя о последствиях. При необходимости история матчей станет требованием — переходим на `SetNull` + гашение только `PENDING`.

### 13.2. Производительность поиска (`ILIKE %term%`)

`contains`/`mode: insensitive` формирует `ILIKE '%term%'` — ведущий wildcard исключает использование индекса для `title`/`bio`/`displayName`. GIN по `skills` покрывает только точное `has`. Для MVP приемлемо; при росте объёма — `pg_trgm` GIN или полнотекстовый поиск (`tsvector`).

### 13.3. Защита от XSS через `stripHtmlTags`

Регекс-стрип тегов — базовая защита: не обрабатывает `&lt;script&gt;`, `javascript:`-URL и вложенные векторы. Фронтенд **обязан** экранировать контент при рендере. Дополнительно парсер отбрасывает control-символы. При появлении rich-text — заменить на библиотеку-санитайзер (например `sanitize-html`).

### 13.4. Нейминг колонок: camelCase (единообразно с `users`)

Колонки новых таблиц `showcase_cards`/`match_requests` — **camelCase** без `@map`, единообразно с существующей таблицей `users`. Названия таблиц — snake_case во множественном числе через `@@map` (конвенция базы `docs/backend/data/database-prisma.md`).

### 13.5. Семантика обычных терминов поиска — пересечение (AND)

Термины без оператора применяются как `AND` (все обязаны совпасть). «Нестрогий» в §2.2 относится к размытому совпадению полей (ILIKE), а не к булевой логике. При необходимости нечёткого ранжирования — перейти на `pg_trgm` similarity/ранжирование (см. 13.2).