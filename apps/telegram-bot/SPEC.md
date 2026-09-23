# Спецификация — Telegram Bot (`apps/telegram-bot`)

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.0.0 | 2026-09-16 | Заменена ревью (1.0.1) |
| 1.0.1 | 2026-09-20 | Заменена ревью (1.0.2) |
| 1.0.2 | 2026-09-20 | Заменена ревью (1.0.3) |
| 1.0.3 | 2026-09-20 | Актуальный |

## Связанные документы

- Архитектура сервиса: `docs/TELEGRAM_BOT_ARCHITECTURE.md`
- Спецификация backend: `apps/api/SPEC.md`
- План реализации: `apps/telegram-bot/PLAN.md`

---

## 1. Назначение

Реализовать сервис `apps/telegram-bot` — персональный ассистент платформы **MockInterviewAI** в Telegram.

Данная версия спецификации (v1.0.0) покрывает:

1. инициализацию `apps/telegram-bot` в монорепо (Turborepo / pnpm workspace);
2. подключение к Telegram Bot API через **grammY**;
3. привязку аккаунта по `/start <token>` через `POST /api/v1/telegram/link`;
4. интерактивные команды `/interviews`, `/me`, `/unlink`, `/lang`;
5. интеграцию переводов из `@packages/i18n`.

Сервис полностью изолирован от PostgreSQL: вся работа с данными и бизнес-логика сосредоточены в `apps/api`. Бот вызывает внутренние эндпоинты `apps/api` по REST с сервисным ключом (`X-Internal-Service-Key`).

**Вне области v1.0.0** (будущие версии): push-уведомления через RabbitMQ (`telegram.notifications`), `/settings` (категории уведомлений), кнопка «Подключить Telegram» в `apps/web`.

---

## 2. Технологический стек

| Область | Решение |
|---|---|
| Рантайм | Node.js >= 20.6, TypeScript (strict) |
| Монорепо | Turborepo + pnpm workspace |
| Telegram Bot Framework | `grammY` (strict typing, `session`, `InlineKeyboard`, `webhookCallback`) |
| Режим получения updates | Long Polling (dev) / Webhook (prod) |
| Локализация | `@packages/i18n` (namespaces `ru`/`en`, файлы `telegram.json`) |
| Контракты/валидация DTO | `@packages/dto` (zod) |
| Серверный API (внутренние endpoints) | NestJS (apps/api): `TelegramModule` |
| Внутренняя аутентификация | Header `X-Internal-Service-Key` |
| Хранение одноразовых токенов привязки | Redis (apps/api), TTL 15 мин |
| Линтинг/форматирование | Biome (корневой конфиг) |
| Тесты | Vitest (бот), Jest (apps/api unit/e2e) |

---

## 3. Архитектура модулей

### 3.1. `apps/telegram-bot`

```
apps/telegram-bot/
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts          # bootstrap: bot + режим polling/webhook + graceful shutdown
    ├── config.ts         # парсинг и валидация env (zod)
    ├── bot.ts            # создание Bot, регистрация middleware и команд
    ├── api-client.ts     # HTTP-клиент к apps/api (X-Internal-Service-Key, ApiError, timeout)
    ├── i18n.ts           # resolveLocale() и t() на базе @packages/i18n
    ├── types.ts          # типы ответов внутреннего API (DTO)
    └── handlers/
        ├── start.ts      # /start [token]
        ├── me.ts         # /me
        ├── interviews.ts # /interviews
        ├── unlink.ts     # /unlink
        └── lang.ts       # /lang (+ callback-кнопки ru/en)
```

### 3.2. `apps/api` (дополнение)

```
apps/api/src/modules/telegram/
├── telegram.module.ts
├── telegram.controller.ts
├── telegram.service.ts
└── guards/
    └── internal-service-key.guard.ts
```

### 3.3. Пакеты

```
packages/dto/src/telegram/
├── link.dto.ts            # linkRequestSchema, linkTokenResponseSchema
├── unlink.dto.ts          # unlinkRequestSchema, unlinkResponseSchema
├── profile.dto.ts         # telegramProfileQuerySchema, TelegramUserProfileDto
├── interviews.dto.ts      # telegramInterviewsQuerySchema, TelegramInterviewDto, TelegramInterviewsListDto
└── preferences.dto.ts     # telegramPreferencesPatchSchema

packages/i18n/src/locales/
├── ru/telegram.json       # NEW
└── en/telegram.json       # NEW
```

