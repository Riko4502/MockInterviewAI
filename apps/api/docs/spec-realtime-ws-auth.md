# Спецификация: аутентификация входящих подключений к WS-серверу (realtime)

Статус: черновик утверждённого плана (ветка `feat/realtime-ws-auth`).
Связанные документы: `plan-realtime-ws-auth.md` (план действий), `docs/WEBSOCKET_ARCHITECTURE.md`.

---

## 1. Цель

Обеспечить безопасную аутентификацию и авторизацию входящих WebSocket-подключений
к сервису `apps/realtime` (Go) с учётом существующей аутентификации `apps/api` (NestJS).

Требования:

1. Браузерный WS-handshake должен аутентифицироваться без установки заголовков
   (`new WebSocket()` их не ставит) и без кросс-доменных cookie.
2. Авторизация комнат должна быть строгой (fail-closed): подключение только для
   участников активной интервью-сессии; роль определяется источниками правды.
3. Logout и деактивация аккаунта должны обрывать активные WS-соединения.
4. Вкладка на интервью длиннее 15 минут должна переподключаться без потери сессии.

---

## 2. Текущее состояние (проверено по коду `dev`)

### API (NestJS)

- Access-токен: JWT HS256, 15 мин, claims `sub` (userId), `sid` (UUID auth-сессии),
  `typ: "access"`, `iss`, `aud`, `iat`, `exp`, `jti` —
  `apps/api/src/modules/auth/services/token.service.ts:47-66`.
- Refresh-токен: JWT HS256, 7 дней, HttpOnly cookie `refresh_token` с `Path=/api/v1/auth` —
  `apps/api/src/modules/auth/auth.controller.ts:257-361`.
- Глобальный guard: `AccessTokenGuard` — access-токен строго из
  `Authorization: Bearer`, верификация JWT (HS256/iss/aud/exp/typ), **без** проверки
  живой сессии — `apps/api/src/common/guards/access-token.guard.ts:47-85`,
  регистрация `app.module.ts:54-56`.
- `JwtAuthGuard` (добавляет проверку живой сессии `auth:session:{sid}` в Redis, иначе `401`)
  подключён локально и только на `ProfileController` —
  `profile.controller.ts:31`, `jwt-auth.guard.ts:35-38`. Итог: live-проверка работает
  не глобально, а лишь на маршрутах `/profile`; на них же JWT верифицируется дважды.
- Auth-сессия в Redis: `auth:session:{sid}` с HMAC-хешем refresh-токена, TTL 7 дней —
  `apps/api/src/modules/auth/services/auth-session.service.ts`.
- `/auth/refresh` реализован (rotation + replay-detection) —
  `apps/api/src/modules/auth/auth.service.ts:315`, `auth.controller.ts:257`.

### Realtime (Go)

- Транспорт: `GET /ws/sessions/{sessionId}`, `github.com/coder/websocket`, маршрутизация chi —
  `apps/realtime/cmd/server/main.go:109`.
- Извлечение токена: cookie `access_token` (приоритет) или `Authorization: Bearer` —
  `apps/realtime/internal/auth/jwt.go:85-102`.
- Подпись: HS256, общий с API секрет `JWT_ACCESS_SECRET` из корневого `.env`.
- Конвейер при подключении — `apps/realtime/internal/handler/websocket.go:84-141`:
  1. извлечение и верификация JWT;
  2. проверка отзыва по blacklist `blacklist:token:{jti}` (`storage/redis.go:234-248`);
  3. проверка «sessionId в токене == URL sessionId»;
  4. проверка активности комнаты `session:{id}:active`;
  5. определение роли (`session:{id}:members`, иначе `candidate`);
  6. Origin-проверка (CSWSH) через `OriginPatterns`.
- Ревокация: подписка на Redis-канал `auth:revocations` + принудительный `EvictUser`
  (`ws/hub.go:37-46`), закрытие с `StatusPolicyViolation` (`ws/room.go:342`).
- Десериализация ревокации: `PubSubMessage{instanceId, data}`, используется только `data`
  (`storage/redis.go:213-218`).

---

## 3. Проблемы и их верификация

