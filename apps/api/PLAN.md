# План реализации — `POST /api/v1/auth/register`

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.2.0 | 2026-08-23 | Актуальный |
| 1.1.0 | 2026-08-14 | Актуальный |
| 1.0.0 | 2026-08-14 | Актуальный |

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.2.0 | 2026-08-23 | Имя refresh cookie вынесено в env `REFRESH_TOKEN_COOKIE_NAME` (корневой `.env`, конфигурация `cookie.refreshTokenName`): Phase 2, Phase 5. |
| 1.1.0 | 2026-08-14 | Добавлены требования к документированию кода (SPEC.md §57): Phase 0 + чек-пункт Phase 6. |
| 1.0.0 | 2026-08-14 | Первоначальная версия плана. |

---

## Phase 0 — Документация

- [x] Заполнить `apps/api/SPEC.md`.
- [x] Определить требования к документированию кода (SPEC.md §57).

## Phase 1 — Scaffolding `apps/api`

- [x] Создать `apps/api/package.json` (name `api`): scripts `dev`, `build`, `start`, `lint`, `test`, `test:e2e` + db-скрипты `db:generate`, `db:migrate:dev`, `db:migrate:deploy`, `db:up`, `db:down` и `predev`/`postinstall` (см. Phase 2).
- [x] Создать `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `biome.json` (по образцу `apps/web`, адаптированный под NestJS: без `css.parser.tailwindDirectives` и `linter.domains` next/react; formatter space 2, `vcs` git, `includes` c `!node_modules`, `!dist`, `!build`), `.env.example`.
- [x] Установить зависимости (pnpm workspace, из корня):

```bash
pnpm --filter api add @nestjs/core @nestjs/common @nestjs/platform-express @nestjs/config @nestjs/throttler prisma @prisma/client ioredis argon2 jsonwebtoken cookie-parser helmet zod
pnpm --filter api add -D @nestjs/cli @types/express @types/node @types/jsonwebtoken @types/cookie-parser typescript ts-node jest ts-jest @types/jest supertest @types/supertest @biomejs/biome@2.4.2
```

- [x] Обновить корневой `turbo.json`: задача `dev` — `persistent: true`, `cache: false` (без `dependsOn`).
- [x] Корневой `turbo.json`: добавить `dev.dependsOn: ["^build"]` в Phase 3 (после появления `packages/dto`); задача `test` (`cache: false`) — в Phase 6 (перед запуском тестов).
- [x] Обновить `lint-staged.config.mjs`: добавить паттерн `apps/api/**/*.{js,ts,json}`.
- [x] (Phase 3) Добавить паттерн `packages/dto/**/*.{js,ts,json}`.

## Phase 2 — Инфраструктура MVP: запуск health check
- [x] `apps/api/docker-compose.yml`: postgres:16-alpine + redis:7-alpine, healthcheck, volume, `REDIS_PASSWORD` с дефолтом `${REDIS_PASSWORD:-mock-interview-redis}`.
- [x] `prisma/schema.prisma` (модель `User`, `@unique` email), `prisma.config.ts` (Prisma 7: url в config, fallback URL для `prisma generate` без `.env`), миграция: `pnpm --filter api db:migrate:dev -- --name init`.
- [x] `src/config/`:
  - `env.validation.ts` — zod-схема полного набора env (§49 SPEC.md): `API_DATABASE_URL`, `API_PORT`, `API_PREFIX`, `NODE_ENV`, `ALLOWED_ORIGINS`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`REFRESH_TOKEN_HASH_SECRET` (≥ 32 символа), `JWT_ACCESS_EXPIRATION`/`JWT_REFRESH_EXPIRATION`, `JWT_ISSUER`/`JWT_AUDIENCE`, `ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`, `COOKIE_SECURE`, `REFRESH_TOKEN_COOKIE_NAME`, `THROTTLE_TTL`/`THROTTLE_LIMIT`; переменные Server/JWT/Refresh hashing/Redis/имя refresh cookie лежат в корневом `.env` монорепы, остальные — в `apps/api/.env` (ConfigModule: `envFilePath: ["../../.env", ".env"]`, compose: `--env-file ../../.env`);
  - `configuration.ts` — типизированная конфигурация (секция `cookie`: `secure`, `refreshTokenName`).
- [x] `src/prisma/` — `PrismaModule`, `PrismaService` (@Global; Prisma 7 adapter `@prisma/adapter-pg` + `pg`).
- [x] `src/common/filters/http-exception.filter.ts` — `HttpExceptionFilter` (маскировка деталей, §56 SPEC.md).
- [x] `src/modules/health/` — `HealthModule`, `HealthController`; `GET /api/v1/health` — ping PostgreSQL (`SELECT 1` через `PrismaService.$queryRaw`); ответ: `200 { "status": "ok", "db": "up" }` / `503 { "status": "error", "db": "down" }`, без внутренних деталей; без auth.
- [x] `src/app.module.ts`, `src/main.ts` — минимальный bootstrap: глобальный prefix `/api/v1`, helmet, CORS (credentials, explicit origin), глобальный `HttpExceptionFilter`, регистрация `PrismaModule` + `HealthModule`.
- [x] Верификация запуска: `pnpm --filter api dev` (поднимает контейнеры и применяет миграции через `predev`) → `lint` → `build` → `curl http://localhost:3001/api/v1/health` → `200 { "status": "ok", "db": "up" }`.

