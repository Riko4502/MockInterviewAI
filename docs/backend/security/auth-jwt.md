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
   - Содержит claims: `sub` (ID пользователя), `sid` (ID активной сессии), `permissions` (числовая битовая маска прав, например `0` или `1`), `typ: "access"`, `iss`, `aud`, `exp`.
   - Поле `role` в JWT отсутствует для максимальной легковесности токена — авторизация выполняется строго по атомарным битовым правам (`RolesGuard`), а название роли передается в ответе `GET /api/v1/profile/me` ([подробнее о RBAC & PBAC](./rbac.md)).
   - `jti` в Redis не сохраняется: статический блэклист access-токенов не ведется. Живая ревокация обеспечивается ключом сессии — каждый защищенный запрос проходит через глобальный `AccessTokenGuard` с live-проверкой `EXISTS auth:session:{sid}` (сессия активна; A8/P5), а затем через `RolesGuard` для проверки битовых прав.
   - Logout/смена пароля/logoutAll/смена роли: `auth:session:{sid}` удаляется, публикуется `{instanceId, data: userId, sessionId?}` в канал `auth:revocations` (realtime разрывает активные WS через `EvictUser`; при `sessionId` — room-scoped `EvictFromRoom`).
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
2. **WS-Upgrade** `ws(s)://…/ws/sessions/{sessionId}` с `Sec-WebSocket-Protocol: realtime, <ticket>` (согласованный subprotocol — `realtime`; тикет в заголовке `Sec-WebSocket-Protocol`).
3. Realtime извлекает креды в приоритете: **subprotocol-тикет → `Authorization: Bearer` → HttpOnly cookie**, верифицирует JWT (HS256, `typ ∈ {access, realtime}`, обязателен `sid`) и:
   - для `typ == "realtime"` — одноразовый `ConsumeTicket(jti)` (повторное использование → `401 token already used`) и привязка к комнате `claims.SessionID == sessionId` из URL (иначе `403`);
   - для `typ == "access"` — мультиюз `IsTokenRevoked` (обратная совместимость при раскатке, без `ConsumeTicket`); доступен только при `REALTIME_ALLOW_ACCESS_FALLBACK=true`, иначе `403`;
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

## 5. Авторизация через GitHub OAuth

Задайте вместе `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`,
`GITHUB_CALLBACK_URL` и `FRONTEND_URL`. Без настройки OAuth вход по паролю
остаётся доступен, а маршруты GitHub возвращают 503. В настройках GitHub OAuth App
укажите точный URL возврата на backend. Для production требуются HTTPS
и `COOKIE_SECURE=true`.

- `GET /api/v1/auth/github` сохраняет случайный state, хеш привязки к браузеру
  и проверочное значение PKCE в Redis на 300 секунд, затем перенаправляет на GitHub
  с правами `read:user user:email` и PKCE S256. Временная HttpOnly cookie
  использует существующие атрибуты cookie и привязывает вход к исходному браузеру.
- `GET /api/v1/auth/github/callback` однократно извлекает state через `GETDEL`,
  проверяет привязку к браузеру, обменивает код и запрашивает `/user` и
  `/user/emails`. Предпочтение отдаётся подтверждённому основному email;
  если его нет, используется другой подтверждённый email. Маршруты OAuth
  допускают браузерные переходы с других источников. Защиту от CSRF при возврате
  обеспечивает проверка state вместо глобальной проверки Origin/Referer.
- Поиск пользователя выполняется сначала по `githubId`, затем по нормализованному
  email. Условное связывание и повторный поиск при конфликте уникальности
  предотвращают перезапись связи с другим аккаунтом GitHub. Новые пользователи
  получают существующую роль USER и `passwordHash = null`.
- `AuthService.loginUser` сохраняет правила восстановления удалённых аккаунтов
  и создаёт существующую пару access/refresh JWT и сессию Redis. Контроллер
  устанавливает существующую refresh cookie и перенаправляет на `/dashboard`
  по адресу `FRONTEND_URL`. Клиент получает access JWT через существующий
  `POST /api/v1/auth/refresh`. Токены не передаются в URL перенаправления;
  отдельный маршрут возврата на frontend не требуется.
- Токены GitHub не сохраняются. Таймаут HTTP-запросов составляет 10 секунд.
  Из ошибок исключаются чувствительные данные, из логов запросов — query-параметры.

Повторный запуск OAuth в том же браузере заменяет временную cookie привязки:
завершить можно только последний начатый вход. Вход по паролю и смена пароля
отклоняются для пользователей без хеша пароля с общим сообщением об ошибке
учётных данных. Существующий сброс пароля позволяет задать пароль после
подтверждения доступа к почте аккаунта.

Описание протокола: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
