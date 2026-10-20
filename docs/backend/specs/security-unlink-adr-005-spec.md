# Спецификация: безопасная отвязка аккаунтов по ADR-005 (backend/API)

## 1. Цель

Сформулировать требования к backend-реализации безопасной отвязки привязанных аккаунтов (Telegram, GitHub) согласно [ADR-005](../../adr/ADR-005.md).

Ключевые требования ADR-005:

- Подтверждение отвязки Telegram **одноразовым кодом из Telegram** (единственный секрет — код с TTL, см. D5).
- Обеспечение **ревокации сессий** при отвязке (инкремент `generation`).
- Использование **отдельных user-facing эндпоинтов отвязки** (не через `PATCH /profile/me` с `telegramUsername: null` / `gitUrl: null`).
- Аудит событий безопасности (SecurityEvent) при отвязке.
- Соответствующие security-уведомления.

## 1.1. Принятые решения по реализации (2026-10-17)

Канонический список решений по этому объёму работ. Остальные документы
(backend-план, frontend-спеки) ссылаются сюда, а не дублируют.

### Объём (D1)

- В объём входит **только отвязка**: Telegram по одноразовому коду и GitHub,
  плюс минимально необходимая инфраструктура аудита (`SecurityEvent` + доставка
  уведомлений + retention).
- Вне объёма остаются остальные security-события ADR-005: приветствие по
  `firstLoginAt`, `PASSWORD_CHANGED`, `LOGIN_FROM_NEW_DEVICE`, `PROFILE_CHANGED`,
  экран истории событий, чистка мёртвых полей `telegramId`/`telegramUsername`.
  Они реализуются отдельными задачами.
- Мёртвые поля и free-text `telegramUsername` через `PATCH /profile/me`
  (ADR-005:66-72, :116) в этот объём не входят, кроме последствий D2.

### Закрытие обхода `PATCH /profile/me` (D2)

- `PATCH /profile/me` **перестаёт отвязывать**: попытка выставить
  `telegramUsername: null` или `gitUrl: null` отклоняется с `400`, а не обнуляет
  `telegramId`/`telegramChatId`/`telegramLinkVerified`/`githubId` (текущее
  поведение — `users.service.ts:468-479` — делало это без `generation` и аудита).
- Остальные поля профиля через `PATCH /profile/me` работают как раньше:
  «обратная совместимость» означает отсутствие регрессий для них, а не
  сохранение второго пути отвязки.
- Причина: иначе защита ADR-005 (код + ревокация + аудит) обходится одним
  запросом, и новые эндпоинты становятся необязательными.

### Привязка Telegram как security-событие (D3)

- При успешной привязке Telegram выполняется инкремент `generation` с отзывом
  сессий и создаётся `SecurityEvent` типа `TG_LINKED` (ADR-005:112).
- Точка входа — текущий deep-link флоу: `TelegramService.link` (после мержа
  `dev` она уже пишет `telegramLinkVerified`, `telegramUsername`) плюс инкремент
  `generation`.
- Следствие для UI: привязка Telegram завершает остальные сессии, тексты должны
  это отражать.

### Эндпоинты (D4)

Размещение — `profile.controller.ts` (`@Controller("profile")`), рядом с
`PATCH /profile/me`:

| Метод | Путь | Тело | Успех | Ошибки |
| --- | --- | --- | --- | --- |
| POST | `/profile/me/telegram/unlink/request` | — | `200 { sent: true, expiresAt }` | `400 TELEGRAM_NOT_LINKED`, `429 TOO_MANY_REQUESTS` |
| POST | `/profile/me/telegram/unlink/confirm` | `{ code }` | `200` (отвязано) | `400 INVALID_CODE`, `410 CODE_EXPIRED`, `409 ALREADY_UNLINKED`, `429 ATTEMPTS_EXCEEDED` |
| POST | `/profile/me/github/unlink` | — | `200` (отвязано) | `400 GITHUB_NOT_LINKED`, `409 LAST_AUTH_METHOD` |

Альтернатива (`auth/telegram/unlink/*` в `auth.controller.ts`) рассмотрена и
отклонена: домен — настройки аккаунта, FE-фича `update-profile`.

### Один секрет вместо token+code (D5)

