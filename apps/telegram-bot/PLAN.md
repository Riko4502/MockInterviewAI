# План реализации — Telegram Bot (`apps/telegram-bot`)

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.0.0 | 2026-09-16 | Актуальный |

## Область v1.0.0

Scaffolding `apps/telegram-bot`, подключение к Telegram Bot API (grammY), `/start <token>` → `POST /api/v1/telegram/link`, команды `/interviews`, `/me`, `/unlink`, `/lang`, переводы из `@packages/i18n`.

**Вне области v1.0.0** (см. раздел «Вне области»): push-уведомления через RabbitMQ (`telegram.notifications`), `/settings`, веб-кнопка «Подключить Telegram».

---

## Phase 0 — Документация

- [ ] Заполнить `apps/telegram-bot/SPEC.md` (назначение, архитектура, endpoints, i18n, env, безопасность, манифест).
- [ ] Заполнить `apps/telegram-bot/PLAN.md` (этот документ).

## Phase 1 — Scaffolding `apps/telegram-bot`

- [ ] Создать `apps/telegram-bot/package.json` (name `@apps/telegram-bot`, `"type": "module"`): scripts `dev` (`tsx watch src/index.ts`), `start` (`tsx src/index.ts`), `build` (`tsc --noEmit`), `typecheck` (`tsc --noEmit`), `lint` (`biome check --no-errors-on-unmatched`), `test` (`vitest run`).
- [ ] Создать `tsconfig.json` — extends `../../tsconfig.base.json` (ES2022, `moduleResolution: Bundler`, strict); include `src`.
- [ ] Создать `.env.example` (см. SPEC §12.1).
- [ ] Создать `vitest.config.ts`.
- [ ] Установить зависимости (из корня):

```bash
pnpm --filter @apps/telegram-bot add grammY @packages/i18n@workspace:* @packages/dto@workspace:*
pnpm --filter @apps/telegram-bot add -D tsx typescript vitest @types/node @biomejs/biome@2.4.2
```

- [ ] Обновить корневой `package.json`: скрипты `dev:telegram-bot` → `turbo dev --filter=@apps/telegram-bot`, `build:telegram-bot` → `turbo build --filter=@apps/telegram-bot`.
- [ ] Обновить `lint-staged.config.mjs` — паттерн `apps/telegram-bot/**/*.{js,ts,json}` (при наличии файла).
- [ ] Верификация scaffolding: `pnpm install` → `pnpm --filter @apps/telegram-bot typecheck` → `pnpm run lint`.

> **Примечание:** `turbo.json` изменений не требует — задачи `dev`/`build`/`test` уже декларированы глобально; билд бота — typecheck (`tsc --noEmit`), артефактов не создаёт (запуск через `tsx`).

## Phase 2 — Backend: Prisma-миграция и env (`apps/api`)

- [ ] `apps/api/prisma/schema.prisma` — добавить в модель `User`:
  - `telegramChatId String? @unique`;
  - `telegramLocale String?`.
- [ ] Миграция: `pnpm --filter api db:migrate:dev -- --name add_telegram_bot_fields`; `prisma generate`.
- [ ] `apps/api/src/config/env.validation.ts` — добавить в zod-схему:
  - `INTERNAL_SERVICE_KEY: z.string().min(32)`;
  - `TELEGRAM_BOT_USERNAME: z.string().min(1).default("MockInterviewBot")`;
  - `TELEGRAM_LINK_TTL_SECONDS: z.coerce.number().int().positive().default(900)`.
- [ ] Корневой `.env.example` — добавить блок `# Telegram Bot` с этими переменными.

## Phase 3 — Backend: `@packages/dto` (telegram-схемы)

- [ ] Создать `packages/dto/src/telegram/`:
  - `link.dto.ts` — `linkRequestSchema` (`{ token, chatId }`, оба `string.min(1)`), `linkTokenResponseSchema` (`{ linkUrl }`);
  - `unlink.dto.ts` — `unlinkRequestSchema` (`{ chatId }`), `unlinkResponseSchema` (`{ success: true }`);
  - `profile.dto.ts` — `telegramProfileQuerySchema` (`{ chatId }`), `telegramUserProfileSchema` (id, email, displayName, username, telegramUsername, telegramChatId, telegramLocale, role) + тип `TelegramUserProfileDto`;
  - `interviews.dto.ts` — `telegramInterviewsQuerySchema`, `telegramInterviewSchema` (id, status, startedAt, role, createdAt), `telegramInterviewsListSchema` (`{ items }`);
  - `preferences.dto.ts` — `telegramPreferencesPatchSchema` (`{ chatId, locale: z.enum(["ru", "en"]) }`).
- [ ] Экспортировать схемы и типы из `packages/dto/src/index.ts`.
- [ ] Тесты dto: валидные/невалидные payload по каждой схеме (сообщения на русском, §63 `apps/api/SPEC.md`).
- [ ] `pnpm --filter @packages/dto test && pnpm --filter @packages/dto typecheck && pnpm --filter @packages/dto build`.

## Phase 4 — Backend: `TelegramModule`

