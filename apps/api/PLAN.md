# План реализации — Auth API (`register`, `login`, `logout`)

## Версия документа

| Версия | Дата | Статус |
|---|---|---|
| 1.4.0 | 2026-08-23 | Актуальный |
| 1.3.0 | 2026-08-23 | Актуальный |
| 1.2.0 | 2026-08-22 | Актуальный |
| 1.1.0 | 2026-08-14 | Актуальный |
| 1.0.0 | 2026-08-14 | Актуальный |

## Change Log

| Версия | Дата | Изменения |
|---|---|---|
| 1.4.0 | 2026-08-23 | Добавлен Phase 11 «Password confirmation и унификация dto» (SPEC.md §5–§6, §63): обязательное `passwordConfirmation`, русские сообщения dto; подключение web — позже. |
| 1.3.0 | 2026-08-23 | Добавлен Phase 10 «OpenAPI/Swagger документация» (SPEC.md §61–§63): Swagger UI (dev-only), скрипт генерации `openapi.yaml`/`openapi.json`, пакет `@packages/api`, миграция dto на zod v4. |
| 1.2.0 | 2026-08-22 | Добавлены Phase 8 «Auth: Login» и Phase 9 «Auth: Logout» (SPEC.md §58–§60); `/auth/logout` убран из «Вне области». |
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
  - `env.validation.ts` — zod-схема полного набора env (§49 SPEC.md): `API_DATABASE_URL`, `API_PORT`, `API_PREFIX`, `NODE_ENV`, `ALLOWED_ORIGINS`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`REFRESH_TOKEN_HASH_SECRET` (≥ 32 символа), `JWT_ACCESS_EXPIRATION`/`JWT_REFRESH_EXPIRATION`, `JWT_ISSUER`/`JWT_AUDIENCE`, `ARGON2_MEMORY_COST`/`ARGON2_TIME_COST`/`ARGON2_PARALLELISM`, `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`, `COOKIE_SECURE`, `THROTTLE_TTL`/`THROTTLE_LIMIT`; переменные Server/JWT/Refresh hashing/Redis лежат в корневом `.env` монорепы, остальные — в `apps/api/.env` (ConfigModule: `envFilePath: ["../../.env", ".env"]`, compose: `--env-file ../../.env`);
  - `configuration.ts` — типизированная конфигурация.
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
- [x] `src/modules/auth/auth.constants.ts` — константы: имя cookie, префикс Redis-ключа (`auth:session:`), `typ`-константы токенов.
- [x] `src/modules/auth/services/token.service.ts` — `generateAccessToken`, `generateRefreshToken`, `verifyAccessToken`, `verifyRefreshToken`, `hashRefreshToken` (HMAC-SHA-256), `jti` через `randomUUID`, verify с `algorithms: ['HS256']` + issuer + audience + typ.
- [x] `src/modules/auth/services/auth-session.service.ts` — create/get/update/delete/rotate/revoke, replay detection в `rotateSession`, TTL из конфига. Session payload (§16 SPEC.md): `userId`, `refreshTokenHash`, `tokenFamilyId`, `createdAt`, `lastUsedAt`.
- [x] `src/modules/auth/auth.service.ts` — `register()` по алгоритму §37 SPEC.md, компенсация при недоступном Redis.
- [x] `src/modules/auth/auth.controller.ts` — `POST /auth/register`, ZodValidationPipe, cookie, `{ accessToken }`.
- [x] `src/modules/auth/guards/auth-throttler.guard.ts` — tracker `ip + body.email`.
- [x] Применить `@UseGuards(AuthThrottlerGuard)` на маршруте `/auth/register` (§41 SPEC.md; упущено в Phase 5, добавлено при выполнении Phase 8).
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

## Phase 8 — Auth: Login (`POST /api/v1/auth/login`, SPEC.md §58–§59)

**Код:**