---

## 4. Интеграция в монорепо

- **Workspace**: `pnpm-workspace.yaml` содержит glob `apps/*` — новое приложение покрывается автоматически.
- **Имя пакета**: `@apps/telegram-bot` (по образцу `@apps/realtime`).
- **Корневые скрипты** (`package.json`):
  - `dev:telegram-bot` → `turbo dev --filter=@apps/telegram-bot`;
  - `build:telegram-bot` → `turbo build --filter=@apps/telegram-bot`.
- **Зависимости**: `grammY`, `@packages/i18n` (workspace:*), `@packages/dto` (workspace:*, типы и zod-схемы). Dev: `tsx`, `typescript`, `vitest`, `@types/node`, `@biomejs/biome@2.4.2`.
- **`turbo.json`**: задач `dev`/`build`/`test` менять не требуется — они уже декларированы глобально; `build` бота — typecheck (`tsc --noEmit`), выходные артефакты не создаются (запуск через `tsx`).
- **Границы пакетов**: `apps/*` не импортируются в `packages/*`; бот не обращается к `@packages/api` — внутренние вызовы выполняются напрямую по `API_INTERNAL_URL` (эндпоинты скрыты из публичной OpenAPI, см. §8).

Скрипты пакета:

| Скрипт | Команда | Назначение |
|---|---|---|
| `dev` | `tsx watch --env-file=.env src/index.ts` | Разработка (auto-restart) |
| `start` | `tsx --env-file=.env src/index.ts` | Запуск (rust runtime, компиляция TS на лету) |
| `build` | `tsc --noEmit` | Gate: typecheck в `turbo build` |
| `typecheck` | `tsc --noEmit` | Проверка типов |
| `lint` | `biome check --no-errors-on-unmatched` | Линтинг |
| `test` | `vitest run` | Юнит-тесты |

---

## 5. Подключение к Telegram Bot API (grammY)

- Создание бота: `new Bot<TgContext>(env.TELEGRAM_BOT_TOKEN)`.
- `TgContext` — типизированный грамми-контекст с `session` (персист локали, §12) и `from.language_code`.
- Сессия grammY — in-memory (`MemorySessionStorage` по умолчанию): transient-локаль §10.2 живёт в памяти процесса и теряется при рестарте/нескольких инстансах. Для v1.0.0 (одна реплика) это приемлемо; мульти-инстансный деплой — «Вне области».
- **Режим получения updates** определяется наличием `TELEGRAM_WEBHOOK_URL`:
  - `TELEGRAM_WEBHOOK_URL` не задан (dev) → **Long Polling**: `bot.start({ drop_pending_updates: true })`;
  - `TELEGRAM_WEBHOOK_URL` задан (prod) → **Webhook**: `bot.api.setWebhook(url, { secret_token })` + `webhookCallback(bot, "http", { secretToken })` на внутреннем HTTP-сервере (порт `TELEGRAM_WEBHOOK_PORT`, путь `/telegram/webhook`).
  - **`secretToken` обязателен и в `setWebhook`, и в `webhookCallback`**: без опции `secretToken` grammY принимает **любые** updates (constant-time сравнение `X-Telegram-Bot-Api-Secret-Token` пропускается, когда токен не задан), т.е. webhook-эндпоинт аутентифицирует только сам факт поступления от Telegram. Оба значения берутся из `TELEGRAM_WEBHOOK_SECRET` (§12.1).
  - **Ошибки webhook не роняют процесс**: отклонение Promise от `webhookCallback` (битый JSON, ошибка чтения, timeout) логируется, и если ответ ещё не отправлен — возвращается `500`; сервер продолжает работу.
- **Graceful shutdown** по SIGTERM/SIGINT: `bot.stop()`.
- Среды обмена сообщениями: `ctx.reply`, `InlineKeyboard` (кнопки-ссылки и callback).

---

## 6. Поток привязки аккаунта (`/start <token>`)