- ADR-005:80 задаёт **один** секрет: одноразовый токен с TTL, который бот
  показывает владельцу чата, и который затем предъявляется в вебе. Отдельный
  клиентский `token` в теле запроса не нужен: `confirm` принимает только
  `{ code }`, привязка идёт к `userId` из JWT.
- Хранение — Redis (уже обязательная зависимость): ключ `telegram:unlink:{userId}`,
  значение — хеш кода + счётчик попыток + `expiresAt`. Потребление атомарное
  (`getdel`), по образцу существующего `TelegramService.link`.
- Параметры: код — 6 цифр (`crypto.randomInt`), TTL 10 минут, не более 5 попыток
  (далее запись инвалидируется), сравнение через `timingSafeEqual` по хешу,
  код и токены не логируются.
- Rate limit на `request`: 1 запрос в 60 секунд на пользователя (существующий
  throttler).

### Доставка кода отвязки (D6)

- Код отправляет **бот**, а не API: `TelegramService` не умеет отправлять
  произвольные сообщения, единственный консьюмер Telegram — `apps/telegram-bot`.
- API публикует envelope напрямую через `RabbitMqPublisher` (без записи в
  `notification_outbox`, чтобы код не оседал в БД) с типом
  `security.telegram_unlink_code` и payload `{ code, ttlMinutes }`.
- Бот рендерит текст через `renderNotification` по шаблону
  `notifications.events["security.telegram_unlink_code"]` (добавить ru/en) и
  отправляет его в чат.
- Транспорт at-least-once: повторный показ того же кода допустим.

### Доставка security-уведомлений (D7)

- `SecurityEvent` — это аудит и одновременно носитель состояния доставки
  (`notifiedAt`, `seenAt`, `attempts`). Доставку выполняет отдельный relay,
  публикующий в Telegram через `RabbitMqPublisher`.
- В `notifications`/`NotificationOutbox` security-события **не пишутся**
  (ADR-005:74; `NotificationType` не расширяется).
- **Соответствие ADR-005:95.** Требование «аудит пишется в той же транзакции
  через outbox (ADR-003)» выполняется по существу: `SecurityEvent` создаётся в
  одной транзакции с изменением `User`, а роль outbox-таблицы играет сама
  `security_events` (`notifiedAt`/`attempts`): relay забирает строки с
  `notifiedAt = null`, повторяет с backoff. Отдельная `NotificationOutbox` не
  используется намеренно — ADR-005:74 запрещает смешивать security с
  notifications. Гарантия «событие не теряется молча» (ADR-004) сохраняется.
- **Расширение модели ADR-005:92.** К полям из ADR-005:92 (`id`, `userId`,
  `type`, `ipAddress?`, `userAgent?`, `metadata?`, `createdAt`) добавляются поля
  состояния доставки — они нужны для компенсирующего in-app показа
  (ADR-005:140-142) и идемпотентной доставки.
- `TG_UNLINKED`: после отвязки `telegramChatId` уже пуст, Telegram-канал
  физически недоставим (`telegram-notification.channel.ts` требует
  `telegramLinkVerified && telegramChatId`) → уведомление показывается in-app при
  следующем входе.
- `GITHUB_UNLINKED`: если Telegram привязан — доставка в Telegram, иначе in-app.

### In-app fallback (D8)

- Нужен endpoint «непросмотренные security-события» и минимальный UI при
  следующем входе (баннер/модалка) с отметкой «просмотрено».
- Без него уведомление об отвязке Telegram не увидеть вовсе: `generation`
  отзывает и текущую сессию, а Telegram-канал уже недоступен.
- Полноценный экран истории событий — вне объёма.

### Запрет отвязки последнего способа входа (D9)

- Если после отвязки у пользователя не остаётся ни пароля, ни другой привязки
  (`passwordHash` nullable — существуют GitHub-only аккаунты), отвязка
  отклоняется с `409 LAST_AUTH_METHOD`.

### Прочее (D10–D14)

- **D10. ip/ua.** В новых эндпоинтах контекст берётся локально (`@Ip()`,
  `@Headers("user-agent")`). Сквозное изменение сигнатур `AuthService`/
  `UsersService` (ADR-005:94) — вне объёма.
- **D11. Ботовая `/unlink`.** Команда `/unlink` и внутренний
  `POST /telegram/unlink` сохраняются как есть, без подтверждения кодом
  (ADR-005:113). Подтверждение кодом — только для веб-сценария.
