# План действий: аутентификация WS-подключений (realtime)

Документ: `docs/plan-realtime-ws-auth.md`
Спецификация: `docs/spec-realtime-ws-auth.md`

Затрагиваемые сервисы: `apps/api` (NestJS), `apps/realtime` (Go), `apps/web` (Next.js).

---

## Фазы

| Фаза | Содержание | Зависимости |
|---|---|---|
| G | Гуарды API: слияние `AccessTokenGuard`+`JwtAuthGuard` (live-сессия), точный Origin-матч | — |
| A | Ревокация: logout/deactivation обрывают WS | G |
| B | Источник правды о членстве + fail-closed realtime | A |
| C | Тикет для WS (Sec-WebSocket-Protocol) | B |
| D | Веб-клиент (тикет + reconnect) | C |

Phase B требует одновременного выката зеркала и fail-closed (иначе WS недоступен).
После Phase G глобальный guard проверяет живую `auth:session:{sid}` (Redis-ошибка → `500`,
отсутствие сессии → `401`); на него опираются тикет-endpoint (C) и симметрия realtime (A6).

---

## Phase G — Гуарды API (A8, A9)

### Шаги
1. `apps/api/src/common/guards/access-token.guard.ts`:
   - внедрить `AuthSessionService`;
   - `canActivate` → `async`; после `verifyAccessToken`:
     `getSession(payload.sid)` → `null` → `401 "Session has expired or been revoked"`;
     исключение Redis пробросить (Nest → `500`, поведение «как в API»);
   - Bearer-парсер унифицировать со старой логикой `JwtAuthGuard`
     (`startsWith("Bearer ")` + `slice(7)`).
2. `apps/api/src/modules/users/profile.controller.ts:31` — снять `@UseGuards(JwtAuthGuard)`.
3. Удалить `apps/api/src/common/guards/jwt-auth.guard.ts` + `jwt-auth.guard.spec.ts`.
4. `apps/api/src/common/guards/origin-check.guard.ts:45-66` — `startsWith` → точное
   равенство origin (и для self-origin): `origin === allowed`.
5. `apps/api/src/common/guards/origin-check.guard.spec.ts:157-164` — префикс-спуф
   `https://app.example.com.evil.com` → ожидать `ForbiddenException`.

### Проверка
- `access-token.guard.spec.ts`: живая сессия (pass), удалённая (401), Redis-ошибка (500),
  Bearer-парсер (в т.ч. двойной пробел).
- `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`.

---

## Phase A — Ревокация

### Шаги
1. Создать `apps/api/src/common/pubsub/revocation.ts`:
   - `publishUserRevocation(redis: RedisService, userId: string): Promise<void>`
   - сообщение: `{"instanceId":"api-<os.hostname()>","data":"<userId>"}`
   - не бросать исключений (best-effort, как в `users.service.ts:244-246`).
2. `apps/api/src/modules/users/users.service.ts` — в `deactivateAccount` заменить
   `publish("auth:revocations", JSON.stringify({userId, reason}))` на хелпер.
3. `apps/api/src/modules/auth/auth.service.ts`:
   - `logout()`: сохранить `session.userId` перед `revokeSession(payload.sid)`,
     после удаления — publish ревокации.
   - `refresh()` ветка replay-detection (`:339`): после `revokeSession` — publish ревокации.
    - На успешной ветке `refresh()` (`:343`, ротация → новый `sessionId`) публикацию
      НЕ добавлять — иначе каждый refresh обрывал бы активные WS; publish — только на replay.
4. `apps/realtime/internal/storage/redis.go` — вынести разбор сообщения ревокации
   в функцию `parseRevocationUser(payload []byte) string` (чистая), использовать в
   `SubscribeRevocations`.

### Проверка
- `apps/realtime/internal/storage/parser_test.go`: `parseRevocationUser` на
  `{"instanceId":"api-dev","data":"user-1"}` → `"user-1"`;
  старый `{"userId":"u","reason":"..."}` → `""`.