| # | Проблема | Вердикт | Артефакт в коде |
|---|---|---|---|
| 1 | Браузер не может передать токен: WS не ставит заголовки, access-cookie API не выдаёт | Подтверждено | `jwt.go:85-102`; `access-token.guard.ts:77-85` |
| 2 | Ревокация деактивации имеет неверный формат: API шлёт `{userId, reason}`, realtime читает только `data` → молча теряется | Подтверждено | `users.service.ts:240-243` vs `redis.go:213-218` |
| 3 | logout не публикует ревокацию (только удаляет `auth:session:{sid}`) | Подтверждено | `auth.service.ts:277`; `auth-session.service.ts:170-172` |
| 4 | Нет авторизации комнат: `IsSessionActive` при `redis.Nil`/ошибке → `true`; роль всегда `candidate` | Подтверждено | `redis.go:258-266`; `websocket.go:159-164` |
| 5 | Проверка «sessionId в токене» не работает: API кладёт `sid` (auth-сессия), realtime ждёт `sessionId` (комната) | Подтверждено | `token.service.ts:47-66` vs `jwt.go:24-30`; `websocket.go:113-121` |
| 6 | Нет источника правды о членстве: в Prisma только `model User` | Подтверждено | `apps/api/prisma/schema.prisma` |
| 7 | Access-токен живёт 15 мин, интервью дольше | Частично: `/auth/refresh` реализован; остаётся потребность в тикете + refresh-loop клиента | `auth.controller.ts:257` |
| 8 | Тест `websocket_test.go:127-144` закрепляет ошибочное поведение «mismatch sessionId → 403» | Подтверждено | `apps/realtime/internal/handler/websocket_test.go` |
| 9 | API-гуарды раздвоены: глобальный `AccessTokenGuard` не проверяет живую сессию, `JwtAuthGuard` (проверяет) — только на `/profile`, где токен верифицируется дважды | Подтверждено | `app.module.ts:54-56`; `access-token.guard.ts:47-85`; `profile.controller.ts:31` |
| 10 | `OriginCheckGuard` использует префиксный матч `startsWith` → обход через `https://app.example.com.evil.com` (CSWSH/CSRF); баг закреплён тестом | Подтверждено | `origin-check.guard.ts:53-66`; `origin-check.guard.spec.ts:157-164` |

Дополнительные находки (вне исходных рекомендаций):

- **Мёртвый blacklist**: `IsTokenRevoked` проверяет `blacklist:token:{jti}`, но никто туда не пишет.
  Для одноразового тикета нужен атомарный `SET NX` (SETNX), иначе гонка обойдёт одноразовость;
  использовать **отдельный namespace** `ticket:consumed:{jti}` (A5) — не смешивать с blacklist-ом,
  чтобы «использовано» и «отозвано» не пересекались.
- **Приоритет cookie над Bearer** в `jwt.go:90-93`: при наличии cookie `access_token`
  реальный Bearer-токен игнорируется (слабость порядка извлечения).
- **Realtime не проверяет `typ`**, `sid` и живую сессию `auth:session:{sid}` —
  слабее, чем `JwtAuthGuard` на `/profile` (глобальный `AccessTokenGuard` живую
  сессию не проверяет вовсе).
- **`mockSessionStore`** в тестах кодирует сломанное поведение (всегда активна, роль `candidate`).

---

## 4. Архитектурные решения