- **D12. Ретенция.** `security_events` хранится 12 месяцев, очищается кроном; не
  удаляется каскадом при soft-delete; `ipAddress`/`userAgent` не попадают ни в
  один публичный DTO (ADR-005:123-128).
- **D13. `resetPassword`.** Дополнительно обнуляет `githubId` (ADR-005:115) —
  входит в объём мелким коммитом.
- **D14. Безопасность кода.** Код никогда не пишется в БД и логи; в Redis
  хранится только хеш.

## 2. Источники требований

- [ADR-005: Security-уведомления и аудит событий безопасности](../../adr/ADR-005.md) — разделы «Принятое решение», «Последствия», описание подтверждаемой отвязки Telegram и ревокации сессий.
- [Задача: Frontend for slot scheduling, interview booking, and security (ADR-002…ADR-005)](../../tasks/frontend%20for%20slot%20scheduling%2C%20interview%20booking%2C%20and%20security%20%28ADR-002%E2%80%A6ADR-005%29.md) — Задача 7 (P3): Предупреждающие диалоги безопасности при отвязке аккаунтов.
- Текущая реализация: [`apps/api/src/modules/users/users.service.ts`](../../../apps/api/src/modules/users/users.service.ts) — метод `updateProfile` обнуляет `telegramUsername`/`gitUrl` без ревокации сессий.
- [Frontend спецификация: безопасная отвязка (UI-флоу)](../../frontend/specs/features/update-profile/security-unlink-frontend-spec.md) — потребитель эндпоинтов и флоу кода.
- Security/audit: модель `SecurityEvent`, сервисы аудита безопасности.

## 3. Обоснование

Текущая реализация веб-отвязки использует `PATCH /profile/me` с установкой `telegramUsername: null` / `gitUrl: null` (см. `UsersService.updateProfile`, обработка отвязки полей).

Согласно ADR-005:

- Backend-флоу подтверждаемой отвязки Telegram требует **одноразового кода из Telegram** и отдельного user-facing эндпоинта. Непосредственное обнуление через `PATCH /profile/me` не соответствует целевому флоу безопасности.
- При отвязке привязок (Telegram/GitHub) должна выполняться **ревокация сессий** (инкремент `generation`), что влияет на все остальные активные сессии пользователя.
- Требуется фиксация события отвязки в журнале безопасности (SecurityEvent) и отправка соответствующих уведомлений.
- Эндпоинты отвязки должны быть выделены в отдельные контроллер/методы (не смешивать с общей мутацией обновления профиля для операции отвязки).

## 4. Предположения и ограничения

- **Статус реализации ADR-005 — «Не реализовано» на backend** (см. ADR-005 §«Статус реализации»). Данная спецификация описывает целевое состояние реализации.
- Подтверждение отвязки Telegram кодом из Telegram — требует генерации одноразового кода с TTL (хранение в Redis), доставки кода в Telegram ботом и валидации кода при подтверждении (D5, D6).
- При отвязке GitHub также должна выполняться ревокация сессий (инкремент `generation`) согласно ADR-005.
- Генерация OpenAPI после реализации обязательна для последующей регенерации `@packages/api` (Orval).

## 5. Требования

### 5.1. Функциональные требования

> Конкретика (пути, статусы, параметры, схема доставки) зафиксирована в §1.1
> (решения D2–D13); ниже — требования в терминах поведения.

