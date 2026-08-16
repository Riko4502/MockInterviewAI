# Спецификация — `POST /api/v1/auth/register`

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.1.0 | 2026-08-14 | Актуальный |
| 1.0.0 | 2026-08-14 | Актуальный |

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.1.0 | 2026-08-14 | Добавлен раздел §57 — обязательное документирование кода. |
| 1.0.0 | 2026-08-14 | Первоначальная версия спецификации. |

---

## Спецификация

### 1. Назначение

Реализовать Backend API для регистрации пользователя по email и password с последующим созданием авторизованной сессии.

Backend должен:

- принять данные регистрации;
- провалидировать входные данные;
- проверить уникальность email;
- нормализовать email;
- безопасно захешировать пароль;
- создать пользователя в PostgreSQL;
- создать authentication session;
- сгенерировать access token;
- сгенерировать refresh token;
- сохранить данные refresh-сессии в Redis;
- установить refresh token в защищённую HttpOnly cookie;
- применить необходимые security-механизмы.

### 2. Технологический стек

| Область | Решение |
|---|---|
| Backend | NestJS (v11) + TypeScript (strict) |
| База данных | PostgreSQL (Prisma ORM) |
| Кэш/сессии | Redis (ioredis) |
| Валидация DTO | zod (в общем пакете `packages/dto`) |
| JWT | `jsonwebtoken` (HS256, явный allowlist алгоритмов) |
| Password hashing | Argon2id (`argon2`) |
| Rate limiting | `@nestjs/throttler` |
| Cookie | express `Set-Cookie`, `cookie-parser` |
| Security headers | `helmet` |
| Тесты | Jest + ts-jest (unit), supertest (e2e) |
| Локальная среда | Docker Compose (postgres:16-alpine, redis:7-alpine) |

### 3. Архитектура модулей

```
apps/
└── api/
    └── src/
        ├── main.ts
        ├── app.module.ts
        ├── config/
        │   ├── env.validation.ts
        │   └── configuration.ts
        ├── prisma/
        │   ├── prisma.module.ts
        │   └── prisma.service.ts
        ├── redis/
        │   ├── redis.module.ts
        │   └── redis.service.ts
        ├── common/
        │   ├── pipes/zod-validation.pipe.ts
        │   ├── filters/http-exception.filter.ts
        │   └── interceptors/sensitive-logging.interceptor.ts
        └── modules/
            ├── users/
            │   ├── users.module.ts
            │   └── users.service.ts
            └── auth/
                ├── auth.module.ts
                ├── auth.controller.ts
                ├── auth.service.ts
                ├── auth.constants.ts
                ├── services/
                │   ├── token.service.ts
                │   └── auth-session.service.ts
                └── guards/
                    └── auth-throttler.guard.ts
```

Пакет DTO:

```
packages/
└── dto/
    └── src/
        ├── index.ts
        └── auth/
            ├── register.dto.ts
            ├── password-policy.ts
            └── email.ts
```

### 4. API

`POST /api/v1/auth/register`

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Response (успех):

- `201 Created`
- Body: `{ "accessToken": "eyJhbGciOi..." }`
- `Set-Cookie: refresh_token=<JWT>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000`

### 5. RegisterDto

Находится в `packages/dto/src/auth/register.dto.ts`.

| Поле | Обязательное | Требования |
|---|---|---|
| `email` | да | строка; корректный email-формат; trim; нормализация регистра (lowercase); non-empty |
| `password` | да | строка; соответствует password policy; non-empty |

Реализация — zod-схема `registerSchema` + экспорт типа `RegisterDto = z.infer<typeof registerSchema>`.

### 6. Validation

Выполняется до бизнес-логики регистрации через `ZodValidationPipe` (кастомный pipe на `zod.safeParse`).

Проверки:

- `email` non-empty, валидный формат;
- `password` non-empty, соответствует policy.

При ошибке: `400 Bad Request`. Пользователь не создаётся.

### 7. Password Policy

Централизована в `packages/dto/src/auth/password-policy.ts`.

- Минимальная длина: `>= 12`.
- Максимальная длина: `128` (не искусственно низкая; защита от resource exhaustion при Argon2id).
- Policy используется для: регистрации, изменения пароля, восстановления пароля, установки нового пароля.

### 8. Email Normalization

Централизована в `packages/dto/src/auth/email.ts`:

```ts
normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
```

`User@Example.COM` → `user@example.com`.

Одно правило используется в: registration, login, password reset, email verification.