| Решение | Обоснование |
|---|---|
| A1. Доставка учётных данных через одноразовый тикет в `Sec-WebSocket-Protocol` | WS-клиент не ставит заголовки; cookie недоступны кросс-доменно; согласуется с политикой API «Bearer-only» |
| A2. Fail-closed авторизация комнат | Отсутствие/ошибка данных трактуются как отказ (403), а не как успех |
| A3. Единый формат ревокации `PubSubMessage{instanceId, data}` | Совпадение с ожиданиями `SubscribeRevocations` |
| A4. Источник правды о членстве — Postgres (Prisma) + Redis-зеркало | Prisma — синхронная правда, Redis — быстрый lookup для realtime |
| A5. Одноразовое потребление тикета через `SET ticket:consumed:{jti} NX EX` | Атомарность, отсутствие TOCTOU-гонки; отдельный namespace, не смешивает семантику «использован» и «отозван» |
| A6. Проверка живой auth-сессии `auth:session:{sid}` в realtime | Симметрия с API после A8; общий Redis |
| A7. Веб-клиент: тикет через `baseFetch` (Bearer) → WS с subprotocol, reconnect с backoff | Reuse существующего авто-refresh (`apps/web/src/shared/api/base.ts:47-102`) |
| A8. Объединить гуарды: перенести live-проверку `JwtAuthGuard` в глобальный `AccessTokenGuard` (async), удалить `JwtAuthGuard` | Единое место авторизации; logout/деактивация инвалидируют API везде; убирает двойную верификацию на `/profile`; live-проверка — через `EXISTS` (`isSessionActive`), без чтения/парсинга JSON |
| A9. Точный Origin-матч в `OriginCheckGuard` (равенство, не `startsWith`) | Закрывает CSWSH-обход префиксом `https://app.example.com.evil.com` |

### Поток подключения (целевой)

```
браузер → GET /realtime/ticket {sessionId}        [AccessTokenGuard: Bearer + live auth:session:{sid}]
        → { ticket }                                        JWT HS256 typ:"realtime" exp:"5m"
        → new WebSocket(ws_url, ["realtime", ticket])
realtime (тикет, typ=="realtime"):
  1. VerifyToken(ticket)            typ, sid непуст, HS256
  2. ConsumeTicket(jti)             SET ticket:consumed:{jti} EX 5m NX → повтор = 401
  3. Bound-to-room                  claims.SessionID == URL sessionId → иначе 403
  4. IsAuthSessionActive(sid)        EXISTS auth:session:{sid} → иначе 401
  5. IsSessionActive(комната)        session:{id}:active == "true" → иначе 403
  6. GetSessionUserRole(userId)      session:{id}:members → иначе 403
  7. Accept(Subprotocols=["realtime"], OriginPatterns)

realtime (access, typ=="access"): VerifyToken → IsTokenRevoked (multi-use, без ConsumeTicket)
  → шаги 4–7.  // переходный фолбэк: env REALTIME_ALLOW_ACCESS_FALLBACK (default true),
                // выключить после перевода всех клиентов на тикеты (см. §8, P9)
```

### Ревокация (целевой поток)

```
logout / refresh-replay / deactivate:
  revokeSession(sid)  (удалить auth:session:{sid})
  publish auth:revocations {"instanceId":"api-<hostname>","data":"<userId>"}   без sessionId
        → realtime SubscribeRevocations → EvictUser → close(StatusPolicyViolation)
close-сессии: publish по участникам {"instanceId","data":"<userId>","sessionId":"<id>"}
        → realtime EvictFromRoom(sessionId, userId) → close(StatusPolicyViolation)
        только из закрываемой комнаты (не выкидывает из других сессий);
        close доступен только владельцу.
```

---

## 5. Требования к изменениям по компонентам

### 5.1 API (NestJS)

- **Гуарды (A8, A9)**
  - `apps/api/src/common/guards/access-token.guard.ts`: `canActivate` → async;
    после `verifyAccessToken` → `await authSessionService.isSessionActive(payload.sid)`
    (новый метод `AuthSessionService`, `EXISTS auth:session:{sid}` без чтения объекта):
    `false` → `401 "Session has expired or been revoked"`; исключение Redis — пробросить
    (`500`, как принято в API). Опционально: in-memory TTL-cache (1–5 s) для снижения roundtrip.
    Bearer-парсер унифицировать (`startsWith("Bearer ")` + `slice(7)`). Внедрить `AuthSessionService`.
  - `apps/api/src/modules/auth/services/auth-session.service.ts`: добавить `isSessionActive(sid)`.
  - `apps/api/src/modules/users/profile.controller.ts:31` — снять `@UseGuards(JwtAuthGuard)`.
  - Удалить `apps/api/src/common/guards/jwt-auth.guard.ts` (+ `jwt-auth.guard.spec.ts`).
  - `apps/api/src/common/guards/origin-check.guard.ts:53-66` — заменить `startsWith`
    на точное равенство origin (включая self-origin); поправить
    `origin-check.guard.spec.ts:157-164` на ожидание `ForbiddenException`.
  - `access-token.guard.spec.ts`: кейсы живая сессия / удалённая (401) / Redis-ошибка (500).