- [x] `packages/dto`: `src/auth/login.dto.ts` — zod-схема `loginSchema`, тип `LoginDto` (email — валидация и нормализация как в `register.dto.ts`; password — `.min(1).max(128)` без password policy, §58); экспорт из `src/index.ts`.
- [x] `AuthService.login(dto)` (§58): `findByEmail` → не найден → dummy argon2-verify против предвычисленного хеша + generic `401` (§59); `argon2.verify` → не совпал → тот же generic `401`; успех: новые `sessionId`/`tokenFamilyId` → access/refresh JWT → `hashRefreshToken` → `createSession`.
- [x] Dummy-hash для выравнивания timing — константа AuthService с JSDoc-пояснением (§57).
- [x] `AuthController.login()`: `@Post("login")`, ZodValidationPipe, `@UseGuards(AuthThrottlerGuard)`, Set-Cookie атрибуты как у register (§25–28), статус `200`, body `{ accessToken }`.
- [x] Cookie Max-Age вычисляется из `jwt.refreshExpiresIn` через общий хелпер `getRefreshTokenTtlSeconds` (`AuthSessionService` + `AuthController`) вместо захардкоженного 30d; SPEC §25 обновлён.

**Тесты:**

- [x] Unit DTO (`login.dto.test.ts`): нормализация email; пустой пароль → ошибка; пароль >128 символов → ошибка.
- [x] Unit `AuthService.login`: успех (новая session, новые sid/family, корректный HMAC-хеш); unknown email → generic `401` + вызвана dummy-проверка; неверный пароль → идентичный generic `401`; Redis недоступен → `500`, детали не раскрываются.
- [x] Unit `AuthController.login`: статус `200`, body `{ accessToken }`, Set-Cookie HttpOnly/SameSite=Lax/Path=`/api/v1/auth`; guard применён к маршруту.
- [x] Integration (`test/integration/login-persistence.e2e-spec.ts`): после login ключ `auth:session:{sessionId}` существует в Redis (userId, refreshTokenHash, tokenFamilyId); sid/tokenFamilyId login отличаются от register.
- [x] E2E L-01: register → login → `200 { accessToken }`, новый Set-Cookie.
- [x] E2E L-02: неверный пароль → `401` generic, Set-Cookie отсутствует.
- [x] E2E L-03: неизвестный email → `401`, тело байт-в-байт как у L-02.
- [x] E2E L-04: невалидный email / пустой password → `400`.
- [x] Security (§45–46): refresh token не в JSON-ответе; password/токены/secrets не в логах.

**Результат:** dto — 29 тестов, unit — 100, e2e — 13, lint/build — зелёные.

**Исправления по ходу Phase 8:**
1. `AuthThrottlerGuard.getTracker` переписан под API `@nestjs/throttler` v6: базовый `handleRequest` вызывает `getTracker(req, context)` — первым аргументом передаётся **request**, а не ExecutionContext; прежняя реализация падала (`context.switchToHttp is not a function`) на любом запросе к маршруту с guard'ом. Баг не был виден в Phase 7: per-route guard появился только при выполнении Phase 8. Unit-тесты guard'а обновлены (передаётся request напрямую).

## Phase 9 — Auth: Logout (`POST /api/v1/auth/logout`, SPEC.md §60)

**Код:**

- [x] `AuthService.logout(refreshToken?)` (§60, строгая семантика): `verifyRefreshToken` → `getSession(sid)` → отсутствие сессии **или** несовпадение `hashRefreshToken(token)` с сохранённым → `401`; иначе `revokeSession(sid)`.
- [x] `AuthController.logout()`: `@Post("logout")`, чтение `req.cookies[REFRESH_TOKEN_COOKIE_NAME]`, вызов сервиса, всегда `clearCookie` (атрибуты §25–28), `204` при успехе / `401` при отказе.

**Тесты:**