1. **Отдельные эндпоинты отвязки.** Реализовать user-facing эндпоинты для отвязки Telegram и GitHub (отдельно от `PATCH /profile/me`). Не использовать обнуление полей через `PATCH /profile/me` для операций безопасной отвязки. Дополнительно: `PATCH /profile/me` больше **не должен позволять** отвязку (обнуление `telegramUsername`/`gitUrl` отклоняется) — см. D2.
2. **Подтверждение отвязки Telegram кодом.** Реализовать флоу подтверждаемой отвязки Telegram:
- Эндпоинт запроса генерации одноразового кода для отвязки Telegram (с TTL).
- Эндпоинт подтверждения отвязки Telegram с одноразовым кодом (валидация кода, проверка TTL).
- Отправка одноразового кода в Telegram (через существующий механизм доставки: `RabbitMqPublisher` → `apps/telegram-bot`, см. D6). Отдельного клиентского токена нет — единственный секрет это код (D5).
3. **Ревокация сессий (generation).** При успешной отвязке (Telegram и GitHub) **обязательно** выполнять инкремент `generation` пользователя (`users.generation++`) для принудительной ревокации всех сессий, **включая текущую**. Инкремент также выполняется при привязке Telegram (D3).
4. **Аудит безопасности (SecurityEvent).** Фиксировать событие отвязки в `SecurityEvent` (тип события `TG_UNLINKED` при отвязке Telegram, `GITHUB_UNLINKED` при отвязке GitHub) с необходимым контекстом (userId, ip, userAgent, детали события).
5. **Security-уведомления.** Отправлять соответствующие security-уведомления пользователю при отвязке аккаунтов: доставка через собственный relay по `SecurityEvent`, при недоступности Telegram — in-app при следующем входе (D7, D8).
6. **Транзакционность.** Операции отвязки (обновление пользователя: сброс привязок, инкремент `generation`) и фиксация SecurityEvent должны выполняться с надлежащей обработкой ошибок (атомарность там, где это критично для целостности данных).
7. **Валидация и обработка ошибок.** Корректная обработка ошибок: аккаунт не привязан, уже отвязан, код истёк (TTL), неверный код, превышен лимит попыток, слишком частые запросы, попытка отвязать последний способ входа — с HTTP-статусами и кодами из таблицы D4.
8. **GitHub отвязка.** Реализовать отдельный эндпоинт отвязки GitHub с ревокацией сессий (инкремент `generation`), созданием SecurityEvent (`GITHUB_UNLINKED`) и отправкой security-уведомления; запрет отвязки последнего способа входа (D9).

### 5.2. Нефункциональные требования

- **Соответствие архитектуре NestJS.** Реализация в `apps/api` (UsersModule/AuthModule по необходимости), следовать существующим паттернам (Controller → Service → DTO).
- **Типобезопасность.** Использовать типизированные DTO (class-validator/class-transformer), строгая типизация TypeScript.
- **Prisma.** Обновление сущности User через Prisma с корректной работой транзакций при необходимости.
- **Безопасность.** Не логировать/не раскрывать одноразовые коды, токены в логах. Код хранится в Redis с TTL 10 мин (D5, D14).
- **Производительность.** Минимальные накладные расходы, корректная работа с конкурентными запросами (race conditions) при валидации кодов.
- **Обратная совместимость API.** Существующий `PATCH /profile/me` продолжает работать для остальных полей; операции отвязки через него больше не поддерживаются (D2) — новая логика вынесена в отдельные эндпоинты.
- **OpenAPI.** Сгенерировать корректную OpenAPI-спецификацию для новых эндпоинтов (для последующей регенерации Orval → `@packages/api`).

## 6. Зависимости

### 6.1. Внешние зависимости
- **Redis** (обязателен, уже используется auth/session/github-oauth): хранение одноразового кода отвязки с TTL (D5).
- **RabbitMQ**: доставка кода/уведомлений в бот через `RabbitMqPublisher` (D6, D7).

### 6.2. Внутренние зависимости
- `apps/api/src/modules/users/profile.controller.ts` — новые эндпоинты (D4)
- `apps/api/src/modules/users/users.service.ts` — логика отвязки; ограничение `PATCH` (D2)
- `apps/api/src/modules/telegram/telegram.service.ts` — привязка: `generation++` + `TG_LINKED` (D3); сохранение `link`/`unlink` (D11)
- `apps/api/src/modules/security-events/*` — модель/сервис `SecurityEvent` и релиз доставки (D7)
- `apps/api/src/modules/notifications/rabbitmq-publisher.service.ts` — публикация envelope в бот (D6)
- `apps/api/prisma/schema.prisma` — модель `SecurityEvent`; `User.generation` уже есть
- `packages/dto/*` — DTO для новых эндпоинтов
- `packages/i18n` — шаблон `security.telegram_unlink_code` (D6) и тексты in-app (D8)
- `apps/telegram-bot` — рендер и отправка сообщения с кодом (D6)

## 7. Критерии приёмки (Definition of Done)

### DoD (обязательные)