- **Ревокация**
  - `apps/api/src/common/pubsub/revocation.ts` (новый): `publishUserRevocation(redis, userId, sessionId?)`
    публикует `{"instanceId":"api-<hostname>","data":"<userId>"}` (+ `sessionId`, если передан).
    `sessionId` НЕ передаётся для logout/replay/deactivate (user-level evict);
    передаётся для close-сессии (room-scoped evict, P2).
  - `users.service.ts:239-244` (`deactivateAccount`) — использовать хелпер (без `sessionId`).
  - `auth.service.ts`: в `logout()` и в ветке replay-detection `refresh()` после `revokeSession`
    публиковать ревокацию с `session.userId` (без `sessionId`).
- **Тикет**
  - `packages/dto/src/realtime/ticket.dto.ts` (новый): `ticketSchema`
    (`sessionId: z.string().uuid()`), тип `TicketDto`.
  - `auth.constants.ts`: `TOKEN_TYP_REALTIME = "realtime"`.
  - `token.service.ts`: `generateRealtimeTicket(userId, sid, sessionId)` / `verifyRealtimeTicket`
    (HS256, общий `jwt.accessSecret`, iss/aud общие, `typ:"realtime"`, `exp:"5m"`, `jti`).
  - `apps/api/src/modules/realtime/` (новый): `realtime.module.ts`, `realtime.controller.ts`
    — `POST /realtime/ticket`, защищён глобальным `AccessTokenGuard`;
    троттлинг через `AuthThrottlerGuard` — трекер по IP (в body тикета email отсутствует,
    `auth-throttler.guard.ts:26-35`), чтобы не выпускать подписанные тикеты потоком.
    За reverse-proxy проверить `trust proxy` (иначе `request.ip` у всех один — throttle бьёт всех, P8).
  - `sensitive-logging.interceptor.ts`: добавить тикет в redaction-список полей.
- **Источник правды**
  - `prisma/schema.prisma`: модели `InterviewSession`, `InterviewParticipant`
    (см. раздел 6; `InterviewParticipant.sessionId` — `@db.Uuid`, блокер P1).
  - `apps/api/src/redis/redis.service.ts`: добавить `hset`/`hget`/`hdel`.
  - `apps/api/src/modules/sessions/` (новый): `sessions.module.ts`, `sessions.service.ts`,
    `sessions.controller.ts` (минимальный HTTP: создание сессии, участники, закрытие),
    синхронизация Redis-зеркала (см. раздел 6) + периодический reconcile зеркала из Postgres
    (`@Cron`, `ScheduleModule` уже зарегистрирован) — самовосстановление после потери/flush Redis (P3).
    Создание: `POST /sessions` без тела (создатель = владелец, роль `interviewer`, P14).
    Авторизация: `POST /sessions/:id/participants`,
    `DELETE /sessions/:id/participants/:userId` и `POST /sessions/:id/close` — только владелец
    (`session.userId == req.user.sub`, иначе `403`); несуществующая сессия — `404`.

### 5.2 Realtime (Go)

- `internal/auth/jwt.go`: `UserClaims` + `typ`/`sid`; `VerifyToken` разрешает
  `typ ∈ {access, realtime}` и требует непустой `sid`.
- `internal/storage/redis.go`:
  - `IsSessionActive`: `redis.Nil`/ошибка/disabled → `false`.
  - `GetSessionUserRole`: отсутствие → `("", nil)` (сигнал «нет членства»).
  - `IsAuthSessionActive(ctx, sid)`: `EXISTS auth:session:{sid}` → `false` при отсутствии/ошибке.
    Прим.: sid ротируется при каждом refresh (`auth.service.ts:343-365`, новый `sessionId`) —
    тикет перевыпускать после любого refresh; тикет выпускать непосредственно перед WS-open.
  - `ConsumeTicket(ctx, tokenID)`: `SET ticket:consumed:{jti} EX <ttl> NX` — отдельный
    namespace `ticket:consumed:*`, не пересекается с `blacklist:token:*` (P4).
    disabled-режим — перимиссивно (`true`), но `IsSessionActive`/`IsAuthSessionActive`
    в disabled-режиме fail-closed → фактические подключения всё равно отклоняются (P12).
    Вызывается **только** для `typ == "realtime"`.