```
apps/web (ЛК)          apps/api                        Telegram          apps/telegram-bot
────────────           ───────                         ────────          ────────────────
 POST /telegram/link-token (Bearer)
        │  → generate rawToken, Redis tg:link:{sha256(rawToken)}=userId (TTL 15m)
        │  ← { linkUrl: "https://t.me/{username}?start={rawToken}" }
 человек открывает ссылку
        │  → /start {rawToken} --------------------------------------►
        │                    POST /telegram/link {token, chatId} (X-Internal-Service-Key)
        │        GETDEL tg:link:{sha256(token)} → найден (одноразово)
        │        UPDATE users SET telegramChatId=..., telegramLocale=null
        │        ← 200 { TelegramUserProfileDto }
        │  ← reply "start.linked" (i18n)
```

### 6.1. Генерация токена — `POST /api/v1/telegram/link-token`

- Auth: **Bearer access-token** (глобальный `AccessTokenGuard`, §64 `apps/api/SPEC.md`).
- Тело запроса отсутствует.
- Алгоритм:
  1. `rawToken = randomBytes(24).toString("hex")` — 48 символов из набора `[0-9a-f]`, допустимого для deep-link параметра `?start=` Telegram (алфавит `A-Za-z0-9_-`, лимит 64 символа);
  2. `tokenHash = createHash("sha256").update(rawToken).digest("hex")` — в Redis хранится **только хеш** токена (компрометация Redis не раскрывает raw-токен; паттерн `resetPassword` в `AuthService`), поэтому `?start={rawToken}` принимает пригодный для Telegram короткий параметр;
  3. `RedisService.set("tg:link:" + tokenHash, JSON.stringify({ userId }), TELEGRAM_LINK_TTL_SECONDS)` (default 900);
  4. ответ `200 { linkUrl }`.
- `linkUrl = "https://t.me/{TELEGRAM_BOT_USERNAME}?start={rawToken}"`.

### 6.2. Привязка — `POST /api/v1/telegram/link`

- Auth: **`X-Internal-Service-Key`** (§8).
- Body: `{ token, chatId }` (zod-схема `linkRequestSchema`; `token` — строка `min(1).max(64)` — лимит deep-link `?start=` Telegram; `chatId` — строка `min(1).max(32)` — лимит против абъюза Redis-ключей).
- Алгоритм:
  1. `tokenHash = SHA256(token)` — raw-токен из `/start` приводится к хешу для поиска в Redis;
  2. Атомарное чтение и удаление ключа `tg:link:{tokenHash}` через Redis `GETDEL` (single-use, паттерн `resetPassword`; одновременные `/start` с одним токеном обрабатываются корректно) → ключ отсутствует → `410 Gone` (токен истёк или уже использован);
3. извлечь `userId` из значения;
   4. проверить `User` по `userId` (удалённый аккаунт `deletedAt != null` → `410 Gone`);
   5. если у пользователя уже задан `telegramChatId` или он занят другим пользователем → `409 Conflict`;
   6. `UPDATE users SET telegramChatId = chatId` (catch Prisma `P2002` → `409`, защита от race);
   7. ответ `200 { TelegramUserProfileDto }`.
- Ошибки:

| Случай | Код |
|---|---|
| Успех | `200` + профиль |
| Токен не найден/использован/истёк | `410 Gone` |
| Пользователь уже привязан / chatId занят | `409 Conflict` |
| Невалидный body | `400 Bad Request` |
| Неверный/отсутствующий сервисный ключ | `401 Unauthorized` |

### 6.3. Поведение бота (handler `/start`)

| Ситуация | i18n-ключ | Ответ |
|---|---|---|
| `/start` без токена | `start.welcome` | Приветствие + подсказка получить ссылку в личном кабинете web |
| Успех привязки | `start.linked` | «Аккаунт привязан» + подсказка `/me`, `/interviews` |
| `409` | `start.alreadyLinked` | «Аккаунт уже привязан» + подсказка `/unlink` |
| `410` | `start.tokenExpired` | «Ссылка недействительна или истекла, получите новую в личном кабинете» |
| `400`/`401`/`5xx` | `start.linkError` | «Не удалось выполнить привязку, попробуйте позже» |
| Непредвиденная ошибка | `errors.unexpected` | Generic сообщение (без внутренних деталей) |

---