- [x] Unit `AuthService.logout`: успех → `revokeSession(sid)` вызван; сессия отсутствует → `401`; hash mismatch (ротация) → `401`; невалидный/просроченный JWT → `401`; Redis недоступен → `500`.
- [x] Unit `AuthController.logout`: clearCookie с теми же атрибутами; статусы `204`/`401`.
- [x] Integration (`test/integration/logout-persistence.e2e-spec.ts`): после logout ключ `auth:session:{sessionId}` удалён из Redis; User остаётся в PostgreSQL.
- [x] E2E LO-01: logout с валидной cookie → `204`, Set-Cookie сброса, сессия удалена из Redis.
- [x] E2E LO-02: без cookie → `401`.
- [x] E2E LO-03: подделанная cookie → `401`, clearCookie присутствует.
- [x] E2E LO-04: повторный logout с тем же токеном после успешного выхода → `401` (строгая семантика), cookie сброшен.
- [x] Доп. e2e: logout с access JWT вместо refresh → `401` (typ mismatch); logout с битой подписью → `401`.

**Результат:** unit — 114, e2e — 20, lint/build — зелёные.

**Решения по ходу Phase 9:**
1. Все условия отказа 1–4 нормализованы к единому телу `401 "Invalid credentials"` — включая ошибки `verifyRefreshToken` («Invalid token»/«Invalid token type»), чтобы ответы logout были однородными (§60 не требует байт-равенства, как §59, но единый формат проще для клиентов).
2. Cookie name читается из конфига (`cookie.refreshTokenName`, дефолт `refresh_token`) вместо константы — консистентно с set-cookie логикой контроллера; атрибуты §25–28 вынесены в общий приватный хелпер.
3. `clearCookie` передаёт атрибуты §25–28 **без** `Max-Age`: express добавляет заголовок удаления (`Expires=Thu, 01 Jan 1970`), а переданный `Max-Age` восстановил бы пустую cookie на 7 дней. При ошибке Redis (`500`) cookie не сбрасывается (таблица §60).
4. CSRF для `/auth/logout` обеспечивается глобальным `OriginCheckGuard` (APP_GUARD) — отдельное подключение не требуется.

## Phase 10 — OpenAPI/Swagger документация (SPEC.md §61–§63)

**Миграция dto:**

- [ ] `packages/dto`: зависимость `zod` → `^4.4.3` (`pnpm --filter @packages/dto add zod@^4.4.3`); прогон `test`/`typecheck`/`build` (§63).

**Код:**

- [ ] Зависимости api: `pnpm --filter api add @nestjs/swagger yaml`.
- [ ] `src/common/openapi/zod-openapi.ts` — хелпер конвертации zod → OpenAPI SchemaObject (`z.toJSONSchema()`) + обёртки-декораторы (`ZodBody` и т.п.) (§61).
- [ ] `AuthController`: `@ApiTags("auth")`, схема body из `registerSchema`, ответы `201 { accessToken }` (+ описание Set-Cookie §25–28), `400 { field: message }`, `409`.
- [ ] `HealthController`: `@ApiTags("health")`, ответы `200` / `503`.
- [ ] DocumentBuilder: title/description/version, `addBearerAuth()` (задел под access-token, §61), server `http://localhost:{port}`.
- [ ] `configureApp`: при `NODE_ENV !== "production"` — `SwaggerModule.createDocument` + `SwaggerModule.setup("docs")`; в этом режиме helmet с `contentSecurityPolicy: false` (§61).
- [ ] `OriginCheckGuard`: пропуск собственного origin API (`http://localhost:{port}`) + кейс в `origin-check.guard.spec.ts`.
- [ ] При последующей реализации Phase 8–9 их endpoints также описываются декораторами swagger (§61).

**Скрипт генерации:**

- [ ] `apps/api/scripts/generate-openapi.ts` — по образцу `test/helpers/test-app.helper.ts`: `Test.createTestingModule` + `overrideProvider(PrismaService/RedisService)` стабами → `createNestApplication()` → `configureApp(app)` (prefix `/api/v1` попадает в пути) → `SwaggerModule.createDocument` → запись `packages/api/openapi.yaml` + `openapi.json`; Docker PG/Redis не требуются (§62).
- [ ] Скрипты: `apps/api/package.json` — `"generate:openapi": "ts-node scripts/generate-openapi.ts"`; корневой `package.json` — `"generate:api": "pnpm --filter api generate:openapi"`.

