# Безопасность и Аутентификация

Сервис API реализует надежную двухточечную систему аутентификации на базе **JWT токенов** с хранением в защищенных cookies и хэшированием паролей по стандарту **Argon2id**.

---

## 1. Схема JWT и Cookies

```text
┌─────────────────┐       ┌─────────────────┐
│  Access Token   │       │  Refresh Token  │
├─────────────────┤       ├─────────────────┤
│ Срок: 15 минут  │       │ Срок: 7 дней    │
│ В теле ответа   │       │ В HttpOnly Cookie│
│ В заголовке     │       │ SameSite=Lax    │
│ Authorization   │       │ Path=/api/v1/auth│
└─────────────────┘       └─────────────────┘
```

1. **Access Token (короткоживущий, 15 мин)**:
   - Передается в теле JSON ответа при логине/регистрации/обновлении.
   - Клиент прикрепляет его в заголовок `Authorization: Bearer <token>` для доступа к защищенным эндпоинтам.
   - Содержит claims: `jti` (уникальный ID токена), `sid` (ID активной сессии), `typ: "access"`, `iss`, `aud`, `exp`.
   - При выпуске `jti` фиксируется в Redis: блэклист `blacklist:token:{jti}` (мгновенная ревокация) и зеркало сессии `auth:session:{sid}`. Каждый защищенный запрос проходит через глобальный `AccessTokenGuard` с live-проверкой: токен не отозван, сессия активна.
   - Logout/смена пароля: токен попадает в `blacklist:token:{jti}`, публикуется событие в канал `auth:revocations` (realtime разрывает активные WS через `EvictUser`), зеркало `auth:session:{sid}` помечается неактивным.
2. **Refresh Token (долгоживущий, 7 дней)**:
   - Передается **только** в `HttpOnly`, `Secure` (в prod), `SameSite=Lax` Cookie.
   - JavaScript в браузере не имеет к нему доступа, что защищает от XSS атак.
   - Путь cookie ограничен `/api/v1/auth`, чтобы браузер не отправлял его на каждый запрос.

---

## 2. Аутентификация WebSocket (тикет)

Браузер **не передает** access-токен или cookie напрямую на WS-handshake. Перед каждым WebSocket-соединением клиент получает короткоживущий одноразовый **тикет**:

1. **`POST /realtime/ticket`** (глобальный префикс `/api/v1`, Bearer access) → `{ ticket }`.
   - Тикет — JWT HS256 на общем секрете `JWT_ACCESS_SECRET`, claims: `typ: "realtime"`, `sid`, `sessionId`, `exp ≈ 5 мин`.
   - Эндпоинт защищен: `AccessTokenGuard` (живая сессия), `AuthThrottlerGuard` (лимит по IP), `OriginCheckGuard` (точный матч Origin/Referer, допускается self-origin).
2. **WS-Upgrade** `ws(s)://…/ws/sessions/{sessionId}` с subprotocol `realtime.ticket` (тикет в заголовке `Sec-WebSocket-Protocol`).
3. Realtime извлекает креды в приоритете: **subprotocol-тикет → `Authorization: Bearer` → HttpOnly cookie**, верифицирует JWT (HS256, `typ ∈ {access, realtime}`, обязателен `sid`) и:
   - для `typ == "realtime"` — одноразовый `ConsumeTicket(jti)` (повторное использование → `401 token already used`) и привязка к комнате `claims.SessionID == sessionId` из URL (иначе `403`);
   - для `typ == "access"` — мультиюз `IsTokenRevoked` (обратная совместимость при раскатке, без `ConsumeTicket`);
   - проверка активной сессии `auth:session:{sid}` с продлением TTL зеркала.
4. Тикет **нельзя переиспользовать**: новое подключение → новый `POST /realtime/ticket`. После каждого refresh access-токена (ротация `sid`) тикет выпускается заново.

Подробная спецификация и план реализации — `apps/api/docs/spec-realtime-ws-auth.md`, `apps/api/docs/plan-realtime-ws-auth.md`.

---

## 3. Хэширование паролей (Argon2id)

Пароли хэшируются с использованием современного алгоритма **Argon2id** (победитель Password Hashing Competition), устойчивого к атакам на GPU и side-channel:

* **Память (Memory Cost):** `65536` КБ (64 МБ)
* **Итерации (Time Cost):** `3`
* **Параллелизм:** `4` потока

---

## 4. Rate-limiting и Безопасность

* **Throttler Guard (`@nestjs/throttler`)**: ограничивает количество попыток входа и регистрации (по умолчанию 100 запросов в минуту на IP, на чувствительные эндпоинты — более строгие лимиты).
* **AuthThrottlerGuard**: на `POST /realtime/ticket` — лимит по IP (в теле запроса нет email, поэтому идентификатор клиента — IP).
* **OriginCheckGuard**: точный матч `Origin`/`Referer` против `ALLOWED_ORIGINS` (защита от CSRF); допускает self-origin; применяется глобально и на `POST /realtime/ticket`.
* **Helmet**: устанавливает безопасные HTTP-заголовки (HSTS, X-Content-Type-Options, Frameguard).
* **CORS**: строгий белый список доменов (`ALLOWED_ORIGINS`) с обязательным `credentials: true`.
