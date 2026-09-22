# План реализации — Telegram Bot (`apps/telegram-bot`)

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.0.0 | 2026-09-16 | Заменена ревью (1.0.1) |
| 1.0.1 | 2026-09-20 | Заменена ревью (1.0.2) |
| 1.0.2 | 2026-09-20 | Заменена ревью (1.0.3) |
| 1.0.3 | 2026-09-20 | Заменена ревью (1.0.4) |
| 1.0.4 | 2026-09-22 | Заменена ревью (1.0.5) |
| 1.0.5 | 2026-09-22 | Актуальный |

## Область v1.0.0

Scaffolding `apps/telegram-bot`, подключение к Telegram Bot API (grammY), `/start <token>` → `POST /api/v1/telegram/link`, команды `/interviews`, `/me`, `/unlink`, `/lang`, переводы из `@packages/i18n`.

**Вне области v1.0.0** (см. раздел «Вне области»): push-уведомления через RabbitMQ (`telegram.notifications`), `/settings`, веб-кнопка «Подключить Telegram».

---

## Phase 0 — Документация

- [x] Заполнить `apps/telegram-bot/SPEC.md` (назначение, архитектура, endpoints, i18n, env, безопасность, манифест).
- [x] Заполнить `apps/telegram-bot/PLAN.md` (этот документ).

## Phase 1 — Scaffolding `apps/telegram-bot`

- [x] Создать `apps/telegram-bot/package.json` (name `@apps/telegram-bot`, `"type": "module"`): scripts `dev` (`tsx watch --env-file=.env src/bot.ts`), `start` (`tsx --env-file=.env src/bot.ts`), `build` (`tsc --noEmit`), `typecheck` (`tsc --noEmit`), `lint` (`biome check --no-errors-on-unmatched`), `test` (`vitest run`). Флаг `--env-file=.env` (Node ≥ 20.6) грузит переменные без отдельной зависимости `dotenv`. Entry-файл — `src/bot.ts` (не `src/index.ts`): скрипты и `turbo`-задача `build` указывают на него.
- [x] Создать `tsconfig.json` — extends `../../tsconfig.base.json` (ES2022, `moduleResolution: Bundler`, strict); include `src`.
- [x] Создать `.env.example` (см. SPEC §12.1).
- [x] Создать `vitest.config.ts`.
- [x] Установить зависимости (из корня):

```bash
pnpm --filter @apps/telegram-bot add grammY @packages/i18n@workspace:* @packages/dto@workspace:*
pnpm --filter @apps/telegram-bot add -D tsx typescript vitest @types/node @biomejs/biome@2.4.2
```

- [x] Обновить корневой `package.json`: скрипты `dev:telegram-bot` → `dev:telegram-bot: turbo dev --filter=@apps/telegram-bot`, `build:telegram-bot` → `build:telegram-bot: turbo build --filter=@apps/telegram-bot`.
- [x] Обновить `lint-staged.config.mjs` — паттерн `apps/telegram-bot/**/*.{js,ts,json}` (при наличии файла).
- [x] Верификация scaffolding: `pnpm install` → `pnpm --filter @apps/telegram-bot typecheck` → `pnpm run lint`.

> **Примечание:** `turbo.json` изменений не требует — задачи `dev`/`build`/`test` уже декларированы глобально; билд бота — typecheck (`tsc --noEmit`), артефактов не создаёт (запуск через `tsx`).

## Phase 2 — Backend: Prisma-миграция и env (`apps/api`)

- [x] `apps/api/prisma/schema.prisma` — добавить в модель `User`:
  - `telegramChatId String? @unique`;
  - `telegramLocale String?`.
- [x] Миграция: `pnpm --filter api db:migrate:dev -- --name add_telegram_bot_fields`; `prisma generate`.
- [x] `apps/api/src/config/env.validation.ts` — добавить в zod-схему:
  - `INTERNAL_SERVICE_KEY: z.string().min(32)`;
  - `TELEGRAM_BOT_USERNAME: z.string().min(1).default("MockInterviewBot")`;
  - `TELEGRAM_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900)`.
- [x] Корневой `.env.example` — добавить блок `# Telegram Bot` с этими переменными.

## Phase 3 — Backend: `@packages/dto` (telegram-схемы)