**Пакет `@packages/api`:**

- [ ] `packages/api/package.json` (name `@packages/api`, private, exports `./openapi.yaml` / `./openapi.json`, files), `README.md` (назначение, команда регенерации, ссылка на `docs/frontend/data/api-contracts.md`).
- [ ] Сгенерировать и закоммитить `openapi.yaml` + `openapi.json`.

**Тесты:**

- [ ] Unit `zod-openapi.spec.ts`: конвертация `registerSchema` — типы, required, minLength/maxLength, format email.
- [ ] Unit `origin-check.guard.spec.ts`: собственный origin API пропускается.

**Верификация:**

- [ ] `pnpm install` → `pnpm --filter @packages/dto test && pnpm --filter @packages/dto build`;
- [ ] `pnpm --filter api lint && pnpm --filter api test`;
- [ ] `pnpm generate:api` без запущенного Docker → проверка артефактов: paths `/api/v1/health`, `/api/v1/auth/register`, components schema RegisterDto;
- [ ] Ручная проверка: `pnpm --filter api dev` → `http://localhost:3001/docs` загружается, `/docs-json` отдаёт 200 (self-origin разрешён).

## Phase 11 — Password confirmation и унификация dto (SPEC.md §5–§6, §63)

**Пакет `@packages/dto`:**

- [ ] `src/auth/register.dto.ts`: схема дополняется обязательным полем `passwordConfirmation` — non-empty («Подтверждение пароля обязательно»); `.refine()` совпадения с `password` («Пароли не совпадают», путь `passwordConfirmation`); `.transform()` удаляет поле из результата — выходной тип `RegisterDto` остаётся `{ email, password }`, поле не попадает в сервисы/логи (§5).
- [ ] Перевод сообщений об ошибках на русский (единые для API и UI, §63): «Email обязателен», «Некорректный email», «Пароль должен содержать минимум N символов», «Пароль должен содержать максимум N символов».

**Тесты dto:**

- [ ] Обновить существующие фикстуры `register.dto.test.ts` — во все инпуты добавляется `passwordConfirmation`.
- [ ] Новые кейсы: совпадающие пароли проходят; mismatch → «Пароли не совпадают» на пути `passwordConfirmation`; пустое подтверждение → ошибка; поле отсутствует → ошибка.

**API:**

- [ ] Юнит-тесты `AuthService`/`AuthController` — без правок логики (вход `RegisterDto` не меняется); обновить ассерты, если они завязаны на тексты сообщений.
- [ ] Тела запросов e2e/integration (`auth-register.e2e-spec.ts`, `register-persistence.e2e-spec.ts`) дополняются `passwordConfirmation`; новый e2e-кейс: несовпадение паролей → `400`.
- [ ] OpenAPI-спецификация (Phase 10) подхватывает поле автоматически (`z.toJSONSchema()`): `passwordConfirmation` — required в схеме RegisterDto.

**Верификация:**

- [ ] `pnpm --filter @packages/dto test && pnpm --filter @packages/dto typecheck && pnpm --filter @packages/dto build`;
- [ ] `pnpm --filter api lint && pnpm --filter api test`;
- [ ] При выполненной Phase 10: регенерация `pnpm generate:api` → в `openapi.yaml/json` `passwordConfirmation` присутствует и required.

---

## Вне области (будущие фазы)

`/auth/refresh`, `/logout-all`, `/change-password`, access-token guard, CSRF-токен для cross-site сценария. Инфраструктура (TokenService, AuthSessionService, replay detection, token family) готова к их добавлению.

Подключение `apps/web` к `@packages/dto`: форма регистрации на общем `registerSchema` (поле `confirmPassword` → `passwordConfirmation`), удаление локального дубликата из `features/auth/lib/schemas.ts`; `loginSchema` переносится в dto в Phase 8. i18n-ключи вместо текстовых сообщений dto — будущая опция.
