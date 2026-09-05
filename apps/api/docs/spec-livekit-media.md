# Спецификация: LiveKit media — выдача join-токена (API) и поток media-событий (realtime)

Версия: `0.5.0` — см. [история версий](#история-версий).
Статус: черновик утверждённого плана.
Связанные документы: `plan-livekit-media.md` (план действий);
`plan-realtime-ws-auth.md` / `spec-realtime-ws-auth.md` (WS-аутентификация, на которую опирается тикет).

---

## 1. Цель

Внедрить выдачу LiveKit join-токена для WebRTC медиа (аудио/видео интервью) как
**REST-эндпоинт приложения `apps/api`** (в отличие от оригинального замысла «токен
через WS `media.token_request/response`»), а также приём LiveKit webhook-ов в
`apps/realtime` для события записи (активный говорящий в webhook-API LiveKit
отсутствует и определяется на клиенте).

Требования:

1. Join-токен выдаёт только `apps/api`, поскольку именно оно генерирует OpenAPI-
   спецификацию и типизированный клиент (orval) — контракт эндпоинта попадает в codegen.
2. Токен привязан к комнате (`room == sessionId` интервью) и к участнику
   (`identity == userId`); права публикации зависят от роли.
3. Авторизация выдачи строгая (fail-closed): только участник **активной** сессии;
   роль берётся исключительно из Redis-зеркала.
4. WebRTC-медиа идёт напрямую клиент ↔ LiveKit SFU; `apps/realtime` не участвует в
   передаче медиа, но ретранслирует в WS бизнес-событие записи (`media.recording`).
   Активный говорящий — клиентская индикация (`livekit-client`
   `ActiveSpeakersChanged`), через realtime не распространяется.
5. WS-аутентификация между `web` и `realtime` (тикет через `Sec-WebSocket-Protocol`)
   **не изменяется**.

За рамками (отложено): frontend (`livekit-client`, `useLiveKitRoom`, виджет
`session-workspace`); механика входа участника в комнату; WS `media.token_request/response`.

---

## 2. Текущее состояние (проверено по коду `dev`)

- **LiveKit env-переменные** уже объявлены в корневом `.env.example`
  (`LIVEKIT_URL=wss://livekit.yourdomain.com`, `LIVEKIT_API_KEY=devkey`,
  `LIVEKIT_API_SECRET=secret`), но **не читаются** ни API, ни Go.
- **`apps/api`**: отсутствует какой-либо код LiveKit. `env.validation.ts` и
  `configuration.ts` не содержат секции `livekit`. Существующий реалтайм-контракт —
  только `POST /api/v1/realtime/ticket` (`realtime.controller.ts`, одноразовый WS-тикет).
- **`apps/realtime` (Go)**: в `internal/ws/message.go` объявлены протокольные типы
  `MediaTokenRequestPayload`, `MediaTokenResponsePayload`, `MediaStatePayload`,
  `MediaSpeakerPayload`, `MediaRecordingPayload`, но **генерации токенов и webhook-приёма нет**;
  `media.token_request` в `client.go` попадает в `default` и не обрабатывается.
- **Redis-зеркало сессий** уже есть: `session:{id}:active` (`"true"`/`"closed"`),
  `session:{id}:members` (hash `userId → role`), обслуживается `SessionsService`;
  `RedisService.hget` доступен.
- **`apps/api` подписывает JWT** вручную через `jsonwebtoken` (HS256) в
  `token.service.ts` — та же схема применима к LiveKit-токену (`iss=apiKey`,
  `sub=identity`, `video` grant).
- **Ключи LiveKit**: self-hosted LiveKit использует пару `LIVEKIT_KEYS: apiKey: apiSecret`
  (`devkey: secret`), которой подписывается access token (JWT HS256).

---

## 3. Проблемы и решения

| # | Проблема | Решение |
|---|---|---|
| 1 | Оригинальный замысел «токен через WS `media.token_request/response`» не даёт OpenAPI-контракта | Выдача токена — REST `POST /api/v1/realtime/media-token`; WS-путь не реализуется (деприкейтед) |
| 2 | `LIVEKIT_*` не валидируются и не доступны в API | Добавить секцию `livekit` в `env.validation.ts` + `configuration.ts` (dev-дефолты для OpenAPI-генератора) |
| 3 | Роль участника — источник прав для публикации | Роль из `session:{id}:members` (только Redis, без Prisma-fallback): `INTERVIEWER`/`CANDIDATE` → `canPublish`, `OBSERVER` → subscribe-only |
| 4 | Выдача токена не должна работать для закрытых/несуществующих сессий | Проверка `session:{id}:active === "true"` перед выдачей |
| 5 | Нет канала для бизнес-событий от LiveKit (запись; активный говорящий — на клиенте) | Webhook `POST /webhooks/livekit` в `apps/realtime` → broadcast `media.recording` в комнату события (комната egress — из `egressInfo.roomName`); `participant.speaking_changed` в webhook-API LiveKit не существует |

---

## 4. Архитектурные решения

| Решение | Обоснование |
|---|---|
| A1. REST-эндпоинт `POST /api/v1/realtime/media-token` в `apps/api` | Приложение генерирует OpenAPI + orval-клиент; контракт типизирован для фронта; единый источник токенов |
| A2. Подпись через уже имеющийся `jsonwebtoken` (HS256) | LiveKit access token — стандартный JWT; не требуется новая зависимость; стиль совпадает с `token.service.ts` |
| A3. `room == sessionId` интервью, `identity == userId` | Единая комната на интервью, участники различаются по `sub`/identity; `sessionId` читается из тела запроса и проверяется по зеркалу |
| A4. Fail-closed проверки: активность + роль из Redis | Отсутствие/ошибка → 403 (симметрия с fail-closed реальтайма) |
| A5. Права по роли через `video` grant (матрица, §4.1) | `INTERVIEWER` — публикует camera/mic/screen; `CANDIDATE` — только camera/mic; `OBSERVER` — subscribe-only; у всех ролей `canPublishData: false` (данные по WS), запрещены `roomAdmin`/`roomRecord` |
| A6. Webhook в `apps/realtime` (Go), а не в API; обрабатывает только `egress_*` → `media.recording` | Webhook-ау должен делать broadcast в живые WS-клиенты комнаты — это доступно только realtime-сервису; записи (0.4.0) — единственное webhook-событие, нужное продукту (`speaking_changed` у LiveKit нет) |
| A7. Верификация подписи webhook-JWT из `Authorization` (HS256, webhook api key/secret) + сверка sha256-claim с хешем тела | LiveKit кладёт signed-JWT (включая `sha256` хеш payload) в `Authorization`; fallback на `Livekit-Webhook-Jwt` для legacy-серверов; сверка хеша привязывает подпись к содержимому (семантика `webhook.ReceiveWebhookEvent`); stdlib HMAC-SHA256, без новых зависимостей |
| A8. WS `media.token_request/response` не обрабатывается | Токен — только по REST; WS-канал остаётся для code/chat/presence collaboration (без изменений) |
| A9. WS-аутентификация (`ticket` в `Sec-WebSocket-Protocol`) не меняется | Полностью сохраняется текущий флоу из `spec-realtime-ws-auth.md` |

### 4.1 Матрица grants по роли (A5)

`canPublishSources` действует только при `canPublish: true`.
Источники LiveKit: `camera`, `microphone`, `screen_share`, `screen_share_audio`
(последний не включаем).

| Роль | `canPublish` | `canPublishSources` | `canSubscribe` | `canPublishData` | `roomAdmin` / `roomRecord` |
|---|---|---|---|---|---|
| `INTERVIEWER` | true | `[camera, microphone, screen_share]` | true | false | false / false |
| `CANDIDATE` | true | `[camera, microphone]` | true | false | false / false |
| `OBSERVER` | false | — | true | false | false / false |

Логика:
- `CANDIDATE` без `screen_share` — кандидат не транслирует свой экран; всё нужное
  покрывает общий редактор (синхронизация по WS).
- `INTERVIEWER` может шарить экран (условие/диаграмма).
- `canPublishData: false` у всех ролей — command/метаданные доставляются по WS,
  а не по data-channel LiveKit; включать только при появлении фичи.
- `OBSERVER` — строго subscribe-only.
- Модерация/запись — только через webhook/egress и server API, не клиентским токеном.

### Поток выдачи токена

```
apps/web (livekit-client)
   │  1. POST /api/v1/realtime/media-token {sessionId}        [AccessTokenGuard: Bearer + live auth:session:{sid}]
   ▼
apps/api RealtimeController → LivekitService.generateMediaToken(userId, sessionId):
   │  2. redis.get(session:{id}:active)  === "true"            иначе → 403
   │  3. redis.hget(session:{id}:members, userId) = role       отсутствие → 403
   │     grants по роли (см. §4.1)
   │  4. jwt.sign (HS256, LIVEKIT_API_SECRET):
   │     { iss: apiKey, sub: userId, nbf, exp: now+TTL,
   │       video: { room: sessionId, roomJoin: true, ...grants } }
   │  5. → { token, serverUrl: LIVEKIT_URL, roomName: sessionId }
   ▼
apps/web → room.connect(serverUrl, token) → LiveKit SFU ↔ peer'ы (WebRTC напрямую)
```

### Поток webhook (media-события)

```
LiveKit SFU ──POST /webhooks/livekit (Authorization: signed-JWT, HS256 по webhook api key/secret)──► apps/realtime (Go)
   │  [Go] верификация подписи stdlib HMAC-SHA256 + сверка sha256-claim с хешем тела → 401 при
   │       отсутствии/неверной подписи/расхождении хеша (fallback: Livekit-Webhook-Jwt для legacy)
   │  egress_started|updated|ended  → MediaRecordingPayload{status, recordUrl}
   │       комната — из egressInfo.roomName (в payload нет room.name)
   ▼
hub.BroadcastToRoom(room, envelope):
   ├─ локальная комната есть → room.Broadcast(data, "")    (локально + Redis-репликация)
   └─ комнаты нет + broadcaster вкл. → broadcaster.Publish(ctx, sessionID, data) [session:<id>:events]
   (иначе → false, Warn)     WS-клиенты комнаты получают media.recording
```

---

## 5. Требования к изменениям по компонентам

### 5.1 `packages/dto`

- [нов] `src/realtime/media-token.dto.ts`:
  - `mediaTokenRequestSchema = z.object({ sessionId: z.string().uuid(...) })`,
    `type MediaTokenRequestDto`;
  - `type MediaTokenResponseDto = { token: string; serverUrl: string; roomName: string }`.
- [изм] `src/index.ts` — экспорт новых типов/схемы.

### 5.2 API (NestJS)

- [изм] `src/config/env.validation.ts` — `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET`, `LIVEKIT_TOKEN_TTL_SECONDS` (dev-дефолты; production — actual
  значения обязательны).
- [изм] `src/config/configuration.ts` — секция `livekit: { url, apiKey, apiSecret, tokenTtlSeconds }`.
- [нов] `src/modules/sessions/session-keys.ts` — общие хелперы `sessionActiveKey`,
  `sessionMembersKey` (используются `SessionsService` и `LivekitService`, анти-дрейф).
- [изм] `src/modules/sessions/sessions.service.ts` — перевести на хелперы `session-keys.ts`.
- [нов] `src/modules/realtime/livekit.service.ts` — `generateMediaToken(userId, sessionId)`:
  fail-closed проверки (активность, роль из Redis), grants по матрице §4.1
  (INTERVIEWER/CANDIDATE/OBSERVER, `canPublishSources`, `canPublishData`);
  **неизвестное значение роли → `ForbiddenException`** (fail-closed; роли в Redis —
  в верхнем регистре); подпись JWT, возврат `MediaTokenResponseDto`.
- [изм] `src/modules/realtime/realtime.controller.ts` — `POST media-token`
  (`@ZodBody`, `@Body(ZodValidationPipe)`, `@CurrentUser("sub")`, `registerSchema`);
  наследует `AuthThrottlerGuard` + глобальный `AccessTokenGuard`.
- [изм] `src/modules/realtime/realtime.module.ts` — `providers: [LivekitService]`, `exports`.
- [нов] `test/realtime-media-token.e2e-spec.ts`.
- [нов] `src/modules/realtime/livekit.service.spec.ts`.

### 5.3 Realtime (Go)

- [изм] `internal/config/config.go` — `LiveKitWebhookAPIKey` (`LIVEKIT_WEBHOOK_API_KEY`),
  `LiveKitWebhookAPISecret` (`LIVEKIT_WEBHOOK_API_SECRET`); в production обязательны
  (fail-closed, как `JWT_ACCESS_SECRET`).
- [нов] `internal/handler/livekit.go` — `POST /webhooks/livekit`: верификация подписи
  `Authorization`-JWT (fallback `Livekit-Webhook-Jwt` для legacy; stdlib HMAC-SHA256,
  пересчёт по webhook api secret, `hmac.Equal`, `exp`/`nbf`) **+ сверка sha256-claim
  токена с `SHA-256(raw body)`** (привязка подписи к содержимому),
  парсинг события, маппинг **только** `egress_*` → `media.recording` (`egressInfo`
  start→`started`, update→`started`, end→`stopped`), комната — из `egressInfo.roomName`,
  broadcast в комнату. `participant.speaking_changed` не обрабатывается (события нет).
- [изм] `cmd/server/main.go` — регистрация `/webhooks/livekit` на существующем роутере
  (JWT-конвейер WS внутри `wsHandler.HandleSessionWS`, без отдельного роутера; тело
  ограничить `http.MaxBytesReader`).
- [изм] `internal/ws/hub.go` (+ `room.go` при необходимости) — `BroadcastToRoom(sessionID, data) bool`:
  локальная комната есть → `room.Broadcast(data, "")`; комнаты нет и broadcaster включён →
  `broadcaster.Publish(ctx, sessionID, data)` в `session:<id>:events` (кросс-репликовая
  доставка, echo-подавление по InstanceID не мешает); иначе → `false` + Warn.
- [нов] тесты парсинга webhook-тела, маппинга `egress_*`, верификации подписи
  (`Authorization` + body-hash) и маппинга `egressInfo.roomName`.

### 5.4 Инфраструктура

- [изм] `docker-compose.yml` — сервис `livekit` (`livekit/livekit-server`; `LIVEKIT_KEYS`,
  `LIVEKIT_WEBHOOK_URL`, `LIVEKIT_WEBHOOK_API_KEY/SECRET`), опц. `livekit-dev-token`.
- [изм] корневой `.env.example` — LiveKit-блок: комментарий про `media-token`-эндпоинт,
  `LIVEKIT_TOKEN_TTL_SECONDS`, `LIVEKIT_WEBHOOK_API_KEY`/`LIVEKIT_WEBHOOK_API_SECRET`
  (для realtime; те же, что у контейнера `livekit`).
- [изм] `docker-compose.prod.yml` — env `LIVEKIT_*` в сервис `api`,
  `LIVEKIT_WEBHOOK_API_KEY`/`LIVEKIT_WEBHOOK_API_SECRET` в сервис `realtime`.

---

## 6. Конфигурация env

| Переменная | Потребитель | Значение по умолчанию | Назначение |
|---|---|---|---|
| `LIVEKIT_URL` | API | `ws://localhost:7880` | URL SFU, отдаётся как `serverUrl` |
| `LIVEKIT_API_KEY` | API | `devkey` | `iss` токена / ключ подписи |
| `LIVEKIT_API_SECRET` | API | `secret` | HS256-секрет подписи LiveKit-токена |
| `LIVEKIT_TOKEN_TTL_SECONDS` | API | `1800` | TTL токена (30 мин; reconnect LiveKit продлевает самостоятельно) |
| `LIVEKIT_WEBHOOK_API_KEY` | Realtime (Go) | `devkey` | Ключ верификации подписи webhook-JWT из `Authorization` (совпадает с webhook-ключом контейнера `livekit`) |
| `LIVEKIT_WEBHOOK_API_SECRET` | Realtime (Go) | `secret` | HS256-секрет подписи webhook (production — обязателен, fail-closed как `JWT_ACCESS_SECRET`) |

В production переменные API обязательны (fail-closed через `env.validation.ts`/
`config.Load`); dev-дефолты нужны, чтобы OpenAPI-генератор (`app.init()` с `validate`)
не падал на пустых значениях.

---

## 7. Модель данных

Новых таблиц нет. Используются существующие Redis-ключи зеркала сессий:

| Ключ | Назначение для media-token |
|---|---|
| `session:{id}:active` | Fail-closed проверка активности сессии (`=== "true"`) |
| `session:{id}:members` | Роль участника (`hget(session:{id}:members, userId)`); отсутствие → 403; значение — в верхнем регистре (`INTERVIEWER`/`CANDIDATE`/`OBSERVER`), иное значение роли → 403 |

LiveKit-комната = `sessionId` интервью. Идентичность участника в LiveKit = `userId`
(запрещено класть в `identity`/`room` персональные данные — только UUID).

---

## 8. Тестирование

- **API**: `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`.
  `livekit.service.spec.ts` — grants по матрице §4.1:
  INTERVIEWER (`canPublishSources` включает `screen_share`),
  CANDIDATE (`canPublishSources` = `[camera, microphone]`, без `screen_share`),
  OBSERVER (`canPublish: false`),
у всех ролей `canPublishData: false`, `roomAdmin`/`roomRecord` = false;
   403 при отсутствии роли/неактивной сессии, **неизвестном значении роли**,
   claims токена (sub/iss/room/exp−nbf).
  `realtime-media-token.e2e-spec.ts` — 201/400/401/403.
- **Realtime**: `go test ./...`, `go vet ./...` в `apps/realtime`; unit-парсинг webhook-тела,
  маппинг `egress_*` → `media.recording` (в т.ч. комната из `egressInfo.roomName`);
  верификация `Authorization`-JWT канонической фикстурой (валидная подпись / другая /
  истёкший `exp` / **расхождение sha256-claim с хешем тела**);
  401 при отсутствующем/неверно подписанном заголовке.
- **Codegen**: `pnpm generate:api && pnpm generate:client`; `pnpm codegen:check`.
- **Сквозной сценарий** — см. «Контрольная проверка» в `plan-livekit-media.md`.

---

## 9. Порядок развёртывания и риски

1. **Phase 1–2** (`LivekitService` + эндпоинт + codegen) — выкатывать вместе: эндпоинт
   зависит от типа `MediaTokenResponseDto` и конфига.
2. **Phase 3** (webhook) — независимо, после Phase 1; LiveKit должен быть настроен на
   `LIVEKIT_WEBHOOK_URL` (после выхода Phase 3 на реальный URL). До настройки webhook
   неверные/отсутствующие события безопасно игнорируются (200).
3. **Phase 4** (инфраструктура) — локальный LiveKit/`devkey` только для dev; в prod —
   внешний LiveKit (Cloud или отдельный сервер) с реальными ключами и TURN/STUN
   для NAT.

### Риски

- **Генератор OpenAPI** (`generate-openapi.ts`) вызывает `app.init()` с `validate` —
  недостающие `LIVEKIT_*` без дефолтов сломают `generate:api`. Поэтому в
  `env.validation.ts` задаются dev-дефолты (риск: dev-значения могут утечь в prod,
  если переменные не заданы — компенсируется тем, что `config.Load`/prod-compose
  явно прокидывают реальные ключи).
- **Секреты**: `LIVEKIT_API_SECRET` и `LIVEKIT_WEBHOOK_API_SECRET` не логировать;
  `identity`/`room` — только UUID, без PII (грет LiveKit, требование платформы).
- **`canPublish` для `observer`**: subscribe-only токен не предотвращает реконнект
  наблюдателя с полными правами, если наблюдатель получит полноценный токен иным
  способом — вывод токена контролируется только API; место утечки — схема `members`.
- **Webhook spoofing**: без проверки подписи атакующий может рассылать фейковые
  `media.recording`. Обязательна верификация `Authorization`-JWT по webhook api
  key/secret + сверка sha256-claim с хешем тела (в prod — fail-closed: поля
  обязательны, как `JWT_ACCESS_SECRET`).
- **Активный говорящий вне webhook**: LiveKit не шлёт `speaking_changed` из
  box'а webhook — индикация говорящего определяется клиентским SDK
  (`ActiveSpeakersChanged`) на фронтенде; `media.speaker` / `MediaSpeakerPayload`
  из realtime не рассылаются до появления фичи клиентского релея (см. §1).
- **TTL токена**: 30 мин; LiveKit продлевает reconnect. Слишком короткий TTL →
  частые перевыпуски.
- **LiveKit-комната и `session:{id}:active`**: если сессия закрыта после выдачи токена,
  LiveKit-подключение сохранится до exp — инвалидация токена не выполняется (LiveKit
  Cloud умеет remove-participant, но это вне скоупа).

---

## 10. Файлы для изменения/создания (манифест)

### `packages/dto`
- [нов] `src/realtime/media-token.dto.ts`
- [изм] `src/index.ts`

### API
- [изм] `apps/api/src/config/env.validation.ts`
- [изм] `apps/api/src/config/configuration.ts`
- [нов] `apps/api/src/modules/sessions/session-keys.ts`
- [изм] `apps/api/src/modules/sessions/sessions.service.ts`
- [нов] `apps/api/src/modules/realtime/livekit.service.ts`
- [изм] `apps/api/src/modules/realtime/realtime.controller.ts`
- [изм] `apps/api/src/modules/realtime/realtime.module.ts`
- [нов] `apps/api/src/modules/realtime/livekit.service.spec.ts`
- [нов] `apps/api/test/realtime-media-token.e2e-spec.ts`

### Realtime (Go)
- [изм] `apps/realtime/internal/config/config.go`
- [нов] `apps/realtime/internal/handler/livekit.go`
- [изм] `apps/realtime/cmd/server/main.go`
- [изм] `apps/realtime/internal/ws/hub.go` (+ `room.go` при необходимости)
- [нов] тесты парсинга webhook / маппинга событий

### Инфраструктура
- [изм] `docker-compose.yml`
- [изм] корневой `.env.example`
- [изм] `docker-compose.prod.yml`

---

## История версий

| Версия | Дата | Изменения |
|---|---|---|
| 0.1.0 | 2026-09-05 | Первоначальная спецификация (решения A1–A9, потоки, манифест файлов) |
| 0.2.0 | 2026-09-05 | Добавлена матрица grants §4.1 (A5): `canPublishSources` по ролям (CANDIDATE без `screen_share`), `canPublishData`, запрет `roomAdmin`/`roomRecord`; обновлены §5.2 и §8 |
| 0.3.0 | 2026-09-05 | Webhook-авторизация (A7): верификация подписи `Livekit-Webhook-Jwt` (stdlib HMAC-SHA256) вместо статического `LIVEKIT_WEBHOOK_AUTH_TOKEN`; env `LIVEKIT_WEBHOOK_API_KEY/SECRET`; обновлены §5.3, §5.4, §6, §8, §9 |
| 0.4.0 | 2026-09-05 | `canPublishData: false` всем ролям в матрице §4.1 / A5 / §8 (данные по WS, а не data-channel); нормализация egress-статусов записи к словарю `media.recording` (`started`/`stopped`/`failed`) |
| 0.5.0 | 2026-09-05 | Коррективы по глубокому анализу: webhook-JWT читается из `Authorization` (fallback `Livekit-Webhook-Jwt` для legacy) + сверка sha256-claim с хешем тела (A7, §1, §3, §5.3, §6, §8, §9); webhook обрабатывает только `egress_*` → `media.recording`, активирующий говорящий — на клиенте (A6, §1, §3, §5.3, §9); комната egress из `egressInfo.roomName`; `BroadcastToRoom` с fallback на `broadcaster.Publish` при отсутствии локальной комнаты (кросс-реплики); неизвестная роль → 403 (A4, §5.2, §7, §8); общие хелперы `session-keys.ts` (§5.2, §10) |