- `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`.
- `cd apps/realtime && go test ./... && go vet ./...`.

---

## Phase B — Источник правды о членстве + fail-closed

### B1. Prisma и зеркало
1. `apps/api/prisma/schema.prisma` — добавить модели `InterviewSession` (включает поле
   `userId` — владелец), `InterviewParticipant`, enum'ы (см. спецификацию §6). Выполнить:
   `pnpm --filter api prisma generate` + миграцию.
2. `apps/api/src/redis/redis.service.ts` — добавить `hset(key, field, value, ttlSeconds?)`,
   `hget(key, field)`, `hdel(key, field)`.
3. Создать `apps/api/src/modules/sessions/`:
   - `sessions.module.ts` (импорт/экспорт `SessionsService`);
   - `sessions.service.ts`:
     - `createSession(creatorUserId, role)` → статус ACTIVE, зеркало active+members;
     - `addParticipant(sessionId, userId, role)` → HSET + продление TTL;
     - `removeParticipant(sessionId, userId)` → HDEL + продление TTL;
     - `closeSession(sessionId)` → `session:{id}:active="closed"`,
       publish ревокации по каждому участнику (evict) — ВАЖНО: publish **до** удаления зеркала
       (или через чтение members до очистки);
     - TTL зеркала из env `SESSION_MIRROR_TTL_SECONDS` (default 2h).
   - `sessions.controller.ts` (минимальный, за глобальным `AccessTokenGuard`):
     - `POST /sessions` (body: `{role}`; создатель = interviewer) → `{sessionId}`;
     - `POST /sessions/:id/participants` (body: `{userId, role}`) — только владелец;
     - `DELETE /sessions/:id/participants/:userId` — только владелец;
     - `POST /sessions/:id/close` — только владелец (`session.userId == req.user.sub`,
       иначе `403`; несуществующая сессия — `404`).
   - Контроллер зарегистрировать в `AppModule`.

### B2. Realtime fail-closed
1. `apps/realtime/internal/storage/redis.go`:
   - `IsSessionActive`: `redis.Nil`, ошибка, disabled → `false, nil`.
   - `GetSessionUserRole`: `redis.Nil`/отсутствие → `("", nil)`; ошибка → пробросить.
   - вынести в чистые функции `isActiveValue(val string) bool` и семантику роли для unit-тестов.
2. `apps/realtime/internal/handler/websocket.go`:
   - удалить блок «sessionId в токене == URL sessionId» (`:113-121`);
   - после верификации токена:
     - `IsSessionActive` → false/ошибка → `403 Forbidden: session is closed`;
     - `GetSessionUserRole` → `""`/ошибка → `403 Forbidden: not a member of this session`;
- роль — только из хранилища (убрать fallback `candidate`);
      - после успешной проверки роли — `EXPIRE session:{id}:active` и
        `session:{id}:members` (продление TTL зеркала при каждом успешном
        подключении; realtime уже пишет в Redis — `SaveCodeState`, `redis.go:298`).
3. `apps/realtime/internal/auth/jwt.go`:
   - `UserClaims`: добавить `Typ string json:"typ"`, `SID string json:"sid"`;
   - `VerifyToken`: reject если `typ` ∉ {access, realtime}; reject если `sid` пуст;
   - сохранить обратную совместимость в тестах через обновление фабрик токенов.

### B3. Тесты realtime
- `jwt_test.go`: токены с `typ:"access"`, `sid`; кейсы: неверный `typ` → ошибка,
  пустой `sid` → ошибка.
- `websocket_test.go`:
- `mockSessionStore` → честная модель (карты `active`, `roles`; методы
     `IsAuthSessionActive`, `ConsumeTicket`; пустое значение — fail-closed);
  - фабрика токенов — проставляет `typ`/`sid`;
  - новые тесты: не участник → 403; закрытая сессия → 403; участник активной → 200;
  - удалить тест «mismatch sessionId → 403» (`:127-144`).
- `internal/storage/parser_test.go` + тесты `isActiveValue`/семантики ролей.

