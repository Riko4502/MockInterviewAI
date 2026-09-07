# Realtime Service (`apps/realtime`)

Высоконагруженный сервис реального времени, написанный на **Go 1.26**, отвечающий за поддержание постоянных WebSocket-соединений, синхронизацию сессий интервью, совместное редактирование кода и интеграцию с WebRTC (LiveKit).

---

## 1. Назначение и стек

* **Язык:** Go 1.26 (go.mod: `go 1.26.6`)
* **WebSocket:** `github.com/coder/websocket` (быстрый, идиоматичный, без аллокаций)
* **HTTP Router:** `github.com/go-chi/chi/v5`
* **Кэш и шина событий:** Redis (Pub/Sub)
* **WebRTC:** LiveKit SDK (передача аудио/видео)

---

## 2. Архитектура сервиса

```text
apps/realtime/
├── cmd/
│   └── server/
│       └── main.go           # Точка входа, конфигурация, запуск HTTP/WS сервера
├── internal/
│   ├── config/               # Загрузка и валидация переменных окружения
│   ├── handler/              # HTTP + WebSocket handler: /ws/sessions/{id}, /healthz, POST /webhooks/livekit (LiveKit)
│   ├── ws/                   # WebSocket Hub, комнаты (Room), клиенты (Client), Envelope
│   ├── storage/              # Redis: Pub/Sub, зеркало сессий, code-state, тикеты, ревокации
│   └── auth/                 # Верификация JWT (typ: access / realtime), ConsumeTicket
├── go.mod
└── Dockerfile
```

---

## 3. Модель комнат и клиентов (Hub Pattern)

```
                       ┌─────────────────────────┐
                       │      WebSocket Hub      │
                       │ (Управление комнатами)  │
                       └────────────┬────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         ┌────────────────────┐          ┌────────────────────┐
         │    Room: session-1 │          │    Room: session-2 │
         ├────────────────────┤          ├────────────────────┤
         │ Client 1 (Interviewer) │      │ Client A           │
         │ Client 2 (Candidate)   │      │ Client B           │
         └────────────────────┘          └────────────────────┘
```

1. **Client**: представляет активное WebSocket-соединение пользователя. Имеет отдельные горутины для чтения (`readPump`) и записи (`writePump`).
2. **Room**: изолированная комната сессии интервью. Содержит участников, историю изменений кода и состояние WebRTC звонка.
3. **Hub**: реестр всех комнат на текущем сервере, маршрутизирует широковещательные сообщения (`broadcast`).

---

## 4. Синхронизация между инстансами (Redis Pub/Sub)

При горизонтальном масштабировании `realtime` инстансов пользователи одной комнаты могут быть подключены к разным серверам:
* Сообщения комнаты публикуются в канал Redis `session:{sessionId}:events`.
* Все инстансы, подписанные на этот канал, ретранслируют сообщение своим локальным WebSocket-клиентам.

---

## 5. Аутентификация WebSocket (тикет)

Браузер **не передает** access-токен или cookie на handshake. Перед каждым подключением клиент получает одноразовый тикет и передает его через subprotocol:

1. **`POST /realtime/ticket`** (Bearer access) → `{ ticket }`. Тикет — JWT HS256 на общем секрете `JWT_ACCESS_SECRET`: `typ: "realtime"`, `sid`, `sessionId`, `exp ≈ 5 мин`.
2. **WS-Upgrade** `ws(s)://…/ws/sessions/{sessionId}` с `Sec-WebSocket-Protocol: realtime, <ticket>` (согласованный subprotocol — `realtime`).
3. Приоритет извлечения кредов: **subprotocol-тикет → `Authorization: Bearer` → HttpOnly cookie**.
4. Проверка: `VerifyToken` (HS256, `typ ∈ {access, realtime}`, обязателен `sid`); для `typ == "realtime"` — одноразовый `ConsumeTicket(jti)` и привязка к комнате (`claims.SessionID == sessionId`, иначе `403`); для `typ == "access"` — мультиюз `IsTokenRevoked` (обратная совместимость при раскатке, только при `REALTIME_ALLOW_ACCESS_FALLBACK=true`). После верификации — fail-closed live-проверки: активная auth-сессия `auth:session:{sid}` (`IsAuthSessionActive`), активность интервью-сессии `session:{id}:active` (`IsSessionActive`), роль участника `session:{id}:members` (`GetSessionUserRole`); при успехе TTL зеркала продлевается (`TouchMirror`). `IsTokenRevoked` (по `blacklist:token:{jti}`) вызывается только для access-фолбэка.
5. При logout/revoke `apps/api` публикует в канал `auth:revocations` сообщение `{instanceId, data: userId, sessionId?}`; realtime без `sessionId` вызывает `Hub.EvictUser(userID)` (все комнаты), с `sessionId` — `Hub.EvictFromRoom(sessionID, userID)` (только комната сессии) и разрывает активные WS (`StatusPolicyViolation`).

Подробности — `docs/backend/security/auth-jwt.md`, спецификация — `apps/api/docs/spec-realtime-ws-auth.md`.

---

## 6. LiveKit webhook (медиа-события)

WebRTC-медиа (аудио/видео) идёт напрямую клиент ↔ LiveKit SFU; `realtime` в передаче медиа не участвует. Единственная интеграция с LiveKit на стороне сервиса — приём webhook-ов записи:

1. **`POST /webhooks/livekit`** — без тикета; верификация подписи webhook-JWT (HS256, из `Authorization` с fallback на `Livekit-Webhook-Jwt`) по `LIVEKIT_WEBHOOK_API_KEY`/`LIVEKIT_WEBHOOK_API_SECRET`, плюс сверка sha256-claim с хешем тела. В production оба параметра обязательны (fail-closed как `JWT_ACCESS_SECRET`); dev-дефолт секрета — `dev-local-secret-change-me-0123456789` (совпадает с ключом контейнера `livekit`).
2. Обрабатываются только события `egress_*` → бизнес-событие записи **`media.recording`** (`started`/`stopped`/`failed`), которое ретранслируется в комнату сессии через `BroadcastToRoom` (с fallback на `broadcaster.Publish` при отсутствии локальной комнаты). Активный говорящий — клиентская индикация (`livekit-client`), через realtime не распространяется.

Спецификация — `apps/api/docs/spec-livekit-media.md`.