- [x] Создать `packages/dto/src/telegram/`:
  - `link.dto.ts` — `linkRequestSchema` (`{ token, chatId }`; `token` — `string.min(1).max(64)` — лимит `?start=` Telegram; `chatId` — `string.min(1).max(32)` — защита от абъюза Redis-ключей), `linkTokenResponseSchema` (`{ linkUrl }`);
  - `unlink.dto.ts` — `unlinkRequestSchema` (`{ chatId }`), `unlinkResponseSchema` (`{ success: true }`);
  - `profile.dto.ts` — `telegramProfileQuerySchema` (`{ chatId }`), `telegramUserProfileSchema` (id, email, displayName, username, telegramUsername, telegramChatId, telegramLocale, role) + тип `TelegramUserProfileDto`;
  - `interviews.dto.ts` — `telegramInterviewsQuerySchema`, `telegramInterviewSchema` (id, status, startedAt, role, createdAt), `telegramInterviewsListSchema` (`{ items }`);
  - `preferences.dto.ts` — `telegramPreferencesPatchSchema` (`{ chatId, locale: z.enum(["ru", "en"]) }`).
- [x] Экспортировать схемы и типы из `packages/dto/src/index.ts`.
- [x] Тесты dto: валидные/невалидные payload по каждой схеме (сообщения на русском, §63 `apps/api/SPEC.md`).
- [x] `pnpm --filter @packages/dto test && pnpm --filter @packages/dto typecheck && pnpm --filter @packages/dto build`.

## Phase 4 — Backend: `TelegramModule`

- [x] `apps/api/src/modules/telegram/guards/internal-service-key.guard.ts` — проверка `X-Internal-Service-Key` через `crypto.timingSafeEqual` (constant-time); `401` на отсутствие/несовпадение; длина заголовка контролируется атакующим → обе стороны хешируются через SHA-256 до сравнения (иначе `timingSafeEqual` бросает `RangeError` на разной длине); JSDoc.
- [x] `apps/api/src/modules/telegram/telegram.service.ts` — методы (по SPEC §6–§7, §9):
  - `createLinkToken(userId): { linkUrl }` — `rawToken = randomBytes(24).toString("hex")` (48 симв., укладывается в лимит `?start=` Telegram), `tokenHash = createHash("sha256").update(rawToken).digest("hex")`, `RedisService.set("tg:link:" + tokenHash, JSON.stringify({ userId }), ttl)`, `linkUrl = https://t.me/{botUsername}?start={rawToken}`;
  - `link(token, chatId)` — атомарный `RedisService.getdel("tg:link:" + sha256(token))` (single-use, паттерн `resetPassword`): `null` → `410`; проверка пользователя/совпадений, update `telegramChatId`, rethrow Prisma `P2002` → `409`;
  - `unlink(chatId)` — updateMany `{ telegramChatId, telegramLocale }` в `null` → count 0 → `404`;
  - `getProfileByChatId(chatId)` — `findUnique where telegramChatId`, без `deletedAt` → `404`;
  - `getInterviewsByChatId(chatId)` — собственник или участник, `status ∈ {CREATED, ACTIVE}`, `take: 10`, `role` из владения/партиципации;
  - `updatePreferences(chatId, locale)` — update `telegramLocale` → `404` при отсутствии.
- [x] `apps/api/src/modules/telegram/telegram.controller.ts`:
  - `@ApiTags("telegram-internal")`, `@ApiExcludeController()` (скрыть из публичной OpenAPI, SPEC §13);
  - `POST /telegram/link-token` — за глобальным `AccessTokenGuard` (без `@Public()`), `request.user.sub`, per-route `@UseGuards(AuthThrottlerGuard)` (глобального throttling нет — см. SPEC §7);
  - `POST /telegram/link`, `POST /telegram/unlink`, `GET /telegram/profile`, `GET /telegram/interviews`, `PATCH /telegram/preferences` — `@Public()` (обход глобального `AccessTokenGuard`: бот не шлёт Bearer, только `X-Internal-Service-Key`) + `@UseGuards(InternalServiceKeyGuard)`, `ZodValidationPipe`, Swagger-декораторы (компактные описания для внутреннего API).