- [ ] Реализованы отдельные user-facing эндпоинты отвязки Telegram и GitHub (не через `PATCH /profile/me`).
- [ ] Реализован флоу подтверждения отвязки Telegram одноразовым кодом из Telegram (запрос кода → доставка кода ботом → подтверждение с кодом).
- [ ] При отвязке Telegram и GitHub **обязательно** выполняется инкремент `generation` (ревокация сессий, включая текущую).
- [ ] Создаются SecurityEvent с типами `TG_UNLINKED` и `GITHUB_UNLINKED` соответственно.
- [ ] Security-уведомления доставляются по решениям D7/D8 (relay по `SecurityEvent`, in-app fallback).
- [ ] Корректная обработка ошибок (TTL истёк, неверный код, уже отвязан и др.) с адекватными HTTP-статусами.
- [ ] Транзакционная целостность операций (минимизация race conditions).
- [ ] OpenAPI спецификация обновлена, сгенерированы типы/хуки в `@packages/api` (Orval).
- [ ] Unit/интеграционные тесты покрывают ключевые сценарии (успешная отвязка, неверный код, истёк TTL, ревокация сессий).
- [ ] Код соответствует правилам проекта (NestJS best practices, style guide).
- [ ] Нет утечки чувствительных данных (коды/токены не логируются).

### DoD по принятым решениям (§1.1)

- [ ] `PATCH /profile/me` больше не отвязывает: обнуление `telegramUsername`/`gitUrl` отклоняется, остальные поля работают как прежде (D2).
- [ ] При привязке Telegram выполняется `generation++` с отзывом сессий и создаётся `SecurityEvent` `TG_LINKED` (D3).
- [ ] Эндпоинты и их статусы соответствуют таблице D4 (включая `409 LAST_AUTH_METHOD`).
- [ ] Одноразовый код: Redis по `telegram:unlink:{userId}`, TTL 10 мин, 6 цифр, ≤5 попыток, rate limit 1/60с, сравнение `timingSafeEqual`, код не в БД/логах (D5).
- [ ] Код доставлен боту через `RabbitMqPublisher`; добавлен шаблон `notifications.events["security.telegram_unlink_code"]` (ru/en) (D6).
- [ ] `SecurityEvent` несёт состояние доставки; доставку выполняет отдельный relay; в `notifications`/`NotificationOutbox` ничего не пишется (D7).
- [ ] `GITHUB_UNLINKED` уходит в Telegram при наличии привязки; `TG_UNLINKED` — in-app при следующем входе (D7).
- [ ] Реализован endpoint непросмотренных security-событий и их отметка «просмотрено» (D8).
- [ ] retention: крон очистки 12 месяцев; `ipAddress`/`userAgent` отсутствуют в публичных DTO (D12).
- [ ] `resetPassword` дополнительно обнуляет `githubId` (D13).
- [ ] Проверки качества: `pnpm --filter api exec tsc --noEmit`, `lint`, `test`.

## 8. Связанные файлы

- `apps/api/src/modules/users/profile.controller.ts` (EDIT — новые эндпоинты)
- `apps/api/src/modules/users/users.service.ts` (EDIT — логика отвязки + ограничение `PATCH`)
- `apps/api/src/modules/telegram/telegram.service.ts` (EDIT — `generation++` и `TG_LINKED` при привязке)
- `apps/api/src/modules/security-events/*` (NEW — модель/сервис/relay/retention)
- `apps/api/src/modules/notifications/rabbitmq-publisher.service.ts` (USAGE — публикация envelope)
- `apps/api/prisma/schema.prisma` (EDIT — `SecurityEvent`)
- `apps/telegram-bot/*` (EDIT — рендер и отправка кода)
- `packages/dto/src/*` (NEW/EDIT — DTO для новых эндпоинтов)
- `packages/i18n/src/locales/{ru,en}/notifications.json` (EDIT — шаблон кода)
- OpenAPI schema → регенерация `@packages/api`

## 9. Риски

- **Race conditions**: конкурентная проверка/использование одноразового кода. Решение — атомарное потребление (`getdel`) в Redis, лимит попыток.
- **Хранение кода**: Redis TTL 10 мин, авто-экспирация (D5); в БД код не пишется.
- **Безопасность кода**: код 6 цифр через `crypto.randomInt`, хранится хеш, сравнение `timingSafeEqual`; не логируется (D5, D14).
- **Регрессии `PATCH /profile/me`**: PATCH продолжает работать для остальных полей, но перестаёт отвязывать (D2) — покрыть тестами.
- **Зависимость от Telegram**: доставка кода ботом через брокер (D6) должна корректно обрабатываться при недоступности/ошибках (retry/обработка ошибок).