### Проверка
- `docker compose up -d redis`; `.env` realtime: `REDIS_ENABLED=true`.
- `go test ./...`, `go vet ./...` в `apps/realtime`.
- `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`.
- Вручную (curl): создать сессию → участник → WS по ticket'у (после Phase C)
  или по access-токену в Bearer — ожидается подключение; не-участник — 403.

---

## Phase C — Тикет (Sec-WebSocket-Protocol)

### C1. API
1. `packages/dto/src/realtime/ticket.dto.ts`:
   - `ticketSchema = z.object({ sessionId: z.string().uuid("Некорректный sessionId") })`;
   - `type TicketDto = z.infer<typeof ticketSchema>`.
2. `apps/api/src/modules/auth/auth.constants.ts`: `TOKEN_TYP_REALTIME = "realtime"`.
3. `apps/api/src/modules/auth/services/token.service.ts`:
   - `generateRealtimeTicket(userId, sid, sessionId)`: payload `{sub, sid, sessionId, typ,
     iss, aud, iat, exp(5m), jti}`, подпись `jwt.accessSecret`, HS256;
   - `verifyRealtimeTicket(token)`: как `verifyAccessToken`, но `typ = "realtime"`
     и storage `jwt.accessSecret`.
4. `apps/api/src/modules/realtime/realtime.module.ts` + `realtime.controller.ts`:
   - `POST /realtime/ticket`, `@ZodBody(ticketSchema)`, ответ `{ ticket }`;
   - `AuthThrottlerGuard` на контроллере — трекер по IP (email в body тикета отсутствует);
   - модуль подключить в `AppModule` (регистрация в `apps/api/src/app.module.ts`);
   - глобальный `AccessTokenGuard` (после Phase G —
     async, с проверкой живой `auth:session:{sid}`) применится автоматически.
5. `sensitive-logging.interceptor.ts`: добавить `"ticket"`, `"accessToken"`, `"refreshToken"`
   в перечень полей redaction (на будущее, сейчас тело не логируется).

### C2. Realtime
1. `internal/storage/redis.go` + интерфейс `SessionStore`:
   - `IsAuthSessionActive(ctx, sid) (bool, error)`: `EXISTS auth:session:{sid}`;
     отсутствие/ошибка/disabled → `false`.
   - `ConsumeTicket(ctx, tokenID) (bool, error)`: `SET blacklist:token:{jti} EX <ttl> NX`
     (`ttl` = 5 мин); true — тикет впервые; disabled → `true` (перимиссивно, комментарий).
2. `internal/handler/websocket.go`:
   - извлечение учётных данных — приоритет: **subprotocol-тикет → `Authorization: Bearer`
     → cookie** (закрывает слабость «cookie приоритетнее Bearer» из §3);
   - тикет из заголовка `Sec-WebSocket-Protocol`, значение `"realtime,<ticket>"`
     (через `strings.Split`, fallback на текущий механизм cookie/Bearer для не-браузерных клиентов);
   - после `VerifyToken`:
     - `typ == "realtime"`: `ConsumeTicket(jti)` → false → `401 token already used`;
       затем **bound-to-room**: `claims.SessionID != URL sessionId` → `403` (defense-in-depth);
     - `typ == "access"`: только `IsTokenRevoked(jti)` (без `ConsumeTicket` — access multi-use);
     - затем для обоих типов: `IsAuthSessionActive(sid)` → false → `401 session is not active`;
       `IsSessionActive` / `GetSessionUserRole` (из Phase B);
   - все вызовы `SessionStore` — через nil-guard `h.store != nil` (паттерн Phase B2);
   - `AcceptOptions{Subprotocols: []string{"realtime"}, OriginPatterns: ...}` —
     чтобы браузер принял согласованный subprotocol.
3. `jwt.go` ужесточение действует на оба типа токенов (из Phase B).

### C3. Тесты
- `apps/api/test/realtime-ticket.e2e-spec.ts`:
  - register/login → `POST /realtime/ticket {sessionId}` → 201,
    decode JWT: `typ == "realtime"`, `sid == sid из access`, `exp - iat ≈ 300s`;
  - валидация: не UUID sessionId → 400; без Authorization → 401.