- `internal/handler/websocket.go`:
  - удалить проверку «sessionId в токене == URL sessionId» для `typ == "access"`;
    для `typ == "realtime"` — **вернуть** её как defense-in-depth (тикет привязан к комнате):
    `claims.SessionID != URL sessionId` → 403;
  - извлекать тикет из `Sec-WebSocket-Protocol` (`"realtime,<ticket>"`),
    `AcceptOptions.Subprotocols = ["realtime"]`;
  - порядок извлечения учётных данных: **subprotocol-тикет → `Authorization: Bearer` →
    cookie** (закрывает слабость «cookie приоритетнее Bearer», `jwt.go:90-93`);
  - порядок для `typ == "realtime"`: `ConsumeTicket` (одноразовость) →
    `IsAuthSessionActive` → `IsSessionActive` → `GetSessionUserRole`;
    для `typ == "access"`: `IsTokenRevoked` (без `ConsumeTicket` — multi-use) →
    `IsAuthSessionActive` → `IsSessionActive` → `GetSessionUserRole`;
    (переходный фолбэк за флагом `REALTIME_ALLOW_ACCESS_FALLBACK`, default true —
    выключить после перевода всех клиентов на тикеты, см. §8/P9);
    на любом провале — 401/403;
  - роль брать строго из хранилища (убрать fallback `candidate`);
  - вызовы `SessionStore` — через nil-guard `h.store != nil` (текущий паттерн:
    `hub_test.go` собирает Hub без `SessionStore`).
- `internal/storage`: вынести парсинг ревокации — `parseRevocation(payload []byte) (userID, sessionID string)`,
  семантику активности/роли в чистые функции для unit-тестирования без live-Redis.
- `internal/ws/hub.go`: добавить `EvictFromRoom(sessionID, userID, reason)` — evict только из
  конкретной комнаты (room-scoped close, P2); колбэк подписки ревокаций отдаёт `(userID, sessionID)`:
  при `sessionID == ""` → `EvictUser` (logout/deactivate), иначе → `EvictFromRoom` (close).

### 5.3 Web (Next.js)

- `apps/web/src/shared/api/endpoints.ts`: `realtime: { ticket: "/realtime/ticket" }`,
  база ws из `NEXT_PUBLIC_REALTIME_URL`.
- `apps/web/src/features/realtime/lib/ticket.ts` (новый):
  - `getTicket(sessionId)` через `baseFetch` (Bearer + авто-refresh);
  - `connectWebSocket(sessionId)`: `new WebSocket(url, ["realtime", ticket])`;
  - reconnect: только на `close`/`403` (кроме `1008`/`1001`) — повторный тикет + reconnect
    с экспоненциальным backoff; на `1008` (evict: logout/deactivate/close) — без auto-reconnect
    (повторный тикет → 401, auth-слой уводит на `/login`); на `1001` (уход вкладки) —
    reconnect не нужен (P6).
- `apps/web/package.json`: удалить `socket.io-client` (нет использования в `src`).
- Пометка (вне скоупа auth): источник `sessionId` для `getTicket` — контекст интервью
  на UI; флоу входа в комнату — отдельная фича, не блокер.
- Отображаемое имя участника: claim `username` в API-токенах/тикете отсутствует →
  реальтайм использует фолбэк `"User-"+userId` (`websocket.go:153-156`); маппинг
  userId→имя — задача UI-слоя, вне скоупа auth.

---

## 6. Модель данных и Redis-зеркало

### Prisma