## 7. Внутренние эндпоинты `apps/api` (`/api/v1/telegram/*`)

Все эндпоинты, кроме `link-token`, аутентифицируются сервисным ключом (`X-Internal-Service-Key`, §8) и скрыты из публичной OpenAPI через `@ApiExcludeController()` (модуль — `TelegramModule`, tag `telegram-internal`).

**Важно (NestJS guard-стек):** глобальный `AccessTokenGuard` (APP_GUARD) отклоняет любой не-`@Public()` роут без Bearer-токена (`401 Missing access token`), а `@UseGuards` на хендлере его не отменяет. Бот шлёт только `X-Internal-Service-Key`, поэтому на 5 эндпоинтах ниже обязателен **`@Public()`** (обход `AccessTokenGuard`) в паре с `@UseGuards(InternalServiceKeyGuard)`. Без `@Public()` вызовы бота будут отклонены глобальным guard'ом.

| Метод | Путь | Auth | Request | Response (успех) |
|---|---|---|---|---|
| `POST` | `/telegram/link-token` | Bearer (`AccessTokenGuard`) + `AuthThrottlerGuard` | — | `200 { linkUrl }` |
| `POST` | `/telegram/link` | Service Key + `@Public()` | `{ token, chatId }` | `200 TelegramUserProfileDto` |
| `POST` | `/telegram/unlink` | Service Key + `@Public()` | `{ chatId }` | `200 { success: true }` |
| `GET` | `/telegram/profile` | Service Key + `@Public()` | `?chatId={id}` | `200 TelegramUserProfileDto` |
| `GET` | `/telegram/interviews` | Service Key + `@Public()` | `?chatId={id}` | `200 TelegramInterviewsListDto` |
| `PATCH` | `/telegram/preferences` | Service Key + `@Public()` | `{ chatId, locale }` | `200 TelegramUserProfileDto` |

> Rate limiting: глобальный `ThrottlerGuard` в `apps/api` **не** зарегистрирован (`APP_GUARD` только `AccessTokenGuard`/`RolesGuard`/`OriginCheckGuard`) — limiter применяется per-route. `link-token` покрывается `AuthThrottlerGuard` (tracker по IP, §41 `apps/api/SPEC.md`); service-key эндпоинты ограничиваются одним потребителем (бот) и не троттлятся.

### 7.1. `POST /telegram/unlink`

- Body: `{ chatId }`.
- Алгоритм: `UPDATE users SET telegramChatId = null, telegramLocale = null WHERE telegramChatId = chatId`; если не затронуто строк → `404 NotFound` («чат не привязан»). Идемпотентно-безопасно (повторный unlink после успеха → `404`). Локаль очищается вместе с привязкой — при следующем `/start` она определяется заново (§10.2).
- Ответ: `200 { success: true }`.

### 7.2. `GET /telegram/profile`