- `websocket_test.go`: повторное использование тикета → 401 (ConsumeTicket=false).

### Проверка
- Перед `pnpm --filter api test:e2e` — `docker compose up -d redis`: новый
  `realtime-ticket.e2e-spec.ts` ходит в аутентифицированный маршрут (после Phase G
  любой e2e на авторизованных маршрутах требует живой Redis).
- Те же команды: `pnpm --filter api ...`, `go test ./...`.

---

## Phase D — Веб-клиент

### Шаги
1. `apps/web/src/shared/api/endpoints.ts`:
   - `realtime: { ticket: "/realtime/ticket" }`;
   - `realtimeWsUrl = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080"`.
2. `apps/web/src/features/realtime/lib/ticket.ts`:
   - `getTicket(sessionId): Promise<string>` — `baseFetch<{ticket:string}>` → вернуть `ticket`;
   - `connectWebSocket(sessionId): { socket, close }`:
     - `ticket = await getTicket(sessionId)`;
     - `new WebSocket(url, ["realtime", ticket])`;
     - `onclose`/`onerror` с кодом 403/переподключение: повторный тикет + reconnect
       с экспоненциальным backoff (1s, 2s, 4s, ... cap 30s);
     - тикет НЕ писать в sessionStorage/logs.
3. `apps/web/package.json` — удалить `socket.io-client`; `pnpm install` для обновления lock.

### Проверка
- `pnpm --filter web lint`, `pnpm --filter web build`.
- Источник `sessionId` для `getTicket` — из контекста интервью на UI (вне скоупа auth;
  флоу входа в комнату — отдельная фича).
- Отображаемое имя в комнате — фолбэк `User-{userId}` (`websocket.go:153-156`);
  маппинг userId→имя в UI (вне скоупа).

---

## Контрольная проверка (сквозная, после всех фаз)

1. `docker compose up -d redis`; `REDIS_ENABLED=true` для realtime.
2. API: login → access + refresh cookie.
3. `POST /realtime/ticket {sessionId}` (Bearer access) → ticket.
4. `ws://localhost:8080/ws/sessions/{sessionId}` с subprotocol `["realtime", ticket]` →
   соединение установлено, приходит `room.sync`.
5. Повторное использование того же ticket → 401.
6. Не-участник с валидным тикетом на чужую сессию → 403.
7. Не-владелец `POST /sessions/:id/participants {userId}` → `403`;
   `POST /sessions/:id/close` чужой сессии → `403`.
8. `POST /sessions/:id/close` (владелец) → активные WS закрываются
   `StatusPolicyViolation` (1008).
9. logout → активные WS закрываются `StatusPolicyViolation`.
10. Сид-ротация: после активного `POST /auth/refresh` повторное подключение с прежним
    тикетом → `401` (sid ротирован, `auth:session:{oldSid}` удалён); новый тикет на
    актуальный access → успех.
11. Команды: `cd apps/realtime && go test ./... && go vet ./...`;
   `pnpm --filter api lint && pnpm --filter api test && pnpm --filter api test:e2e`;
   `pnpm --filter web lint && pnpm --filter web build`.

---

## Порядок коммитов

0. `fix(api): объединить гуарды — live-проверка сессии в AccessTokenGuard; точный Origin-матч` — Phase G.
1. `fix(api): корректный формат ревокации (logout/deactivation) + parser тест` — Phase A.
2. `feat(api,sessions): модели InterviewSession/Participant и Redis-зеркало` — Phase B1.
3. `feat(realtime): fail-closed авторизация комнат и typ/sid в claims` — Phase B2/B3.
4. `feat(api,realtime): одноразовый тикет через Sec-WebSocket-Protocol` — Phase C.
5. `feat(web): веб-клиент realtime с тикетом и reconnect; убрать socket.io-client` — Phase D.

Коммиты — только после явного запроса.