- [x] `apps/api/src/modules/telegram/telegram.module.ts` — controller + service (PrismaModule/RedisModule глобальные).
- [x] Зарегистрировать `TelegramModule` в `apps/api/src/app.module.ts`.
- [x] Тесты:
  - unit `telegram.service.spec.ts` (кейсы из SPEC §6.2/§7, включая повторное использование токена → `410` через GETDEL);
  - unit `internal-service-key.guard.spec.ts` (отсутствие/несовпадение → `401`, заголовок другой длины → `401` без `RangeError`);
  - e2e `apps/api/test/telegram-link.e2e-spec.ts` (link-token → link → profile → unlink; link без ключа → `401`, повторный link с тем же токеном → `410`).
- [x] `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`.

## Phase 5 — Локализация: `telegram.json` в `@packages/i18n`

- [x] Создать `packages/i18n/src/locales/ru/telegram.json` (структура SPEC §10.1; ключи `start.*`, `me.*`, `interviews.*`, `unlink.*`, `lang.*`, `errors.*`).
- [x] Создать зеркально `packages/i18n/src/locales/en/telegram.json`.
- [x] `packages/i18n/src/types.ts` — импорт `ru/telegram.json`, тип `TelegramMessages`, добавление `telegram` в `Messages`.
- [x] `packages/i18n/src/index.ts` — импорт `ru`/`en` `telegram.json`, добавление `telegram` в объект `messages[locale]`.
- [x] `pnpm --filter @packages/i18n typecheck && pnpm run lint`.

## Phase 6 — Бот: ядро

- [x] `src/config.ts` — zod-парсинг env по перечню SPEC §12.1 (токен/API/сервисный ключ/webhook/порт), тип `Env`.
- [x] `src/api-client.ts` — `fetch`-обёртка над `API_INTERNAL_URL`:
  - base headers `X-Internal-Service-Key`;
  - `apiPost(path, body)`, `apiGet(path, params)`, `apiPatch(path, body)`;
  - класс `ApiError { status, body }`; маппинг не-OK статусов;
  - timeout каждого запроса через `AbortSignal.timeout(10_000)` (зависший API не держит обработку апдейта).
- [x] `src/i18n.ts` — `resolveLocale(manual?, profileLocale?, languageCode?): Locale` (приоритет SPEC §10.2) и `t(locale, key)` через `getMessages(locale).telegram`.
- [x] `src/types.ts` — типы ответов внутреннего API из `@packages/dto` (переиспользование, не дублирование). Импорт **только типов**: runtime-export dto идёт из `dist` (main `./dist/index.js`), а бот работает через `tsx` без сборки — значения (zod-схемы/константы) из dto в runtime не тащим, валидацию выполняет API; при dev-запуске перед ботом выполнять `pnpm --filter @packages/dto build`.
- [x] `src/bot.ts` — `new Bot<TgContext>(TOKEN)`, middleware `session` (грамми-сессия, in-memory `MemorySessionStorage` — для v1 и одной реплики; transient-локаль §11.5; мульти-инстанс — «Вне области»), регистрация команд:
  - `bot.command("start", startHandler)`, `me`, `interviews`, `unlink`, `lang`;
  - `bot.callbackQuery("lang:ru" | "lang:en", langCallback)`;
  - `bot.catch(...)` — лог без чувствительных данных (SPEC §13).
- [x] `src/index.ts` — bootstrap:
  - загрузка config;
  - webhook-режим (задан `TELEGRAM_WEBHOOK_URL`): `setWebhook(url, { secret_token: SECRET })` + `webhookCallback(bot, "http", { secretToken: SECRET })` — `secretToken` обязателен в обоих местах, иначе грамми принимает любые updates; `http.createServer` на `TELEGRAM_WEBHOOK_PORT` (path `/telegram/webhook`);
  - иначе Long Polling: `bot.start({ drop_pending_updates: true })`;
  - graceful shutdown по SIGTERM/SIGINT (`bot.stop()`).

## Phase 7 — Бот: хендлеры команд

- [x] `src/handlers/start.ts` — `/start`:
  - только приватный чат (`ctx.chat.type === "private"`), иначе → `start.welcome` (привязка в группах не поддерживается; `ctx.chat.id` там отрицательный);
  - без токена → `start.welcome`;
  - с токеном → `apiPost("/telegram/link", { token, chatId: String(ctx.chat.id) })`; маппинг ответов (`200` → `start.linked`, `409` → `start.alreadyLinked`, `410` → `start.tokenExpired`, `400`/`401`/`5xx` → `start.linkError`, прочее → `errors.unexpected`).