- Query: `chatId`.
- Алгоритм: `findUnique user where telegramChatId = chatId`; не найден или `deletedAt` установлен (аккаунт удалён) → `404`.
- Ответ — `TelegramUserProfileDto`:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "displayName": "John Doe",
  "username": "johndoe",
  "telegramUsername": "@johndoe",
  "telegramChatId": "123456789",
  "telegramLocale": "ru",
  "role": "USER"
}
```

`telegramLocale` — нормализованный двухбуквенный код (`ru`/`en`) или `null` (не задан → автоопределение, §12).

### 7.3. `GET /telegram/interviews`

- Query: `chatId`.
- Алгоритм:
  1. найти `User` по `telegramChatId` → не найден → `404`;
  2. выбрать сессии пользователя: владение (`InterviewSession.userId = user.id`) или участие (`InterviewParticipant.userId = user.id`), статус `CREATED`/`ACTIVE`, без завершённых (`CLOSED`);
  3. `orderBy: createdAt desc`, лимит `take: 10`.
- Ответ — `TelegramInterviewsListDto`:

```json
{
  "items": [
    {
      "id": "session-uuid",
      "status": "ACTIVE",
      "startedAt": "2026-09-17T10:00:00.000Z",
      "role": "INTERVIEWER",
      "createdAt": "2026-09-16T12:00:00.000Z"
    }
  ]
}
```

- `role`: для владельца сессии — `INTERVIEWER`, иначе роль из `InterviewParticipant` (`CANDIDATE`/`INTERVIEWER`/`OBSERVER`).

### 7.4. `PATCH /telegram/preferences`

- Body: `{ chatId, locale }`, где `locale ∈ { "ru", "en" }` (zod `enum`).
- Алгоритм: найти `User` по `telegramChatId` → не найден → `404`; `UPDATE users SET telegramLocale = locale`.
- Ответ: `200 TelegramUserProfileDto` (обновлённая локаль).

---

## 8. Аутентификация внутренних вызовов (`X-Internal-Service-Key`)

- Guard `InternalServiceKeyGuard` применяется на все `telegram/*`, кроме `link-token`.
- Эндпоинты под `InternalServiceKeyGuard` помечаются **`@Public()`** — глобальный `AccessTokenGuard` (APP_GUARD) иначе отклонит вызовы бота без Bearer-токена (§7). `RolesGuard` и `OriginCheckGuard` запросы без `@Roles`/`@RequirePermissions` и без Origin-заголовка пропускают.
- Проверка: заголовок `X-Internal-Service-Key` сравнивается с `INTERNAL_SERVICE_KEY` через `crypto.timingSafeEqual` (constant-time, защита от timing-атак).
- Отсутствие/несовпадение → `401 Unauthorized` без деталей.
- Ключ **не логируется** и не попадает в описания ошибок (входит в список запрещённых данных §46 `apps/api/SPEC.md`).
- Секрет задаётся в корневом `.env` (`INTERNAL_SERVICE_KEY`, min 32 символа) и в `apps/api/src/config/env.validation.ts`.

---

## 9. Модель данных (Prisma, `apps/api`)

В модель `User` добавляются два поля (одна миграция `add_telegram_bot_fields`):

```prisma
model User {
  // ... существующие поля
  telegramUsername String?
  telegramChatId   String?   @unique   // NEW: привязка чата Telegram (1 чат = 1 пользователь)
  telegramLocale   String?             // NEW: локаль из /lang ("ru" | "en"), null = авто
}
```

- `telegramChatId` — `@unique`: защита от повторной привязки на уровне БД (один чат ↔ один пользователь).
- `telegramLocale` — строка `"ru"`/`"en"` (валидация на уровне API), `null` — не задан.
- Дополнительных таблиц для v1.0.0 не создаётся: одноразовый токен живёт в Redis (эфемерный, TTL 15 мин), данные сессий берутся из существующих `InterviewSession` / `InterviewParticipant`.

---

## 10. Локализация (`@packages/i18n`)

Все тексты бота хранятся в общих файлах:

- `packages/i18n/src/locales/ru/telegram.json`
- `packages/i18n/src/locales/en/telegram.json`

Источник правды типов — `ru/telegram.json` (паттерн пакета, `types.ts`). В `index.ts` `messages` дополняется namespace `telegram`.

### 10.1. Структура `telegram.json`

```jsonc
{
  "start": {
    "welcome": "...",          // приветствие без токена
    "linked": "...",           // успешная привязка
    "linkedHint": "...",       // подсказка после успешной привязки
    "alreadyLinked": "...",    // 409
    "tokenExpired": "...",     // 410
    "linkError": "..."         // 400/401/5xx
  },
  "me": {
    "title": "...",
    "name": "...",
    "email": "...",
    "username": "...",
    "telegram": "...",
    "role": "...",
    "notLinked": "..."
  },
  "interviews": {
    "title": "...",
    "empty": "...",
    "joinButton": "...",
    "notLinked": "...",
    "unexpected": "..."
  },
  "unlink": {
    "success": "...",
    "notLinked": "...",
    "unexpected": "..."
  },
  "lang": {
    "select": "...",           // заголовок клавиатуры
    "ruLabel": "...",          // кнопка lang:ru
    "enLabel": "...",          // кнопка lang:en
    "changedRu": "...",
    "changedEn": "...",
    "current": "...",
    "persistError": "...",
    "notLinked": "..."
  },
  "errors": {
    "apiUnavailable": "...",
    "unexpected": "..."
  }
}
```

### 10.2. Определение языка пользователя (приоритет)

1. **Явный выбор `/lang`** — значение из `ctx.session.locale` (сессия grammY). Самый высокий приоритет.
2. **Локаль профиля** — `telegramLocale` из `GET /telegram/profile` (если аккаунт привязан и локаль задана).
3. **Автоопределение** — `ctx.from.language_code` из Telegram API: префикс `"ru"` → `ru`, иначе → `en`. Языки, отличные от `ru` (например `uk`, `kk`), обрабатываются как `en`; при отсутствии `language_code` — fallback `ru` (default locale пакета).

Резолвер `resolveLocale(locale?, profileLocale?, languageCode?): Locale` реализует данную цепочку и покрывается unit-тестами.

### 10.3. Использование

```ts
import { getMessages, type Locale, type TelegramMessages } from "@packages/i18n";

function t(locale: Locale, key: string): string {
  const messages: TelegramMessages = getMessages(locale).telegram;
  return (
    key.split(".").reduce<unknown>(
      (acc, part) => (acc as Record<string, unknown>)?.[part],
      messages,
    ) as string
  );
}
```

Типы словаря (`TelegramMessages = typeof ru/telegram.json`) гарантируют наличие ключей при обращении; отсутствующий ключ возвращается как есть (деградация без падения).

---

## 11. Интерактивные команды

### 11.1. `/start [token]`

См. §6.3. Команда доступна всегда (без привязки). Токен передаётся как текст после `/start`.

### 11.2. `/me`

- `GET /telegram/profile?chatId={id}` с сервисным ключом.
- Привязан → ответ:

```
Профиль:
Имя: ...
Email: ...
Username: ...
Telegram: ...
Роль: ...
```

- Не привязан (`404`) → `me.notLinked` (текст из i18n) + подсказка получить ссылку в web.
- API недоступен (`5xx`) → `errors.apiUnavailable`.

### 11.3. `/interviews`

- `GET /telegram/interviews?chatId={id}`.
- Не привязан (`404`) → `interviews.notLinked`.
- Пустой список → `interviews.empty`.
- Непустой → заголовок `interviews.title` + по одному пункту на сессию:

```
• Сессия #<shortId> — <role> (<status>)
```

и Inline-кнопка `interviews.joinButton` (URL) на каждую сессию: `{WEB_APP_URL}/dashboard/sandbox?room={id}` — страница комнаты сессии в `apps/web`. URL собирается в боте из `WEB_APP_URL` и константы `JOIN_PATH = "/dashboard/sandbox?room="`.
- **Зависимость**: роут `/dashboard/sandbox?room=` планируется в `docs/tasks/session-join-flow.md` и на момент v1.0.0 в `apps/web` **не реализован** (страница и фича `features/sandbox` отсутствуют). Кнопка будет вести на 404 до реализации веб-задачи — это известный gap вне scope бота; при появлении роута код бота не меняется. Проверка наличия роута — в Phase 8.

### 11.4. `/unlink`

- `POST /telegram/unlink {chatId}`.
- Успех → `unlink.success` («Telegram-аккаунт отвязан»).
- `404` (не привязан) → `unlink.notLinked`.
- Прямое действие, без подтверждающего шага (v1.0.0).

### 11.5. `/lang`

- Открывает инлайн-клавиатуру `lang:ru` / `lang:en` (callback-кнопки), заголовок `lang.select`.
- Callback `lang:{code}`:
  1. не привязан → `lang.notLinked` (персистентная локаль требует привязки; допустимо ответить и вернуть пользователя к `/me`/`/start`);
  2. `PATCH /telegram/preferences { chatId, locale }` → успех → `ctx.session.locale = code` + `lang.changedRu`/`lang.changedEn`;
  3. ошибка API → `lang.persistError`.
- Поддерживает также аргумент: `/lang ru`, `/lang en`.

---

## 12. Переменные окружения

### 12.1. Бот (`apps/telegram-bot/.env` и `.env.example`)

| Переменная | Обязательная | Дефолт | Описание |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | да (prod) | — | Токен бота от BotFather |
| `TELEGRAM_BOT_USERNAME` | нет | `MockInterviewBot` | Имя бота (используется для метаданных/ссылок) |
| `API_INTERNAL_URL` | да | `http://localhost:3001/api/v1` | Базовый URL внутреннего API |
| `INTERNAL_SERVICE_KEY` | да | — | Сервисный ключ (совпадает с `apps/api`) |
| `WEB_APP_URL` | да | `http://localhost:3000` | Базовый URL веб-приложения (ссылки на сессии) |
| `TELEGRAM_WEBHOOK_URL` | нет | — | Если задан → webhook-режим (prod); иначе long polling |
| `TELEGRAM_WEBHOOK_SECRET` | нет (да при webhook) | — | Секрет вебхука: передаётся в `setWebhook({ secret_token })` **и** в `webhookCallback(..., { secretToken })` (проверка `X-Telegram-Bot-Api-Secret-Token`) |
| `TELEGRAM_WEBHOOK_PORT` | нет | `8443` | Порт внутреннего HTTP-сервера для вебхука |
| `NODE_ENV` | нет | `development` | Окружение |

### 12.2. Дополнение к `apps/api`

| Переменная | Обязательная | Дефолт | Описание |
|---|---|---|---|
| `INTERNAL_SERVICE_KEY` | да | — | Секрет для `X-Internal-Service-Key` (≥ 32 симв.) |
| `TELEGRAM_BOT_USERNAME` | нет | `MockInterviewBot` | Имя бота для формирования `linkUrl` |
| `TELEGRAM_LINK_TTL_SECONDS` | нет | `900` | TTL одноразового токена привязки (15 мин) |

Переменные добавляются в `apps/api/src/config/env.validation.ts` и в корневой `.env.example`.

---

## 13. Безопасность

- **Одноразовость токена привязки**: атомарный Redis `GETDEL` (single-use, устойчив к параллельным `/start`), TTL 15 мин; повторное использование и использование после TTL → `410`.
- **`telegramChatId @unique`**: защита от повторной привязки на уровне БД (race-safe).
- **Поиск пользователя по `chatId` не раскрывает данных** без валидного `X-Internal-Service-Key`.
- **Сервисный ключ** сравнивается constant-time (`timingSafeEqual`), не логируется.
- **Запрещённые данные**: токены привязки, `INTERNAL_SERVICE_KEY`, `chatId`->секретные данные не логируются ботом и API; ошибки бота содержат только i18n-тексты без деталей.
- **Внутренние endpoints скрыты из публичной OpenAPI** (`@ApiExcludeController`): открыты только для сервиса-бота.
- **Webhook** защищён `TELEGRAM_WEBHOOK_SECRET`: заголовок `X-Telegram-Bot-Api-Secret-Token` проверяется в `webhookCallback` через `secretToken`-опцию (constant-time). Устанавливается и при `setWebhook`, и при приёме (§5).
- **`/me` раскрывает персональные данные** (email, displayName): допустимо — доступ к профилю получает только владелец привязанного чата (поиск по `chatId` + сервисный ключ §8); данные не отдаются третьим лицам.
- **Токен `link-token`** — `randomBytes(24)` → hex (48 символов: укладывается в лимит deep-link `?start=` Telegram — 64 символа, алфавит `A-Za-z0-9_-`). В Redis хранится только SHA-256 хеш токена (§6.1) — raw-токен невосстановим при компрометации Redis.
- **Токен привязки — «ключ от аккаунта»**: владелец `linkUrl` привязывает аккаунт к **своему** Telegram-чату. Митигации: TTL 15 мин, single-use (GETDEL), блокировка повторной привязки через `telegramChatId @unique` (409). `linkUrl` не должен публиковаться или пересылаться; получение чужого токена даёт только привязку чата к уже существующему аккаунту в пределах TTL.

---

## 14. Тестирование

### 14.1. `apps/api` (Jest)

- Unit `TelegramService`:
  - `link-token`: генерация raw-токена (hex ≤ 64 симв.), запись `sha256(token)` в Redis с TTL, `linkUrl` с raw-токеном в `?start=`;
  - `link`: успех (привязка + GETDEL ключа), токен отсутствует → `410`, повторное использование → `410` (GETDEL вернул `null`), `chatId` занят → `409`, аккаунт удалён → `410`;
  - `unlink`: успех (включая очистку `telegramLocale`), `404`;
  - `profile`: успех, `404`;
  - `interviews`: владелец/участник, пустой список, `404`;
  - `preferences`: успех, `404`, невалидная локаль → `400`;
- Unit `InternalServiceKeyGuard`: отсутствие/несовпадение ключа → `401`, совпадение → pass (constant-time), заголовок другой длины → `401` без `RangeError`.
- Unit `TelegramController`: на service-key эндпоинтах установлены `@Public()` и `InternalServiceKeyGuard`; на `link-token` — `AuthThrottlerGuard` (и отсутствие `@Public()`).
- E2E: full-flow `link-token → link → profile → unlink`; `link` без ключа → `401`, повторный `link` с тем же токеном → `410`.

### 14.2. Бот (Vitest)

- `resolveLocale`: приоритет `/lang`-локаль > локаль профиля > `language_code` > fallback `ru`;
- `api-client`: коррекция маппинга статусов в `ApiError` (409/410/404/5xx), передача `X-Internal-Service-Key`;
- handler-flow (mock `api-client`): `/start` без токена → `welcome`; успех → `linked`; `409` → `alreadyLinked`; `410` → `tokenExpired`; `/unlink` не привязан → `notLinked`.

### 14.3. Верификация (Phase 8 PLAN.md)

Команды и порядок — в `apps/telegram-bot/PLAN.md`.

---

## 15. Перечень файлов (манифест)

### Бот (`apps/telegram-bot`, все — новые)

- `package.json`
- `tsconfig.json`
- `.env.example`
- `src/index.ts`, `src/config.ts`, `src/bot.ts`, `src/api-client.ts`, `src/i18n.ts`, `src/types.ts`
- `src/handlers/start.ts`, `me.ts`, `interviews.ts`, `unlink.ts`, `lang.ts`
- `src/**/*.spec.ts`, `vitest.config.ts`

### `packages/i18n`

- [нов] `src/locales/ru/telegram.json`, `src/locales/en/telegram.json`
- [изм] `src/types.ts`, `src/index.ts`

### `packages/dto`

- [нов] `src/telegram/link.dto.ts`, `unlink.dto.ts`, `profile.dto.ts`, `interviews.dto.ts`, `preferences.dto.ts`
- [изм] `src/index.ts` (экспорт telegram-схем)

### `apps/api`

- [нов] `src/modules/telegram/telegram.module.ts`, `telegram.controller.ts`, `telegram.service.ts`, `guards/internal-service-key.guard.ts`
- [изм] `src/app.module.ts` (регистрация `TelegramModule`)
- [изм] `src/config/env.validation.ts` (`INTERNAL_SERVICE_KEY`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_LINK_TTL_SECONDS`)
- [нов] `src/modules/telegram/**/*.spec.ts`, `test/telegram-link.e2e-spec.ts`
- [изм] `prisma/schema.prisma` (+ миграция `add_telegram_bot_fields`)