### 9. User Model (PostgreSQL, Prisma)

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}
```

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | UUID | да | ID пользователя |
| `email` | string | да | Нормализованный email |
| `passwordHash` | string | да | Хеш пароля |
| `createdAt` | Date | да | Дата создания |
| `updatedAt` | Date | да | Дата изменения |

### 10. Email Unique Constraint

- На уровне PostgreSQL: `UNIQUE(email)` (Prisma `@unique`, миграция).
- Два уровня проверки:
  - Application layer: `UsersService.findByEmail(email)` → `409 Conflict`.
  - Database constraint: catch Prisma `P2002` (unique violation) → `409` — защита от race condition.

### 11. Password Hashing

- Используется Argon2id.
- Flow: `password → Argon2id → passwordHash → PostgreSQL`.
- В PostgreSQL хранится только `passwordHash`.
- Запрещено сохранять `password`.

### 12. Password Security

- Уникальная salt для каждого пароля (обеспечивается `argon2.hash`).
- Параметры Argon2id вынесены в конфигурацию (`ARGON2_*`): memoryCost, timeCost, parallelism.
- Пароль не логируется, не возвращается в API response, не хранится plaintext, не передаётся в другие сервисы после регистрации.

### 13. Authentication Session

- Session связывает `userId` с состоянием refresh-сессии.
- PostgreSQL — постоянное хранение пользователя.
- Redis — состояние активной authentication session.

### 14. Session ID

- Для каждой session генерируется уникальный `sessionId` — UUID v4 (`crypto.randomUUID()`), криптографически стойкий, непредсказуемый.

### 15. Redis Key

Формат: `auth:session:{sessionId}`

Пример: `auth:session:550e8400-e29b-41d4-a716-446655440000`

### 16. Redis Session

Хранится JSON:

```json
{
  "userId": "user-uuid",
  "refreshTokenHash": "hash",
  "tokenFamilyId": "family-uuid",
  "createdAt": "2026-08-13T10:00:00.000Z",
  "lastUsedAt": "2026-08-13T10:00:00.000Z"
}
```

- `userId` — ID пользователя.
- `refreshTokenHash` — HMAC-хеш текущего refresh token.
- `tokenFamilyId` — ID семейства refresh tokens (rotation, replay detection).
- `createdAt` — дата создания session.
- `lastUsedAt` — дата последнего использования refresh token.

### 17. Refresh Token Storage

- Plaintext refresh token запрещено хранить в Redis.
- Flow: `Refresh Token → HMAC-SHA-256 → refreshTokenHash → Redis`.
- HMAC-ключ: `REFRESH_TOKEN_HASH_SECRET`.

### 18. Redis TTL

- TTL Redis session = `JWT_REFRESH_EXPIRATION` (по умолчанию `7d`).
- TTL должен соответствовать lifetime refresh token (исключить рассинхрон «JWT valid + session expired» и обратный случай).

### 19. Access Token

- Короткоживущий JWT.
- TTL: `JWT_ACCESS_EXPIRATION=15m`.

### 20. Access Token Payload

```json
{
  "sub": "user-uuid",
  "sid": "session-uuid",
  "typ": "access",
  "iss": "service-name",
  "aud": "api",
  "iat": 1234567890,
  "exp": 1234568790,
  "jti": "token-uuid"
}
```

Claims: `sub` (ID пользователя), `sid` (ID session), `typ` (тип токена), `iss` (issuer), `aud` (audience), `iat` (время выпуска), `exp` (время истечения), `jti` (уникальный ID токена).

### 21. Access Token Restrictions

Access token не должен содержать: password, passwordHash, refresh token, refresh token hash, JWT secrets и другую чувствительную информацию.

### 22. Access Token Storage

- Access token не хранится в Redis.
- Возвращается в body `{ "accessToken": "..." }`.
- Отправляется в API через `Authorization: Bearer <access-token>`.
- На Frontend хранится только в памяти приложения (не localStorage / sessionStorage) — требование Frontend.

### 23. Refresh Token

- Отдельный JWT.
- TTL: `JWT_REFRESH_EXPIRATION=7d`.

### 24. Refresh Token Payload

```json
{
  "sub": "user-uuid",
  "sid": "session-uuid",
  "typ": "refresh",
  "iss": "service-name",
  "aud": "api",
  "iat": 1234567890,
  "exp": 1234568790,
  "jti": "token-uuid"
}
```

Обязательные claims: `sub`, `sid`, `typ`, `iss`, `aud`, `iat`, `exp`, `jti`.

### 25. Refresh Token Cookie

- Refresh token не возвращается в JSON response.
- Передаётся через HttpOnly cookie:

```
Set-Cookie: refresh_token=<JWT>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000
```

### 26. HttpOnly

- `HttpOnly` запрещает JavaScript читать refresh token (`document.cookie`).
- Снижает риск кражи через XSS.

### 27. Secure

- `Secure` — cookie передаётся только по HTTPS.
- Для локальной разработки допускается отдельная development configuration (`COOKIE_SECURE=false`).

### 28. SameSite

- Принято значение `SameSite=Lax`.
- Frontend (localhost:3000) и Backend (localhost:3001) — same-site (разные порты, один host), Lax работает.
- Если Frontend и Backend работают в cross-site сценарии — отдельно реализуется CSRF protection.

### 29. CSRF

Минимальная стратегия:

- `SameSite=Lax`;
- guard проверки `Origin`/`Referer` для state-changing endpoints (`POST /auth/refresh`, `/logout`, `/logout-all`, `/change-password`);
- CSRF token mechanism — при необходимости (cross-site сценарий).

### 30. Token Rotation

Flow:

```
Refresh Token #1 → POST /auth/refresh → Validate #1 → Invalidate #1 → Create #2 (новый hash → Redis) → Новый Access Token
```

После успешного использования старый refresh token становится недействительным.

### 31. Token Family

- Для session создаётся `tokenFamilyId`.
- Все refresh tokens принадлежат одной session/token family.

### 32. Replay Detection

- Повторное использование уже использованного refresh token считается потенциальной компрометацией.
- Действие: revoke session/token family → invalidate refresh authentication → пользователь должен пройти аутентификацию заново.
- Реализация: `AuthSessionService.rotateSession()` сравнивает входящий hash с сохранённым; при несовпадении — replay detected → `revokeSession`.

### 33. JWT Algorithm

- Явный allowlist алгоритмов при verification: `algorithms: ['HS256']`.
- Алгоритм не принимается из входящего JWT как доверенное значение.
- При verification проверяются: algorithm, signature, issuer, audience, expiration, token type (`typ`).

### 34. JWT Secrets

Отдельные secrets:

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `REFRESH_TOKEN_HASH_SECRET`

Secrets: не в Git, не в исходном коде, не во frontend, не логируются. Минимальная длина — 32 символа (валидируется zod-схемой env). Для production — Secret Manager.

### 35. Auth Module

Структура указана в разделе 3. `AuthModule` содержит `AuthController`, `AuthService`, `TokenService`, `AuthSessionService`, guards.

### 36. AuthController

- Отвечает только за HTTP layer.
- `POST /api/v1/auth/register`: принимает request, валидирует DTO, вызывает `AuthService.register()`, устанавливает refresh cookie, возвращает `{ accessToken }`.
- Бизнес-логика в Controller не размещается.

### 37. AuthService

Алгоритм `register(RegisterDto)`:

1. Получить `RegisterDto` (уже валидирован pipe).
2. Выполнить validation.
3. Нормализовать email (`normalizeEmail`).
4. Проверить существование пользователя (`findByEmail`).
5. Если существует → `409 Conflict`.
6. Захешировать password через Argon2id.
7. Создать User в PostgreSQL (catch `P2002` → `409`).
8. Создать `sessionId` (UUID v4).
9. Создать `tokenFamilyId` (UUID v4).
10. Сгенерировать Access JWT.
11. Сгенерировать Refresh JWT.
12. Вычислить `refreshTokenHash` (HMAC-SHA-256).
13. Создать Redis authentication session.
14. Установить TTL Redis session.
15. Установить HttpOnly refresh cookie.
16. Вернуть `{ accessToken }`.

### 38. TokenService

Методы:

- `generateAccessToken(userId, sessionId)`
- `generateRefreshToken(userId, sessionId)`
- `verifyAccessToken(token)`
- `verifyRefreshToken(token)`
- `hashRefreshToken(token)`

Ответственность: генерация JWT, verification, создание claims, hashing refresh token, работа с JWT configuration.

### 39. AuthSessionService

Методы:

- `createSession()`
- `getSession()`
- `updateSession()`
- `deleteSession()`
- `rotateSession()`
- `revokeSession()`

Ответственность: Redis key, Redis session, TTL, refresh token hash, token family, replay detection.

### 40. RedisService

Абстракция над Redis client (ioredis):

- `set(key, value, ttlSeconds)`
- `get(key)`
- `delete(key)`
- `expire(key, ttlSeconds)`

Бизнес-логика authentication не обращается к Redis client напрямую:

```
AuthService → AuthSessionService → RedisService → Redis
```

### 41. Rate Limiting

`POST /api/v1/auth/register`:

- глобально по IP (ThrottlerModule, default guard);
- на `/auth/register` — кастомный `AuthThrottlerGuard` с tracker `ip + body.email` (защита от массовой регистрации).

Цели: защита от массовой регистрации, brute-force, resource exhaustion, abuse prevention.

### 42. Account Enumeration

- Принято: `409 Conflict` с сообщением `"User already exists"` (согласовано с алгоритмом §37).

### 43. Redis Security

- Redis не доступен напрямую из Internet: private network, authentication (password), firewall/security groups, TLS при необходимости.

### 44. Response

Успешная регистрация: `201 Created`, body `{ "accessToken": "..." }`, refresh token через `Set-Cookie`.

### 45. Запрещённые данные в Response

Не возвращать: `password`, `passwordHash`, `refreshToken`, `refreshTokenHash`, JWT secrets, Redis credentials, internal session data.

### 46. Logging

Запрещено логировать: `password`, `passwordHash`, `accessToken`, `refreshToken`, `refreshTokenHash`, JWT secrets, Redis credentials. Не логировать полный `Authorization` header.

Реализация: `SensitiveLoggingInterceptor` / middleware — логирует URL, метод, status, latency, но не тело auth-запросов и не чувствительные поля.

### 47. Error Handling

| Случай | Код |
|---|---|
| Invalid DTO | `400 Bad Request` |
| Existing email | `409 Conflict` |
| PostgreSQL error | `500 Internal Server Error` |
| Redis error | `500 Internal Server Error` |

В production response не содержит: stack trace, SQL query, Redis credentials, JWT secrets, internal infrastructure details (реализует `HttpExceptionFilter`).

### 48. PostgreSQL + Redis Consistency

- PostgreSQL и Redis — не единая ACID transaction.
- Flow: `Create User → Create Auth Session (Redis)`.
- Если Redis недоступен после создания user — не возвращать access token без корректной session. Компенсация: best-effort удаление созданного user + `500` без внутренних деталей.

### 49. Environment Configuration

Переменные окружения разделены по месту хранения:

- Корневой `.env` монорепы (общие настройки: Server, JWT, Refresh token hashing, Redis).
- `apps/api/.env` (специфичные для api: Database, Argon2id, Cookie, Rate limiting).

`ConfigModule` загружает оба файла через `envFilePath: ["../../.env", ".env"]` (пути относительно `apps/api`; приоритет у файла, идущего раньше). Docker Compose читает корневой `.env` через `--env-file ../../.env` (нужно для `REDIS_PASSWORD`).

Корневой `.env`:

```dotenv
# Server
API_PORT=3001
API_PREFIX=/api/v1
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# JWT
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d
JWT_ISSUER=mock-interview-ai
JWT_AUDIENCE=api

