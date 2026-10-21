# План реализации: безопасная отвязка аккаунтов по ADR-005 (backend/API)

## Статус

Реализовано. Ветка `feat/adr-005-security-unlink-backend` — коммиты `feat(dto)` → `feat(i18n)` → `feat(telegram-bot)` → `feat(api)` (модель + миграция) → `feat(api)` → `chore(api)` (реконсолидация OpenAPI/Orval).

Проверено: `typecheck`, `lint`, unit — 63 сьюта / 1044 теста, e2e — 24 сьюта / 100 тестов, `@packages/dto` — 244, `@packages/i18n` — 8, telegram-bot — 133, `pnpm codegen:check` идемпотентен. Миграция `20261017120000_add_security_events` накатилась на dev-базу.

Без отметки остался один пункт §8 — «Код ревью пройден»: он закрывается вместе с PR. Отступления от формулировок плана — в [§10](#10-отступления-от-плана-по-факту-реализации).

Решения по реализации зафиксированы в [спеке, §1.1](./security-unlink-adr-005-spec.md) (D1–D14); план ниже следует им.

## Цель плана

Пошагово реализовать backend-флоу безопасной отвязки Telegram/GitHub по [ADR-005](../../adr/ADR-005.md): подтверждение отвязки Telegram одноразовым кодом из Telegram, ревокация сессий (инкремент `generation`), аудит SecurityEvent, security-уведомления, отдельные эндпоинты отвязки.

**Объём:** только отвязка + минимальная инфраструктура аудита (D1). Остальные события ADR-005 (welcome, `PASSWORD_CHANGED`, `LOGIN_FROM_NEW_DEVICE`, `PROFILE_CHANGED`, история событий) в этот план не входят.

## Зависимости

- **Prisma**: модели `User` (`generation`), новая `SecurityEvent`.
- **Redis** (обязателен, уже используется auth/session): хранение одноразового кода отвязки с TTL (D5).
- **RabbitMqPublisher** (`apps/api/src/modules/notifications/rabbitmq-publisher.service.ts`): публикация envelope для бота — доставка кода и security-уведомлений (D6, D7).
- **SecurityEvents модуль** (новый): фиксация `TG_LINKED`, `TG_UNLINKED`, `GITHUB_UNLINKED` + состояние доставки (D7).
- **Sessions/Auth**: механизм ревокации сессий через инкремент `generation`.
- **`apps/telegram-bot`**: приём нового типа сообщения и его рендер/отправка (D6).
- **`packages/i18n`**: шаблон `notifications.events["security.telegram_unlink_code"]` (ru/en).

## 1. Исследование и подготовка

- [x] Ознакомиться с ADR-005 полностью (разделы «Принятое решение», «Последствия»).
- [x] Проанализировать текущую реализацию `UsersService.updateProfile` (отвязка `telegramUsername`/`gitUrl`) — её предстоит ограничить (D2).
- [x] Проанализировать модель User (`generation`), текущий deep-link `TelegramService.link`/`unlink` (после мержа `dev`), существующие паттерны аудита.
- [x] Зафиксировать ключ/формат кода в Redis (D5) и шаблон доставки в бота (D6).
- [x] Подготовить DTO для новых эндпоинтов.

## 2. Дизайн API (эндпоинты)

Размещение — `profile.controller.ts`, рядом с `PATCH /profile/me` (D4).

### Отвязка Telegram (подтверждаемый флоу)

- `POST /profile/me/telegram/unlink/request` — генерация одноразового кода и отправка его в Telegram. `200 { sent: true, expiresAt }`; `400 TELEGRAM_NOT_LINKED`; `429 TOO_MANY_REQUESTS` (rate limit 1/60с).
- `POST /profile/me/telegram/unlink/confirm` — подтверждение кодом. Тело: `{ code }` (без отдельного токена, D5). На успехе — отвязка + ревокация сессий + аудит. Ошибки: `400 INVALID_CODE`, `410 CODE_EXPIRED`, `409 ALREADY_UNLINKED`, `429 ATTEMPTS_EXCEEDED`.

### Отвязка GitHub

- `POST /profile/me/github/unlink` — немедленная отвязка с ревокацией сессий и событием `GITHUB_UNLINKED`. Ошибки: `400 GITHUB_NOT_LINKED`, `409 LAST_AUTH_METHOD` (D9).

### Ограничение существующего PATCH (D2)

- `PATCH /profile/me`: обнуление `telegramUsername`/`gitUrl` (`telegramId`/`telegramChatId`/`telegramLinkVerified`/`githubId`) отклоняется с `400`. Остальные поля работают без изменений.

## 3. Модель данных

### Одноразовый код отвязки Telegram (Redis, D5)

- Key: `telegram:unlink:{userId}`; значение — JSON `{ codeHash, attempts, expiresAt }`.
- TTL: 10 минут. Потребление атомарное (`getdel`) — одноразовость без гонок.
- Код: 6 цифр (`crypto.randomInt`), сравнение по хешу через `timingSafeEqual`; не более 5 попыток.
- В БД код/токен не пишется (D5, D14).

### Обновления в Prisma

- `User`: `generation` уже есть — инкремент при отвязке **и** при привязке Telegram (D3).
- `SecurityEvent` (новая модель, `@map("security_events")`): `id`, `userId`, `type` (enum), `ipAddress?`, `userAgent?`, `metadata Json?`, `createdAt` + состояние доставки `notifiedAt?`, `seenAt?`, `attempts Int @default(0)` (D7). Bootstrap событий с 1:1 отвязка (D8). Связь с `User` — без `onDelete: Cascade` (D12).

## 4. Реализация

### 4.1. DTO

- `ConfirmTelegramUnlinkDto` — только `code` (строка из 6 цифр), валидация class-validator/zod по конвенции проекта.
- Для `request` и GitHub-отвязки тела нет.

### 4.2. Сервисная логика (UsersService)

- [x] Генерация кода отвязки Telegram:
  - Валидация: пользователь привязан к Telegram (`telegramChatId`/`telegramLinkVerified`)? Если нет — `400 TELEGRAM_NOT_LINKED`.
  - Проверка rate limit (1/60с), генерация кода, запись хеша в Redis (`telegram:unlink:{userId}`, TTL 10 мин).
  - Публикация envelope `security.telegram_unlink_code` с `{ code, ttlMinutes }` через `RabbitMqPublisher` (D6). Код не логировать.

- [x] Подтверждение отвязки Telegram:
  - Атомарно прочитать и удалить запись (`getdel`); проверить TTL → `410 CODE_EXPIRED`.
  - Проверить код (`timingSafeEqual`); при неверном — увеличить `attempts`, `400 INVALID_CODE`; при превышении — инвалидировать запись, `429 ATTEMPTS_EXCEEDED`.
  - В транзакции:
    - Сброс `telegramUsername = null`, `telegramId = null`, `telegramChatId = null`, `telegramLinkVerified = false`.
    - Инкремент `generation++` (отзыв сессий), отзыв через `AuthRevocationTask`/`revokeSessionsWithRetry` по существующему паттерну.
    - Создание `SecurityEvent` `TG_UNLINKED` с ip/ua и состоянием доставки.
  - Уведомление: Telegram недоступен (chatId сброшен) → событие показывается in-app при следующем входе (D7).
  - Возврат результата.

- [x] Отвязка GitHub:
  - Валидация: привязан ли GitHub (`githubId`)? Если нет — `400 GITHUB_NOT_LINKED`.
  - Проверка «последний способ входа»: если `passwordHash` пуст и нет другой привязки — `409 LAST_AUTH_METHOD` (D9).
  - В транзакции: `gitUrl = null`, `githubId = null`, `generation++`, `SecurityEvent` `GITHUB_UNLINKED`.
  - Уведомление: Telegram-пуш при наличии привязки, иначе in-app (D7).

- [x] Привязка Telegram (изменение существующего `TelegramService.link`): после успешной привязки — `generation++` с отзывом сессий и `SecurityEvent` `TG_LINKED` (D3).

- [x] `resetPassword`: дополнительно обнуляет `githubId` (D13).

### 4.3. Контроллер

- [x] Добавить эндпоинты в `profile.controller.ts` с текущими гардами (JWT).
- [x] ip/ua локально: `@Ip()` + `@Headers("user-agent")` (D10).
- [x] Корректная декорация Swagger/OpenAPI (`@ApiOperation`, `@ApiResponse` со статусами из D4).
- [x] Валидация DTO через `ValidationPipe`.

### 4.4. Безопасность кода

- [x] 6 цифр через `crypto.randomInt`, хеширование при записи в Redis.
- [x] TTL 10 минут, лимит 5 попыток, rate limit 1/60с на `request`.
- [x] Атомарное потребление (`getdel`) — одноразовость и защита от гонок.
- [x] Сравнение через `timingSafeEqual`; код не логировать и не хранить в БД.

### 4.5. SecurityEvents: доставка (D7, D8)

- [x] Создать модуль `apps/api/src/modules/security-events/*` (модель, сервис создания, retention-крон 12 мес).
- [x] Свой relay: доставка событий с `notifiedAt = null` в Telegram через `RabbitMqPublisher`; при отсутствии привязки — ничего не отправлять, событие остаётся для in-app.
- [x] Публичные DTO не содержат `ipAddress`/`userAgent`; эндпоинты непросмотренных событий и отметки «просмотрено».
- [x] В `notifications`/`NotificationOutbox` security-события не пишутся.

### 4.6. Бот (D6)

- [x] Добавить рендер нового типа `security.telegram_unlink_code` в `apps/telegram-bot` (шаблон в `packages/i18n`, `renderNotification`).
- [x] Команда `/unlink` и внутренний `POST /telegram/unlink` остаются без изменений (D11).

## 5. Тестирование

### Unit-тесты

- [x] Генерация/валидация кода, TTL, лимит попыток, rate limit
- [x] Сервисные методы отвязки (успех/ошибки)
- [x] `400 TELEGRAM_NOT_LINKED` / `400 GITHUB_NOT_LINKED` / `409 ALREADY_UNLINKED` / `409 LAST_AUTH_METHOD`
- [x] Инкремент `generation` при отвязке и при привязке
- [x] Создание `SecurityEvent` (`TG_LINKED`, `TG_UNLINKED`, `GITHUB_UNLINKED`)
- [x] `PATCH /profile/me` отклоняет обнуление `telegramUsername`/`gitUrl`, остальные поля работают (D2)
- [x] Код не попадает в логи/БД

### Интеграционные тесты (e2e)

- [x] Полный флоу отвязки Telegram: request → confirm → отвязано, `generation` инкрементирован
- [x] Отвязка GitHub: успешный кейс
- [x] Ошибки: код неверный, TTL истёк, уже использован, аккаунт не привязан, последний способ входа
- [x] Конкурентный доступ к записи кода (race condition)
- [x] Публикация envelope в бота при `request`

## 6. OpenAPI и генерация пакетов

- [x] Обновить OpenAPI (NestJS Swagger), убедиться, что новые эндпоинты отражены.
- [x] `pnpm codegen` → `packages/api` (Orval); проверить `pnpm codegen:check` (отсутствие диффа).
- [x] Проверить корректность сгенерированных типов/хуков для `apps/web`.

## 7. Проверки качества

- [x] `pnpm --filter api exec tsc --noEmit` — без ошибок
- [x] `pnpm --filter api exec lint` — без ошибок
- [x] `pnpm --filter api exec test` — все тесты проходят
- [x] `pnpm --filter api exec test:e2e` — e2e тесты проходят (если затрагивают)
- [x] Проверка: `PATCH /profile/me` для остальных полей продолжает работать

## 8. DoD по плану

- [x] Все пункты 1–7 выполнены
- [x] Изменения соответствуют спецификации `security-unlink-adr-005-spec.md` (§1.1)
- [ ] Код ревью пройден (соответствие NestJS best practices)
- [x] OpenAPI обновлён и `@packages/api` перегенерирован
- [x] Фронтенд сможет использовать новые эндпоинты (после интеграции)
- [x] Нет регрессий в существующем функционале

## 9. Примечания

- **Потребители контракта.** После генерации OpenAPI эндпоинты используются фронтендом: [спецификация UI-флоу](../../frontend/specs/features/update-profile/security-unlink-frontend-spec.md), [план](../../frontend/specs/features/update-profile/security-unlink-adr-005-plan.md), «зонтичная» [спека](../../frontend/specs/features/update-profile/security-unlink-adr-005-spec.md).
- **Отвязка только через новые эндпоинты.** `PATCH /profile/me` больше не отвязывает (D2) — иначе защита обходится.
- **Один секрет.** `confirm` принимает только `{ code }` (D5), отдельного токена нет.
- **Доставка кода — через бота.** `TelegramService` не умеет отправлять произвольные сообщения; публикуем envelope через `RabbitMqPublisher` (D6).
- **Security-уведомления — не в `notifications`.** Состояние доставки живёт в `security_events`, доставка — своим relay (D7).
- **Транзакционность**: обновление `User`, создание `SecurityEvent` и постановка доставки — по возможности в одной транзакции.
- **GitHub отвязка**: код-подтверждение не требуется, но ревокация сессий и аудит обязательны; отвязка последнего способа входа запрещена (D9).

## 10. Отступления от плана (по факту реализации)

Смысл требований §1–§9 соблюдён; отличается несколько реализаций — они зафиксированы здесь, чтобы документ не расходился с кодом.

- **§3/§4.4 — атомарное потребление.** Вместо `getdel` — compare-and-delete плюс атомарный инкремент `attempts` через Lua-скрипт в Redis. Причина: в `getdel` нет счётчика попыток, поэтому параллельные `confirm` читали бы «свежую» запись и обходили бы лимит в 5 попыток. Ключ, хеш, TTL и лимит попыток остались как в плане.
- **§4.2 — отзыв сессий.** Вынесен общий `revokeUserSessionsWithRetry` (`apps/api/src/common/revocation/sessions-revocation.ts`) вместо обращения к `AuthRevocationTask`/`revokeSessionsWithRetry` — используется привязкой Telegram и обеими отвязками.
- **§4.3 — rate limit.** На `request` — гард `UserThrottlerGuard` (per-user, 1/60 с) в `profile.controller.ts`, а не проверка внутри сервиса. Сервер возвращает штатный `429 ThrottlerException` без машинного `code`, поэтому фронт распознаёт его по HTTP-статусу (см. §4.4).
- **§4.5 — `SecurityEvent.userId`.** Связь реализована как `onDelete: Restrict` (D12), а не `SetNull`: каскад скрыл бы удаление, а явное обнуление оставило бы событие без автора. Побочно `user-cleanup.cron` переведён на транзакцию «события пользователя раньше самого пользователя».
- **Бонус (не было в плане) — `HttpExceptionFilter`.** Фильтр теперь пробрасывает строковый `code` в `{ statusCode, message, code }`. Без этого `code` вовсе не доходил до фронта — в частности, не работали `RESET_PASSWORD_ERROR_CODES`.
- **§2 — имена DTO.** Ответы названы `SecurityUnlinkResponseDto`/`TelegramUnlinkRequestResponseDto`, а не `UnlinkResponseDto`, чтобы не конфликтовать с уже существующей схемой `unlinkResponseSchema` в `packages/dto`.