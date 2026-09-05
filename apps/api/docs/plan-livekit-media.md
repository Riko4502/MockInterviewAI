# План действий: LiveKit media — выдача join-токена в API и вебхук в realtime

Версия: `0.5.0` — см. [история версий](#история-версий).
Статус: утверждённый план (фазы ещё не выполнены).
Документ: `docs/plan-livekit-media.md`
Спецификация: `docs/spec-livekit-media.md`

Затрагиваемые сервисы: `apps/api` (NestJS), `apps/realtime` (Go), `packages/dto`, инфраструктура (`docker-compose*`, `.env`).

---

## Фазы

| Фаза | Содержание | Зависимости |
|---|---|---|
| 1 | API: конфиг `livekit` + `LivekitService` (проверки сессии/роли, подпись join-токена) | — |
| 2 | ДТО в `packages/dto` + контроллер `POST /realtime/media-token` + codegen | 1 |
| 3 | Realtime (Go): webhook `POST /webhooks/livekit` → `media.recording` (egress) | 1 |
| 4 | Инфраструктура: LiveKit-сервер в compose, env, prod-compose | 1, 3 |
| 5 | Тесты и сквозная проверка | 1–4 |

За рамками (отложено, не входит в фазы): frontend-интеграция (`livekit-client`,
`useLiveKitRoom`, виджет `session-workspace`); WS-путь `media.token_request/response`
(остаётся необработанным, деприкейтед); сервисный JWT для realtime→api (не нужен —
realtime не вызывает API); механика входа участника в комнату.

---

## Phase 1 — API: конфиг `livekit` + `LivekitService`

### Шаги
1. `apps/api/src/config/env.validation.ts` — добавить в `envSchema`:
   - `LIVEKIT_URL: z.string().default("ws://localhost:7880")` — dev-дефолт
     (генератор OpenAPI стубит Prisma/Redis и вызывает `app.init()`, где
     `ConfigModule.forRoot` с `validate` — без дефолта генерация упадёт);
   - `LIVEKIT_API_KEY: z.string().default("devkey")`;
   - `LIVEKIT_API_SECRET: z.string().default("secret")` (мин. длина — согласовать
     с ключами LiveKit; в production значение обязательно);
   - `LIVEKIT_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1800)`.
2. `apps/api/src/config/configuration.ts` — секция `livekit`:
   `{ url, apiKey, apiSecret, tokenTtlSeconds }` (ключи доступа `livekit.*`).
3. Создать `apps/api/src/modules/realtime/livekit.service.ts`:
   - `@Injectable`, конструктор: `ConfigService`, `RedisService`;
- ключи: `session:{id}:active`, `session:{id}:members` — вынести в общий файл
      `apps/api/src/modules/sessions/session-keys.ts` (`sessionActiveKey`,
      `sessionMembersKey`) и использовать из `SessionsService` и `LivekitService`
      (анти-дрейф, суффиксы в одном месте);
   - `generateMediaToken(userId, sessionId): Promise<MediaTokenResponseDto>`:
     - `redis.get(sessionActiveKey(sessionId))` — если `!== "true"` → `ForbiddenException`
       («session is not active»);
- `redis.hget(sessionMembersKey(sessionId), userId)` — роль только из Redis,
        отсутствие → `ForbiddenException` («not a member of this session»);
      - grants по роли (матрица, `canPublishSources` — только при `canPublish: true`):
        - `INTERVIEWER`: `canPublish: true`,
          `canPublishSources: [camera, microphone, screen_share]`, `canSubscribe: true`;
        - `CANDIDATE`: `canPublish: true`,
          `canPublishSources: [camera, microphone]` (без `screen_share`), `canSubscribe: true`;
        - `OBSERVER`: `canPublish: false`, `canSubscribe: true`;
        - неизвестная роль (не `INTERVIEWER`/`CANDIDATE`/`OBSERVER`) →
          `ForbiddenException` (fail-closed); роли в Redis хранятся в верхнем регистре;
        - всем: `canPublishData: false` (коллаборация идёт по WS, а не по data-channel
          LiveKit), `roomAdmin: false`, `roomRecord: false`;
      - JWT HS256 через `jsonwebtoken` (как в `token.service.ts`, без новой зависимости):
        `iss = livekit.apiKey`, `sub = userId` (identity), `nbf = now`,
        `exp = now + livekit.tokenTtlSeconds`,
        `video: { room: sessionId, roomJoin: true, ...grants }`;
     - вернуть `{ token, serverUrl: livekit.url, roomName: sessionId }`.
   - timeout/лучшая практика: проверки Redis — через `try/catch`; исключение Redis
     пробрасывать (Nest → `500`, паттерн как в API).

### Проверка
- `livekit.service.spec.ts`:
  - `INTERVIEWER` → `canPublish: true`, `canPublishSources` включает
    `camera`, `microphone`, `screen_share`;
  - `CANDIDATE` → `canPublish: true`, `canPublishSources` = `[camera, microphone]`
    (без `screen_share`);
  - `OBSERVER` → `canPublish: false`, `canSubscribe: true`;
  - всем: `canPublishData: false`, `roomAdmin: false`, `roomRecord: false`;
  - нет роли в Redis → `ForbiddenException`;
  - неизвестное значение роли (не `INTERVIEWER`/`CANDIDATE`/`OBSERVER`) → `ForbiddenException`;
  - `active` ≠ `"true"` / отсутствует → `ForbiddenException`;
  - decode JWT: `sub == userId`, `video.room == sessionId`, `iss == apiKey`,
    `exp - nbf ≈ LIVEKIT_TOKEN_TTL_SECONDS`.
- `pnpm --filter api lint && pnpm --filter api test`.

---

## Phase 2 — ДТО + контроллер + codegen

### Шаги
1. `packages/dto/src/realtime/media-token.dto.ts` (новое):
   - `mediaTokenRequestSchema = z.object({ sessionId: z.string().uuid("Некорректный sessionId") })`;
   - `type MediaTokenRequestDto = z.infer<...>`;
   - `type MediaTokenResponseDto = { token: string; serverUrl: string; roomName: string }`.
   - экспорт из `packages/dto/src/index.ts`.
2. `apps/api/src/modules/realtime/realtime.controller.ts` — добавить:
   - `POST media-token`; `@ZodBody(mediaTokenRequestSchema, "MediaTokenRequestDto")`;
   - `@Body(new ZodValidationPipe(mediaTokenRequestSchema))` → 400;
   - `@CurrentUser("sub") userId`;
   - ответ `registerSchema("MediaTokenResponseDto", { token, serverUrl, roomName })`;
   - наследует `@ApiTags("Realtime")`, `@ApiBearerAuth()`, `AuthThrottlerGuard`
     и глобальный `AccessTokenGuard` (без `@Public`) — без изменений.
3. `apps/api/src/modules/realtime/realtime.module.ts` — `providers: [LivekitService]`,
   `exports: [LivekitService]`.
4. Codegen: `pnpm generate:api && pnpm generate:client` → в
   `packages/api/src/generated` появится `realtimeControllerGetMediaToken`.

### Проверка
- `apps/api/test/realtime-media-token.e2e-spec.ts`:
  - login → создать сессию → `POST /realtime/media-token {sessionId}` → 201,
    `serverUrl == LIVEKIT_URL`, `roomName == sessionId`, decode JWT (`video.room`);
  - не-участник сессии → 403; закрытая сессия → 403; не UUID `sessionId` → 400;
    без Authorization → 401.
- `pnpm codegen:check` (не меняет закоммиченный generated).

---

## Phase 3 — Realtime (Go): webhook LiveKit

### Шаги
1. `apps/realtime/internal/config/config.go` — вместо статического webhook-токена
   поля верификации подписи LiveKit:
   - `LiveKitWebhookAPIKey` (`LIVEKIT_WEBHOOK_API_KEY`) и
     `LiveKitWebhookAPISecret` (`LIVEKIT_WEBHOOK_API_SECRET`);
   - в `production` — обязательные, fail-closed (как `JWT_ACCESS_SECRET` в
     `config.Load`); в dev — дефолты `devkey`/`secret` для локальных тестов.
2. `apps/realtime/internal/handler/livekit.go` (новое):
   - `POST /webhooks/livekit`;
   - верификация подписи **без новых зависимостей** (stdlib `crypto/hmac`,
     `encoding/base64`, `crypto/sha256`): чтение signed-JWT из `Authorization`
     (fallback на `Livekit-Webhook-Jwt` для legacy-серверов; compact JWT
     `header.payload.signature`), пересчёт `HMAC-SHA256(header+"."+payload, secret)`,
     сравнение через `hmac.Equal` и проверка `exp`/`nbf`;
     **дополнительно** — сверка sha256-claim токена с `SHA-256(raw body)` (привязка
     подписи к содержимому, как в официальном `webhook.ReceiveWebhookEvent`);
     отсутствующий/невалидный заголовок или несовпадение хеша → 401.
   - разбор тела LiveKit WebhookEvent (`event`, `egressInfo`, ...);
   - **обрабатываются только `egress_started` / `egress_updated` / `egress_ended`**:
     собрать `MediaRecordingPayload` (комната — из `egressInfo.roomName`;
     status по словарю `media.recording` из `message.go`: `started|stopped|failed`;
     `egress_started` → `started`, `egress_updated` → `started` (прогресс доставки),
     `egress_ended` → `stopped`; `recordUrl` при наличии) и отправить broadcast в
     комнату через hub;
   - `participant.speaking_changed` НЕ обрабатывается — такого webhook-события у
     LiveKit нет; активный говорящий определяется на клиенте (`livekit-client`
     `ActiveSpeakersChanged`), defer-фронтенд;
   - пустые/неизвестные события → 200 (LiveKit считает доставленным), `event` с
     неизвестной комнатой → 200 best-effort (значение ЗАДАЧ выбор: логировать `Warn`).
3. `apps/realtime/cmd/server/main.go` — регистрация `/webhooks/livekit` на
   существующем роутере `r` (JWT-конвейер WS живёт внутри `wsHandler.HandleSessionWS`,
   мidoчередь `Recoverer`/`RequestLogger`/CORS достаются автоматически; тело дополнительно
   ограничить `http.MaxBytesReader`).
4. `apps/realtime/internal/ws/hub.go` — метод `BroadcastToRoom(sessionID string, data []byte) bool`:
   - комната существует локально → `room.Broadcast(data, "")` (локально + Redis-репликация);
   - комнаты нет (идле-рейп / клиенты только на другой реплике) и broadcaster включён →
     `broadcaster.Publish(ctx, sessionID, data)` в канал `session:<id>:events`
     (удалённые реплики получат через свою подписку; echo-подавление по InstanceID
     не мешает — локальной комнаты нет);
   - иначе → `false` (лог `Warn`).

### Проверка
- unit-tests: верификация подписи `Authorization`-JWT канонической фикстурой
  (известный secret → валидный токен; другая подпись → ошибка; истёкший `exp` → ошибка;
  расхождение sha256-claim с хешем тела → 401);
  парсинг webhook-тела в чистую функцию; маппинг `egress_*` → корректный `media.recording`
  (в т.ч. комната из `egressInfo.roomName`).
- интеграционный тест: POST `/webhooks/livekit` с корректно подписанным JWT и событием
  `egress_ended` → клиенты комнаты получили `media.recording`;
  отсутствующий/неверно подписанный заголовок или несовпадение хеша тела → 401.
- `cd apps/realtime && go test ./... && go vet ./...`.

---

## Phase 4 — Инфраструктура

### Шаги
1. `docker-compose.yml`:
   - сервис `livekit` (`livekit/livekit-server:latest`), порты `7880` (сигнальный WS/HTTP),
     `7881` (TCP media), UDP `50000-50200` (WebRTC), env `LIVEKIT_KEYS: devkey: secret`,
     `LIVEKIT_WEBHOOK_URL: http://realtime:8080/webhooks/livekit`,
     `LIVEKIT_WEBHOOK_API_KEY: devkey`, `LIVEKIT_WEBHOOK_API_SECRET: secret`
     (из корневого `.env` через `${...}` с дефолтами);
   - сервис `livekit-dev-token` (генератор dev-токенов; опц., может не использоваться).
2. Корневой `.env.example` — актуализировать LiveKit-блок:
   комментарий «выдаётся через `POST /api/v1/realtime/media-token`»; добавить
   `LIVEKIT_TOKEN_TTL_SECONDS=1800`, `LIVEKIT_WEBHOOK_API_KEY=devkey`,
   `LIVEKIT_WEBHOOK_API_SECRET=secret` (для realtime).
3. `docker-compose.prod.yml` — в сервис `api` добавить env:
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_TOKEN_TTL_SECONDS`;
   в сервис `realtime` — `LIVEKIT_WEBHOOK_API_KEY`, `LIVEKIT_WEBHOOK_API_SECRET`.

### Проверка
- `docker compose config` проходит; LiveKit-сервер поднимается и принимает
  `ws://localhost:7880`; webhook достукивается до realtime (лог `Warn`/`200` на ping-событии).

---

## Phase 5 — Контрольная проверка (сквозная)

1. `docker compose up -d redis livekit`; `REDIS_ENABLED=true` для realtime;
   выравнивание портов: `API_PORT=3001`, `NEXT_PUBLIC_API_URL=http://localhost:3001`,
   `NEXT_PUBLIC_REALTIME_URL=ws://localhost:8080`.
2. API: login → access; создать сессию; добавить участника.
3. `POST /realtime/media-token {sessionId}` (Bearer) → 201 `{token, serverUrl, roomName}`.
4. LiveKit: подключение к `serverUrl` с `token` из п.3 (livekit-cli / UI-клиент) →
   участник в комнате `sessionId`; второй участник той же сессии — та же комната.
5. Обычный участник → `canPublish`;
   `observer`-участник → token с `canPublish: false` (subscribe-only);
   не-участник → 403; закрытая сессия → 403.
6. Webhook: событие `egress_ended` (подписанный `Authorization`-JWT, body-hash)
   → WS клиенты комнаты получили `media.recording`.
   (Активный говорящий на сквозной проверке не участвует — определяется на клиенте.)
7. Команды: `cd apps/realtime && go test ./... && go vet ./...`;
   `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`;
   `pnpm codegen:check`.

---

## Порядок коммитов

- `feat(api,realtime): livekit media join-токен (REST в API) + конфиг` — Phase 1, 2.
- `feat(realtime): livekit webhook → media.recording (egress)` — Phase 3.
- `chore(infra): livekit server в compose + env для api/realtime` — Phase 4.

Коммиты — только после явного запроса.

---

## История версий

| Версия | Дата | Изменения |
|---|---|---|
| 0.1.0 | 2026-09-05 | Первоначальный план (фазы 1–5, порядок коммитов) |
| 0.2.0 | 2026-09-05 | Ужесточены grants: `canPublishSources` по ролям (CANDIDATE без `screen_share`), `canPublishData`, запрет `roomAdmin`/`roomRecord`; статус «утверждённый план» |
| 0.3.0 | 2026-09-05 | Webhook-авторизация: верификация подписи `Livekit-Webhook-Jwt` (stdlib HMAC-SHA256) вместо статического `LIVEKIT_WEBHOOK_AUTH_TOKEN`; в realtime env `LIVEKIT_WEBHOOK_API_KEY/SECRET` |
| 0.4.0 | 2026-09-05 | Порты LiveKit в compose: 7880 (WS/HTTP), 7881 (TCP media), UDP 50000–50200; `canPublishData: false` всем ролям (данные по WS); нормализация egress-статусов к словарю `media.recording` (`started`/`stopped`/`failed`) |
| 0.5.0 | 2026-09-05 | Коррективы по глубокому анализу: webhook-подпись в `Authorization` (fallback `Livekit-Webhook-Jwt` для legacy) + сверка sha256-claim с хешем тела; webhook обрабатывает только `egress_*` → `media.recording` (`participant.speaking_changed` не существует, активный говорящий — на клиенте); комната egress из `egressInfo.roomName`; `BroadcastToRoom` с fallback на `broadcaster.Publish` при отсутствии локальной комнаты; неизвестная роль → 403; общие хелперы `session-keys.ts` |