```prisma
enum InterviewSessionStatus {
  CREATED
  ACTIVE
  CLOSED
}

enum InterviewParticipantRole {
  CANDIDATE
  INTERVIEWER
  OBSERVER
}

model InterviewSession {
  id        String                  @id @default(uuid()) @db.Uuid
  userId    String                  @db.Uuid   // владелец (создатель) сессии
  status    InterviewSessionStatus  @default(ACTIVE)
  startedAt DateTime?
  endedAt   DateTime?
  createdAt DateTime                @default(now())
  updatedAt DateTime                @updatedAt
  participants InterviewParticipant[]

  @@map("interview_sessions")
}

model InterviewParticipant {
  sessionId String  @db.Uuid
  userId    String  @db.Uuid
  role      InterviewParticipantRole

  session InterviewSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@id([sessionId, userId])
  @@map("interview_participants")
}
```

> **Блокер (P1)**: `InterviewParticipant.sessionId` обязан быть `@db.Uuid` — голый `String`
> мигрирует в `text`, а FK `text → uuid (InterviewSession.id)` в Postgres несовместим по типам:
> миграция упадёт. (`userId` уже аннотирован корректно.)

### Redis-зеркало (TTL = `SESSION_MIRROR_TTL_SECONDS`, default 2h)

Realtime продлевает TTL зеркала при успешной аутентификации участника
(`EXPIRE session:{id}:active`, `session:{id}:members`) — молчаливое интервью дольше TTL
не теряет доступ к реконнектам (сейчас TTL обновляется только событиями API).

Самовосстановление (P3): периодический reconcile ACTIVE-сессий из Postgres в зеркало
(`SessionsService.reconcileMirrors()`, `@Cron`, интервал из env `SESSION_MIRROR_REFRESH_CRON`,
default «ежечасно»; `ScheduleModule` уже зарегистрирован — `app.module.ts:46`).
После потери/flush Redis зеркало восстанавливается в пределах одного интервала; до этого
подключения fail-closed (`403`).

| Действие | Ключи |
|---|---|
| Создание сессии (ACTIVE) | `session:{id}:active` = `"true"`; `session:{id}:members` HSET creator→role |
| Добавление участника | `session:{id}:members` HSET `user→role`; продление TTL |
| Удаление участника | `session:{id}:members` HDEL; продление TTL |
| Закрытие сессии | `session:{id}:active` = `"closed"`; publish `auth:revocations` по каждому участнику с `sessionId` (room-scoped evict, P2) |

### Формат ревокации

```json
{ "instanceId": "api-<hostname>", "data": "<userId>", "sessionId": "<sessionId>" }
```

Поле `sessionId` — опционально (P2): logout / refresh-replay / deactivate публикуют **без** него
(user-level evict через `EvictUser`); закрытие сессии — **с** ним (room-scoped evict через
`EvictFromRoom(sessionId, userId)`, не выкидывает участников из других активных сессий).

Совпадает с `PubSubMessage` (`apps/realtime/internal/storage/redis.go:37-40`).
`SubscribeRevocations` не фильтрует собственный инстанс — дубликаты evict идемпотентны.

---

## 7. Тестирование

- **API**: `pnpm --filter api lint` (biome), `pnpm --filter api test`, `pnpm --filter api test:e2e`.
  `access-token.guard.spec.ts`: живая сессия (pass) / удалённая (`401`) / Redis-ошибка (`500`),
  `isSessionActive` (EXISTS).
  `origin-check.guard.spec.ts:157-164`: префикс-спуф → `ForbiddenException`.
  Новый e2e: `apps/api/test/realtime-ticket.e2e-spec.ts` (login → ticket → проверка claims
  `typ`, `exp≈5m`, одноразовость не проверяется здесь — на стороне realtime).
  Плюс ротация (P11): `POST /auth/refresh` → повторный тикет по старому access-токену → `401`
  (sid ротирован, live-сессии нет).
  e2e sessions: не-владелец `POST /sessions/:id/participants` / `:id/close` → `403`;
  `:id/close` для несуществующей → `404`; reconcile-юнит: зеркало восстановлено после потери ключей (P3).