- [ ] `apps/api/src/modules/telegram/guards/internal-service-key.guard.ts` — проверка `X-Internal-Service-Key` через `crypto.timingSafeEqual` (constant-time); `401` на отсутствие/несовпадение; JSDoc.
- [ ] `apps/api/src/modules/telegram/telegram.service.ts` — методы (по SPEC §6–§7, §9):
  - `createLinkToken(userId): { linkUrl }` — `hash = argon2.hash("{userId}:{Date.now()}")` (существующая зависимость `argon2` в api, параметры `ARGON2_*`), `token = Buffer.from(hash).toString("hex")` (URL-safe), `RedisService.set("tg:link:{token}", JSON.stringify({ userId }), ttl)`, `linkUrl = https://t.me/{botUsername}?start={token}`;
  - `link(token, chatId)` — read-then-del токена, проверка пользователя/совпадений, update `telegramChatId`, rethrow Prisma `P2002` → `409`;
  - `unlink(chatId)` — updateMany → count 0 → `404`;
  - `getProfileByChatId(chatId)` — `findUnique where telegramChatId`, без `deletedAt` → `404`;
  - `getInterviewsByChatId(chatId)` — собственник или участник, `status ∈ {CREATED, ACTIVE}`, `take: 10`, `role` из владения/партиципации;
  - `updatePreferences(chatId, locale)` — update `telegramLocale` → `404` при отсутствии.
- [ ] `apps/api/src/modules/telegram/telegram.controller.ts`:
  - `@ApiTags("telegram-internal")`, `@ApiExcludeController()` (скрыть из публичной OpenAPI, SPEC §13);
  - `POST /telegram/link-token` — за глобальным `AccessTokenGuard` (без `@Public()`), `request.user.sub`;
  - `POST /telegram/link`, `POST /telegram/unlink`, `GET /telegram/profile`, `GET /telegram/interviews`, `PATCH /telegram/preferences` — `@UseGuards(InternalServiceKeyGuard)`, `ZodValidationPipe`, Swagger-декораторы (компактные описания для внутреннего API).
- [ ] `apps/api/src/modules/telegram/telegram.module.ts` — controller + service (PrismaModule/RedisModule глобальные).
- [ ] Зарегистрировать `TelegramModule` в `apps/api/src/app.module.ts`.
- [ ] Тесты:
  - unit `telegram.service.spec.ts` (кейсы из SPEC §6.2/§7);
  - unit `internal-service-key.guard.spec.ts`;
  - e2e `apps/api/test/telegram-link.e2e-spec.ts` (link-token → link → profile → unlink; link без ключа → `401`).
- [ ] `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`.

## Phase 5 — Локализация: `telegram.json` в `@packages/i18n`

- [ ] Создать `packages/i18n/src/locales/ru/telegram.json` (структура SPEC §10.1; ключи `start.*`, `me.*`, `interviews.*`, `unlink.*`, `lang.*`, `errors.*`).
- [ ] Создать зеркально `packages/i18n/src/locales/en/telegram.json`.
- [ ] `packages/i18n/src/types.ts` — импорт `ru/telegram.json`, тип `TelegramMessages`, добавление `telegram` в `Messages`.
- [ ] `packages/i18n/src/index.ts` — импорт `ru`/`en` `telegram.json`, добавление `telegram` в объект `messages[locale]`.
- [ ] `pnpm --filter @packages/i18n typecheck && pnpm run lint`.

## Phase 6 — Бот: ядро

- [ ] `src/config.ts` — zod-парсинг env по перечню SPEC §12.1 (токен/API/сервисный ключ/webhook/порт), тип `Env`.
- [ ] `src/api-client.ts` — `fetch`-обёртка над `API_INTERNAL_URL`:
  - base headers `X-Internal-Service-Key`;
  - `apiPost(path, body)`, `apiGet(path, params)`;
  - класс `ApiError { status, body }`; маппинг не-OK статусов.
- [ ] `src/i18n.ts` — `resolveLocale(manual?, profileLocale?, languageCode?): Locale` (приоритет SPEC §10.2) и `t(locale, key)` через `getMessages(locale).telegram`.
- [ ] `src/types.ts` — типы ответов внутреннего API из `@packages/dto` (переиспользование, не дублирование).
- [ ] `src/bot.ts` — `new Bot<TgContext>(TOKEN)`, middleware `session` (грамми-сессия для transient-локали), регистрация команд:
  - `bot.command("start", startHandler)`, `me`, `interviews`, `unlink`, `lang`;
  - `bot.callbackQuery("lang:ru" | "lang:en", langCallback)`;
  - `bot.catch(...)` — лог без чувствительных данных (SPEC §13).
- [ ] `src/index.ts` — bootstrap:
  - загрузка config;
  - webhook-режим (задан `TELEGRAM_WEBHOOK_URL`): `setWebhook(url, { secret_token })` + `webhookCallback` + `http.createServer` на `TELEGRAM_WEBHOOK_PORT` (path `/telegram/webhook`);
  - иначе Long Polling: `bot.start({ drop_pending_updates: true })`;
  - graceful shutdown по SIGTERM/SIGINT (`bot.stop()`).