# Refresh token hashing
REFRESH_TOKEN_HASH_SECRET=

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

`apps/api/.env`:

```dotenv
# Database
API_DATABASE_URL=postgresql://mock_interview:mock_interview@localhost:5432/mock_interview?schema=public

# Argon2id
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4

# Cookie
COOKIE_SECURE=false

# Rate limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

Production secrets хранятся вне исходного кода (Secret Manager).

### 50–55. Тестирование

Карта тестов приведена в `apps/api/PLAN.md`, Phase 6 «Тестирование».

### 56. Health Check

- Endpoint: `GET /api/v1/health` (глобальный prefix `/api/v1`).
- Без authentication, доступен для проверки доступности сервиса (orchestrators, load balancers, мониторинг).
- Проверка PostgreSQL: `SELECT 1` через `PrismaService.$queryRaw` (модуль `src/modules/health/`: `HealthModule`, `HealthController`).
- Ответ:

| Случай | Код | Body |
|---|---|---|
| БД доступна | `200 OK` | `{ "status": "ok", "db": "up" }` |
| Ошибка БД | `503 Service Unavailable` | `{ "status": "error", "db": "down" }` |

- В ответе запрещено раскрывать: stack trace, connection strings, hostnames, внутренние детали инфраструктуры (реализует `HttpExceptionFilter`).
- Чувствительные данные не логируются (в рамках `SensitiveLoggingInterceptor`).

### 57. Документирование кода

Обязательное документирование кода — производственный код сопровождается JSDoc/TSDoc-комментариями.

Требования:

- Документируются публичные API: методы и типы сервисов (`PrismaService`, `RedisService`, `UsersService`, `AuthService`, `TokenService`, `AuthSessionService`), DTO-схемы (`packages/dto`), guards, pipes, filters, конфигурация (`src/config`), health-модуль.
- JSDoc-блок включает: назначение, `@param`, `@returns`, `@throws` (при наличии ошибок).
- Сгенерированный код (`src/generated/prisma`) и код зависимостей не документируется и не редактируется.
- Тривиальный код (геттеры, присваивания без логики) может не иметь JSDoc.
- Язык комментариев — русский (в едином стиле с документацией проекта).
- Соответствие проверяется в code review (biome по умолчанию не требует JSDoc); в `PLAN.md`, Phase 6, зафиксирован чек-пункт.

---

## Связанные документы

- План реализации: `apps/api/PLAN.md`.