### Конфигурация

- [изм] корневой `package.json` (`dev:telegram-bot`, `build:telegram-bot`)
- [изм] корневой `.env.example` (Telegram-переменные)

---

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.0.0 | 2026-09-16 | Первоначальная версия спецификации. |
| 1.0.1 | 2026-09-20 | Токен привязки: `randomBytes(24)` + SHA-256 в Redis вместо Argon2id-hex (лимит `?start=` 64 симв.); атомарный GETDEL для single-use; `unlink` очищает `telegramLocale`; join-URL → `/dashboard/sandbox?room={id}`; уточнён fallback локали и типизированный `t()`; документирована угроза «токен = ключ от аккаунта». |
| 1.0.2 | 2026-09-20 | Service-key эндпоинты — обязательный `@Public()` (глобальный `AccessTokenGuard` случайно 401-ит без Bearer; `@UseGuards` его не отменяет); `link-token` — per-route `AuthThrottlerGuard` (глобального `ThrottlerGuard`-APP_GUARD нет); уточнены тесты контроллера. |
| 1.0.3 | 2026-09-20 | Join-URL `/dashboard/sandbox?room=` — известная зависимость от `docs/tasks/session-join-flow.md` (в web пока не реализован); `secretToken` в `webhookCallback` обязателен (иначе grammY принимает любые updates); timeout api-client; лимиты `linkRequestSchema`; фиксация «/me раскрывает данные только владельцу чата»; in-memory сессия грамми — только одна реплика. |