- [x] `src/handlers/me.ts` — `/me`:
  - `apiGet("/telegram/profile", { chatId })`;
  - `404` → `me.notLinked`; успех → форматированный профиль (`me.title`, `me.name`, `me.email`, `me.username`, `me.telegram`, `me.role`); `5xx` → `errors.apiUnavailable`.
- [x] `src/handlers/interviews.ts` — `/interviews`:
  - `apiGet("/telegram/interviews", { chatId })`;
  - `404` → `interviews.notLinked`; пустой список → `interviews.empty`;
  - `5xx` → `interviews.unexpected`;
  - иначе `interviews.title` + пункты + InlineKeyboard с `interviews.joinButton` (URL из `WEB_APP_URL` + константа `JOIN_PATH = "/dashboard/sandbox?room="`, SPEC §11.3).
  - Зависимость: роут `/dashboard/sandbox` в `apps/web` пока не реализован (`docs/tasks/session-join-flow.md`) — кнопка ведёт на 404 до реализации веб-задачи; код бота не зависит от этого.
- [x] `src/handlers/unlink.ts` — `/unlink`:
  - `apiPost("/telegram/unlink", { chatId })`; `404` → `unlink.notLinked`, успех → `unlink.success`.
- [x] `src/handlers/lang.ts` — `/lang` + callback `lang:ru`/`lang:en`:
  - `/lang` без аргумента → `lang.select` + InlineKeyboard (`lang:ru`, `lang:en`);
  - callback → `apiPatch("/telegram/preferences", { chatId, locale })` (при наличии привязки):
    - успех → `ctx.session.locale = code`, `lang.changedRu`/`lang.changedEn`;
    - `404` → `lang.notLinked`; ошибка API → `lang.persistError`.
- [x] Тесты (Vitest, mock `api-client`):
  - `i18n.spec.ts` — приоритет локали (manual > profile > `language_code` > fallback `ru`);
  - `api-client.spec.ts` — передача `X-Internal-Service-Key`, маппинг `ApiError` (409/410/404/5xx);
  - `start/me/interviews/unlink/lang.handler.spec.ts` — ведущие сценарии (успех и ошибки).

## Phase 8 — Верификация

- [x] Выполнить:

```bash
pnpm install
pnpm --filter @packages/dto test && pnpm --filter @packages/dto build
pnpm --filter @packages/i18n typecheck
pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e
pnpm --filter @apps/telegram-bot lint && pnpm --filter @apps/telegram-bot typecheck && pnpm --filter @apps/telegram-bot test
pnpm run build:telegram-bot
```