- **Realtime**: `go test ./...` в `apps/realtime`; `go vet ./...`.
  Обновить `jwt_test.go`, `websocket_test.go`:
  - фабрики токенов проставляют `typ`/`sid`;
  - мок `SessionStore` → честная модель (карты `active`/`roles` + методы
    `IsAuthSessionActive`, `ConsumeTicket`), fail-closed семантика;
  - кейсы: «не участник → 403», «закрытая сессия → 403», «участник активной → 200»,
    «повторное использование тикета → 401» (ключ `ticket:consumed:{jti}`, P4);
  - удалить регрессионный тест «mismatch sessionId → 403» (`websocket_test.go:127-144`);
  - unit-тесты чистых функций парсинга ревокации/активности/роли (`internal/storage`);
  - `revocation_test.go` (P11): close-ревокация с `sessionId` → клиент закрыт `1008`,
    при этом участник другой живой сессии НЕ выброшен; user-level ревокация (logout) → `1008`;
    дубликаты — идемпотентны.
- **Web**: `pnpm --filter web lint`, `pnpm --filter web build`.

---

## 8. Порядок развёртывания и риски

1. **Dev-окружение**: `docker compose up -d redis` (сервис уже в `docker-compose.yml:20-33`),
   `REDIS_ENABLED=true` для realtime. `ALLOWED_ORIGINS` API и `OriginPatterns` realtime —
   синхронно, с фактическим origin веб-фронта. Обязательно выровнять порты в dev `.env`
   (API по умолчанию `3001` (`configuration.ts:11`), web по умолчанию `4000`
   (`endpoints.ts:19-20`)): `API_PORT=3001`, `NEXT_PUBLIC_API_URL=http://localhost:3001`,
   `NEXT_PUBLIC_REALTIME_URL=ws://localhost:8080` — иначе сквозной флоу «login → тикет → WS»
   не поднимется (P7). Без Redis после fail-closed подключения отвергаются.
2. **Phase G** (гуарды A8/A9) — выкатывать первой: на неё опираются тикет-endpoint (C)
   и live-проверка в realtime (A6).
3. **Phase A** (ревокация) можно выкатывать независимо — realtime не меняется.
4. **Phase B** (правда + fail-closed) — зеркало и fail-closed выкатывать **вместе**:
   между ними все подключения не проходят (ключей `session:{id}:*` ещё никто не пишет).
5. **Phase C** (тикет) поверх B.
6. **Phase D** (веб-клиент) последним.

### Риски

- Fail-closed без зеркала → полная недоступность WS (см. п. 4).
- Гонка при повторном использовании тикета → решается атомарным `SETNX`.
- Совместимость старых токенов без `typ`/`sid` → строгая валидация требует
  обновления всех тестовых токенов и клиентов на новые тикеты.
- API после A8: глобальный guard становится async и зависит от Redis — каждый запрос делает
  roundtrip (дешёвый `EXISTS`, без парсинга JSON). Redis-ошибка → `500` на всём не-`@Public` API
  (широкий радиус — нужен мониторинг Redis-ошибок и roundtrip; опц. in-memory TTL-cache 1–5 s, P5).
  Отсутствие сессии → `401`. Все аутентифицированные маршруты теперь требуют живую `auth:session:{sid}`.
- «Закрытие сессии» публикует room-scoped ревокации (с `sessionId`) → evict только из закрываемой
  комнаты (`EvictFromRoom`). По-прежнему глобально на пользователя действуют только
  logout / refresh-replay / deactivate (ожидаемо). Порядок подтверждён: publish ревокаций —
  **до** удаления зеркала (иначе повторный подключившийся в окне закрытия получит 403 по зеркалу,
  а не 1008 по ревокации; P2).
- Redis-зеркало не переживает потерю/flush: между инцидентом и ближайшим reconcile — fail-closed
  `403` (ожидаемо, ≤1 интервала крона; см. §6, P3).
- Фолбэк `typ=="access"` включён, пока `REALTIME_ALLOW_ACCESS_FALLBACK=true` (default true).
  Зафиксировать критерий/дату отключения после перевода всех клиентов на тикеты (P9) +
  тест при выключенном фолбэке.