> **Bootstrap (чистый клон):** миграции при `pnpm install` НЕ применяются автоматически. Порядок настройки: скопировать `apps/api/.env.example` в `apps/api/.env` → `pnpm install` (`postinstall` `prisma generate` проходит и без `.env` — fallback URL в `prisma.config.ts`) → `pnpm --filter api db:migrate:dev` (локальная разработка). В CI/CD/прод — `pnpm --filter api db:migrate:deploy`. Клиент генерируется автоматически через `postinstall` (`prisma generate`). `pnpm --filter api dev` автоматически поднимает контейнеры и применяет миграции через `predev` → `db:up` (`docker compose up -d --wait`, требуется запущенный Docker) → `db:migrate:deploy` (неинтерактивный, no-op при применённых миграциях); остановка — `pnpm --filter api db:down`.

## Phase 3 — Пакет `@packages/dto`

- [x] Создать `@packages/dto/package.json` (name `@packages/dto`, сборка tsc → `dist/`), `tsconfig.json`. Обязательно наличие скрипта `build` (tsc → `dist/`) — turbo `^build` собирает dto перед `api`. `biome.json` — адаптированный (без CSS/React-доменов), `@biomejs/biome@2.4.2` в devDependencies.
- [x] Добавить зависимость: `pnpm --filter @packages/dto add zod`.
- [x] Реализовать:
  - `src/auth/email.ts` — `normalizeEmail`, email-валидация;
  - `src/auth/password-policy.ts` — централизованная policy (min 12, max 128);
  - `src/auth/register.dto.ts` — zod-схема `registerSchema`, тип `RegisterDto`;
  - `src/index.ts` — экспорт.
- [x] Подключить к api: `pnpm --filter api add @packages/dto@workspace:*`. Dev/test-резолв пакета — через `tsconfig.paths` (api) и `jest.moduleNameMapper` на `src` dto (без зависимости от собранного `dist`); `build` dto используется только через turbo `^build`.

## Phase 4 — Инфраструктура: Redis и расширение bootstrap

- [x] `src/redis/` — `RedisModule`, `RedisService` (`set/get/delete/expire`), TTL.
- [x] `src/common/`:
  - `ZodValidationPipe`;
  - `SensitiveLoggingInterceptor` (`HttpExceptionFilter` уже в Phase 2).
- [x] Расширить `src/app.module.ts` / `src/main.ts`: cookie-parser, `ThrottlerModule` (default guard), Origin-check guard, подключение `RedisModule`. Origin-check guard устанавливается заранее; защищаемые им endpoints (`/auth/refresh`, `/logout`, `/logout-all`, `/change-password`) — вне области (см. раздел «Вне области»).
- [x] Настройка тестовой инфраструктуры: `jest.config.ts` (ts-jest, moduleNameMapper для `@packages/dto`), `test/jest-e2e.json`.
- [x] Unit-тесты Phase 4:
  - `src/common/pipes/zod-validation.pipe.spec.ts` — валидные/невалидные данные, формат ошибок `{ field: message }`, `_root`, вложенные пути.
  - `src/common/guards/origin-check.guard.spec.ts` — нет заголовков, совпадает/не совпадает, Referer fallback, приоритет Origin, startsWith matching.
  - `src/common/interceptors/sensitive-logging.interceptor.spec.ts` — логирует method/url/latency, не логирует body, пропускает observable.
  - `src/redis/redis.service.spec.ts` — set/get/delete/expire/ping, onModuleInit/onModuleDestroy, дефолты конфига.

## Phase 5 — Auth module

- [x] `src/modules/users/` — `UsersModule`, `UsersService` (`findByEmail`, `create`).
- [x] `src/modules/auth/auth.constants.ts` — константы: префикс Redis-ключа (`auth:session:`), `typ`-константы токенов (имя refresh cookie — из окружения `REFRESH_TOKEN_COOKIE_NAME` через конфигурацию `cookie.refreshTokenName`, §49 SPEC.md).
- [x] `src/modules/auth/services/token.service.ts` — `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`, `hashRefreshToken` (HMAC-SHA-256), `jti` через `randomUUID`, verify с `algorithms: ['HS256']` + issuer + audience + typ.
- [x] `src/modules/auth/services/auth-session.service.ts` — create/get/update/delete/rotate/revoke, replay detection в `rotateSession`, TTL из конфига. Session payload (§16 SPEC.md): `userId`, `refreshTokenHash`, `tokenFamilyId`, `createdAt`, `lastUsedAt`.
- [x] `src/modules/auth/auth.service.ts` — `register()` по алгоритму §37 SPEC.md, компенсация при недоступном Redis.
- [x] `src/modules/auth/auth.controller.ts` — `POST /auth/register`, ZodValidationPipe, cookie (имя из `ConfigService` → `cookie.refreshTokenName`), `{ accessToken }`.
- [x] `src/modules/auth/guards/auth-throttler.guard.ts` — tracker `ip + body.email`.
- [x] Зарегистрировать `UsersModule`, `AuthModule` в `app.module.ts`.