- [x] Проверить OpenAPI: `pnpm generate:api` — telegram-эндпоинты **отсутствуют** в `apps/api/openapi/openapi.yaml` (`@ApiExcludeController`, SPEC §13); регрессий в существующих путях нет. Для запуска генерации в корневой `.env` добавлен блок `# Telegram Bot` (`INTERNAL_SERVICE_KEY`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_LINK_TTL_SECONDS`).
- [ ] Ручной сквозной сценарий (dev, Long Polling):
  1. `docker compose up -d`; заполнить `.env` (в т.ч. `INTERNAL_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`);
  2. поднять API (`pnpm --filter api dev`) и бот (`pnpm run dev:telegram-bot`);
  3. зарегистрировать пользователя → `POST /api/v1/telegram/link-token` (Bearer) → получить `linkUrl`;
  4. перейти по `t.me/...?start=TOKEN` → бот отвечает `start.linked`; повторно открыть ту же ссылку → `start.tokenExpired` (single-use);
  5. `/me` → профиль; `/interviews` → список/пусто; `/lang` → смена языка, затем повторный `/me` на выбранном языке; `/unlink` → `unlink.success`, повторный `/me` → `me.notLinked`.
- [ ] Проверить join-кнопку `/interviews`: переход по `{WEB_APP_URL}/dashboard/sandbox?room={id}` — на момент v1.0.0 веб-роут не реализован (`docs/tasks/session-join-flow.md`), фиксируем 404 как известный gap и возвращаемся после реализации веб-задачи.
- [x] Зафиксировать отклонения/решения, обновить этот план и SPEC (Behavior-driven, как в `apps/api/PLAN.md`). Отклонения: manual e2e требует поднятой БД (docker) и реальных токенов; unit-сьют `apps/api` `openapi-generation.spec.ts` требует поднятую БД (`docker compose up -d`) — с docker оба сьюта (`openapi-generation` 35 тестов, полный `apps/api` 397 тестов) зелёные. Возникший при полном прогоне 5s hook-timeout `beforeAll` (boot всего `AppModule` под параллельной нагрузкой ts-jest) устранён: `testTimeout: 30000` в `apps/api/jest.config.ts` — не регрессия кода (см. v1.0.5).

---

## Вне области (будущие фазы)

- **Push-уведомления через RabbitMQ**: consumer очереди `telegram.notifications` (+ DLQ), форматирование пушей через i18n (`notifications.*`), retry с экспоненциальной задержкой; producer на стороне `apps/api` (NotificationsService) и payload `TelegramNotificationMessage` (§3.1 `docs/TELEGRAM_BOT_ARCHITECTURE.md`). Зависит от: очередей в RabbitMQ (инфраструктура в `docker-compose.yml` уже есть).
- **`/settings`**: включение/отключение категорий уведомлений — потребуется модель настроек и расширение `PATCH /telegram/preferences`.
- **Веб-кнопка «Подключить Telegram»** в `apps/web`: форма использует готовый `POST /api/v1/telegram/link-token`; отрисовка `linkUrl` + статус привязки.
- **Улучшения команды `/unlink`**: подтверждающий шаг через Inline-кнопку (сейчас прямое действие).
- **Персистентная локаль вне привязки**: состояние локали пока хранится в сессии grammY и в API только после привязки.

---

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.0.0 | 2026-09-16 | Первоначальная версия плана. |
| 1.0.1 | 2026-09-20 | Синхронизация с ревью SPEC 1.0.1: токен randomBytes+sha256 (лимит `?start=`), атомарный GETDEL, guard против разной длины ключа, `unlink` очищает локаль, private-chat guard в `/start`, повторный link → `410` в сценарии и тестах, `--env-file` в scripts. |
| 1.0.2 | 2026-09-20 | Синхронизация с ревью SPEC 1.0.2: `@Public()` на service-key эндпоинтах (обход глобального `AccessTokenGuard`), per-route `AuthThrottlerGuard` на `link-token` (глобального throttling нет), бот импортирует dto только типы. |
| 1.0.3 | 2026-09-20 | Синхронизация с ревью SPEC 1.0.3: `secretToken` в `webhookCallback` (иначе принимает любые updates), timeout api-client (AbortSignal.timeout 10s), лимиты `linkRequestSchema` (token ≤ 64, chatId ≤ 32), `5xx → interviews.unexpected`, join-URL через константу `JOIN_PATH` + зависимость от `/dashboard/sandbox` (web не реализован, проверка в Phase 8), in-memory session для одной реплики. |
| 1.0.4 | 2026-09-22 | Завершение реализации: `src/index.ts` (bootstrap webhook/LL + graceful shutdown), тесты хендлеров (Vitest, mock api-client, 5 spec-файлов + test-context), верификация: dto test/build, i18n typecheck, api lint, telegram-specs (39 тестов), telegram-bot lint/typecheck/test (44 теста), `build:telegram-bot`, `generate:api` (telegram-routes отсутствуют, openapi.yaml без регрессий). Ручной сценарий и join-кнопка — вне авто-верификации (требуют docker/токенов и веб-роута). |
| 1.0.5 | 2026-09-22 | Верификация env-зависимых сьютов `apps/api`: поднят `docker compose up -d` (postgres/redis/minio/rabbitmq/livekit; livekit-переменные задаются инлайн); `openapi-generation.spec.ts` — 35/35 зелёный; полный `pnpm --filter api test` — 30/30 сьютов, 397 тестов зелёные. Flaky 5s hook-timeout в `beforeAll` (boot AppModule под параллельным прогоном) устранён добавлением `testTimeout: 30000` в `apps/api/jest.config.ts`. |