- Auth-сессия `auth:session:{sid}` имеет жёсткий TTL (7 дней, продлевается только refresh) —
  после A8 у неактивных пользователей API начнёт отдавать `401` ровно через 7 дней без refresh.
  Решение продуктовое: либо задокументировать, либо `touch` (EXPIRE) на каждом доступе (P13).
- `REDIS_ENABLED=false` у realtime ⇒ fail-closed на `IsAuthSessionActive`/`IsSessionActive` —
  все подключения отклоняются; «перимиссивный» `ConsumeTicket` в этой конфигурации не влияет (P12).
- `ALLOWED_ORIGINS` в API и realtime должны совпадать (CSWSH/CORS); API — точный матч.
  realtime — проверить семантику `OriginPatterns` coder/websocket: точный матч origin, а не
  префикс/суффикс хоста (симметрия с A9); до подтверждения не использовать подстановочные
  хосты (P10).

---

## 9. Файлы для изменения/создания (манифест)

### API
- [изм] `apps/api/src/common/guards/access-token.guard.ts` — async + live-проверка (A8)
- [удл] `apps/api/src/common/guards/jwt-auth.guard.ts` (+ `jwt-auth.guard.spec.ts`)
- [изм] `apps/api/src/common/guards/origin-check.guard.ts` (+ `origin-check.guard.spec.ts`) — точный Origin-матч (A9)
- [изм] `apps/api/src/common/guards/access-token.guard.spec.ts` — новые кейсы (в т.ч. `isSessionActive`)
- [изм] `apps/api/src/modules/auth/services/auth-session.service.ts` — добавить `isSessionActive` (A8, P5)
- [изм] `apps/api/src/modules/users/profile.controller.ts` — снять `@UseGuards(JwtAuthGuard)`
- [изм] `apps/api/src/common/interceptors/sensitive-logging.interceptor.ts`
- [нов] `apps/api/src/common/pubsub/revocation.ts`
- [изм] `apps/api/src/modules/auth/auth.service.ts`
- [изм] `apps/api/src/modules/auth/auth.constants.ts`
- [изм] `apps/api/src/modules/auth/services/token.service.ts`
- [изм] `apps/api/src/modules/users/users.service.ts`
- [нов] `apps/api/src/modules/realtime/realtime.module.ts`
- [нов] `apps/api/src/modules/realtime/realtime.controller.ts`
- [нов] `apps/api/src/modules/sessions/sessions.module.ts`
- [нов] `apps/api/src/modules/sessions/sessions.service.ts`
- [нов] `apps/api/src/modules/sessions/sessions.controller.ts`
- [изм] `apps/api/src/app.module.ts` — регистрация `RealtimeModule`, `SessionsModule`
- [изм] `apps/api/src/redis/redis.service.ts`
- [изм] `apps/api/prisma/schema.prisma`
- [нов] `apps/api/test/realtime-ticket.e2e-spec.ts`
- [нов] `packages/dto/src/realtime/ticket.dto.ts`

### Realtime
- [изм] `apps/realtime/internal/auth/jwt.go`
- [изм] `apps/realtime/internal/handler/websocket.go`
- [изм] `apps/realtime/internal/storage/redis.go`
- [нов] `apps/realtime/internal/storage/parser_test.go`
- [изм] `apps/realtime/internal/auth/jwt_test.go`
- [изм] `apps/realtime/internal/handler/websocket_test.go`
- [изм] `apps/realtime/internal/ws/hub.go` (+ `hub_test.go`) — `EvictFromRoom`, подписка `(userID, sessionID)` (P2)
- [изм] `apps/realtime/internal/config/config.go` — `REALTIME_ALLOW_ACCESS_FALLBACK` (P9)
- [нов] `apps/realtime/internal/handler/revocation_test.go` (P11)

### Web
- [изм] `apps/web/src/shared/api/endpoints.ts`
- [нов] `apps/web/src/features/realtime/lib/ticket.ts`
- [изм] `apps/web/package.json`

### Конфигурация/инфраструктура
- [изм] корневой `.env` / `apps/realtime/.env` — `REDIS_ENABLED=true` (dev)
- [опц] `docker-compose.yml` — без изменений (redis уже есть)