## Phase 6 — Тестирование

**Unit (Health Check, §56 SPEC.md):**

- [x] БД доступна → `200 { "status": "ok", "db": "up" }`;
- [x] Ошибка БД → `503 { "status": "error", "db": "down" }`, без внутренних деталей.

**Unit (AuthService, §37, §48 SPEC.md):**

- [x] successful registration: email нормализуется, user не существует, пароль хешируется, User создаётся, session создаётся, Access JWT, Refresh JWT, refresh token hash, Redis session;
- [x] existing email → 409;
- [x] Redis unavailable → 500, session не создаётся, access token не возвращается, детали ошибки не раскрываются, user удаляется (компенсация).

**Unit (TokenService, §33, §38 SPEC.md):**

- [x] генерация access/refresh JWT; claims `sub`, `sid`, `typ`, `iss`, `aud`, `iat`, `exp`, `jti`;
- [x] разные JWT secrets;
- [x] корректный алгоритм (reject wrong algorithm);
- [x] `hashRefreshToken`.

**Unit (AuthSessionService, §16, §39 SPEC.md):**

- [x] создание/получение/обновление/удаление session;
- [x] rotation; revocation; replay detection;
- [x] Redis key (`auth:session:{sessionId}`), TTL;
- [x] поля userId, refreshTokenHash, tokenFamilyId, createdAt, lastUsedAt.

**Unit (DTO, §5–8 SPEC.md):**

- [x] валидация email, password policy.

**Security (§26–34, §45–46 SPEC.md):**

- [x] password не хранится plaintext и не попадает в logs;
- [x] refresh token в Redis только как hash;
- [x] access token не сохраняется в Redis;
- [x] refresh token не возвращается в JSON;
- [x] JWT secrets не в response и не в logs;
- [x] Redis session имеет TTL;
- [x] cookie: HttpOnly, Secure, корректный SameSite;
- [x] rate limiting работает;
- [x] replay detection работает;
- [x] token family может быть отозвана.

**Integration (§13, §48 SPEC.md):**

- [x] после успешной регистрации User существует в PostgreSQL, `auth:session:{sessionId}` существует в Redis.

**E2E (§4, §47 SPEC.md, supertest на реальные PG+Redis в Docker):**

- [x] E2E-01: успешная регистрация → 201, `{ accessToken }`, `Set-Cookie` c refresh token;
- [x] E2E-02: повторная регистрация → 409, новый user не создаётся;
- [x] E2E-03: невалидный email → 400;
- [x] E2E-04: Redis недоступен → 500, session не создаётся, access token не возвращается;
- [x] E2E-05: невалидный password (min < 12) → 400, user не создаётся.

**Документирование кода (§57 SPEC.md):**

- [x] Публичные методы/типы сервисов, DTO, guards, pipes, filters имеют JSDoc (назначение, `@param`, `@returns`, `@throws`);
- [x] Сгенерированный клиент (`src/generated/prisma`) и зависимости не документированы/не изменены.

## Phase 7 — Верификация

- [x] Выполнить:

```bash
docker compose -f apps/api/docker-compose.yml --env-file ../../.env up -d
pnpm --filter api db:migrate:dev
pnpm --filter api lint
pnpm --filter api build
pnpm --filter api test
pnpm --filter api test:e2e
curl http://localhost:3001/api/v1/health
```

**Результат:** все команды зелёные; живой сервер поднялся через `pnpm --filter api dev`, `GET /api/v1/health` → `200 { "status": "ok", "db": "up" }` (SensitiveLoggingInterceptor залогировал запрос, Redis-сессии активны).

**Исправления по ходу верификации:**
1. Команда compose в плане дописана `--env-file ../../.env`: запуск без него пересоздаёт Redis с дефолтным паролем из compose вместо пароля из корневого `.env` → `WRONGPASS` у приложения.
2. `packages/dto`: рантайм-резолв `@packages/dto` падал (`ERR_MODULE_NOT_FOUND`) — `exports: "." → ./src/index.ts` при `"type": "module"` заставлял Node исполнять TS-source с extensionless ESM-импортами (jest/tsc это прощают, `node dist/main.js` — нет). Фикс: emit CommonJS (`module: commonjs`), условный `exports` (`types → src`, `default → dist/index.js`), убран `"type": "module"`. Тестовые мапперы jest указывают на `src` и не затронуты.

---

## Вне области (будущие фазы)

`/auth/refresh`, `/logout`, `/logout-all`, `/change-password`, access-token guard, CSRF-токен для cross-site сценария. Инфраструктура (TokenService, AuthSessionService, replay detection, token family) готова к их добавлению.