## Phase 7 — Бот: хендлеры команд

- [ ] `src/handlers/start.ts` — `/start`:
  - без токена → `start.welcome`;
  - с токеном → `apiPost("/telegram/link", { token, chatId: String(ctx.chat.id) })`; маппинг ответов (`200` → `start.linked`, `409` → `start.alreadyLinked`, `410` → `start.tokenExpired`, `400`/`401`/`5xx` → `start.linkError`, прочее → `errors.unexpected`).
- [ ] `src/handlers/me.ts` — `/me`:
  - `apiGet("/telegram/profile", { chatId })`;
  - `404` → `me.notLinked`; успех → форматированный профиль (`me.title`, `me.name`, `me.email`, `me.username`, `me.telegram`, `me.role`); `5xx` → `errors.apiUnavailable`.
- [ ] `src/handlers/interviews.ts` — `/interviews`:
  - `apiGet("/telegram/interviews", { chatId })`;
  - `404` → `interviews.notLinked`; пустой список → `interviews.empty`;
  - иначе `interviews.title` + пункты + InlineKeyboard с `interviews.joinButton` (`{WEB_APP_URL}/sessions/{id}`).
- [ ] `src/handlers/unlink.ts` — `/unlink`:
  - `apiPost("/telegram/unlink", { chatId })`; `404` → `unlink.notLinked`, успех → `unlink.success`.
- [ ] `src/handlers/lang.ts` — `/lang` + callback `lang:ru`/`lang:en`:
  - `/lang` без аргумента → `lang.select` + InlineKeyboard (`lang:ru`, `lang:en`);
  - callback → `apiPatch("/telegram/preferences", { chatId, locale })` (при наличии привязки):
    - успех → `ctx.session.locale = code`, `lang.changedRu`/`lang.changedEn`;
    - `404` → `lang.notLinked`; ошибка API → `lang.persistError`.
- [ ] Тесты (Vitest, mock `api-client`):
  - `i18n.spec.ts` — приоритет локали (manual > profile > `language_code` > fallback `ru`);
  - `api-client.spec.ts` — передача `X-Internal-Service-Key`, маппинг `ApiError` (409/410/404/5xx);
  - `start/me/interviews/unlink/lang.handler.spec.ts` — ведущие сценарии (успех и ошибки).

## Phase 8 — Верификация

- [ ] Выполнить:

```bash
pnpm install
pnpm --filter @packages/dto test && pnpm --filter @packages/dto build
pnpm --filter @packages/i18n typecheck
pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e
pnpm --filter @apps/telegram-bot lint && pnpm --filter @apps/telegram-bot typecheck && pnpm --filter @apps/telegram-bot test
pnpm run build:telegram-bot
```

- [ ] Проверить OpenAPI: `pnpm generate:api` — telegram-эндпоинты **отсутствуют** в `apps/api/openapi/openapi.yaml` (`@ApiExcludeController`, SPEC §13); регрессий в существующих путях нет.
- [ ] Ручной сквозной сценарий (dev, Long Polling):
  1. `docker compose up -d`; заполнить `.env` (в т.ч. `INTERNAL_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`);
  2. поднять API (`pnpm --filter api dev`) и бот (`pnpm run dev:telegram-bot`);
  3. зарегистрировать пользователя → `POST /api/v1/telegram/link-token` (Bearer) → получить `linkUrl`;
  4. перейти по `t.me/...?start=TOKEN` → бот отвечает `start.linked`;
  5. `/me` → профиль; `/interviews` → список/пусто; `/lang` → смена языка, затем повторный `/me` на выбранном языке; `/unlink` → `unlink.success`, повторный `/me` → `me.notLinked`.
- [ ] Зафиксировать отклонения/решения, обновить этот план и SPEC (Behavior-driven, как в `apps/api/PLAN.md`).

---

## Вне области (будущие фазы)

- **Push-уведомления через RabbitMQ**: consumer очереди `telegram.notifications` (+ DLQ), форматирование пушей через i18n (`notifications.*`), retry с экспоненциальной задержкой; producer на стороне `apps/api` (NotificationsService) и payload `TelegramNotificationMessage` (§3.1 `docs/TELEGRAM_BOT_ARCHITECTURE.md`). Зависит от: очередей в RabbitMQ (инфраструктура в `docker-compose.yml` уже есть).
- **`/settings`**: включение/отключение категорий уведомлений — потребуется модель настроек и расширение `PATCH /telegram/preferences`.
- **Веб-кнопка «Подключить Telegram»** в `apps/web`: форма использует готовый `POST /api/v1/telegram/link-token`; отрисовка `linkUrl` + статус привязки.
- **Улучшения команды `/unlink`**: подтверждающий шаг через Inline-кнопку (сейчас прямое действие).
- **Троттлинг `/start`**: per-route `AuthThrottlerGuard` на `POST /telegram/link-token` (сейчас — только глобальный `ThrottlerModule`).
- **Персистентная локаль вне привязки**: состояние локали пока хранится в сессии grammY и в API только после привязки.

---

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.0.0 | 2026-09-16 | Первоначальная версия плана. |