# План исправления замечаний безопасности, миграций и контрактов DTO

Документ содержит подробный анализ выявленных проблем, оценку их влияния, архитектурные риски (подводные камни) и пошаговый чек-лист выполнения.

---

## 📋 Сводка задач

| # | Область | Проблема / Уязвимость | Влияние | Решение | Статус |
|---|---|---|---|---|---|
| 1 | **Security / DTO** | CWE-521: Ручной ввод пароля администратором в `CreateUserAdminDto` | Риск компрометации паролей администратором и создание слабых паролей | Исключить поле `password` из `CreateUserAdminDto` (Zero-Knowledge: генерация криптостойкого пароля на сервере + email-рассылка) | ✅ Выполнено |
| 2 | **Database / Prisma** | Отсутствие SQL-миграции для столбцов `generation` в `users` и `auth_revocation_tasks` | Ошибки выполнения запросов Prisma в продакшене из-за несоответствия схемы БД (`schema.prisma`) | Создать новую миграцию `20260914150000_add_generation_fields` | ✅ Выполнено |
| 3 | **Tests / Auth** | Недостаточная проверка обновления `lastUsedAt` в тесте `rotateSession` | Ложноположительное прохождение теста при отсутствии обновления временной метки сессии | Добавить в тест `auth-session.service.spec.ts` проверки возвращенного и сохраненного в Redis `lastUsedAt` | ✅ Выполнено |
| 4 | **API Validation / DTO** | `isActive` query-параметр: `preprocess` молча отключает фильтрацию при невалидных значениях | Запрос `?isActive=1` возвращает всех пользователей (200 OK) вместо ошибки 400 | Заменить `preprocess` на `z.union([z.boolean(), z.enum(["true", "false"])])` с `transform` | ✅ Выполнено |
| 5 | **OpenAPI / DTO** | `z.date().or(z.string())` генерирует пустой `anyOf: [{}, {"type": "string"}]` в OpenAPI | Потеря типа `date-time` в контрактах OpenAPI, генерация `any`/`unknown` в клиенте API | Использовать `z.iso.datetime()` для полей дат (`createdAt`, `updatedAt`, `deactivatedAt`) | ✅ Выполнено |
| 6 | **Security / Admin** | Отсутствие инвалидации сессий и инкремента `generation` при смене `email` или `username` администратором | Сохранение доступа по старым JWT/Refresh токенам после смены почты или логина | Добавить проверку `credentialsChanged = roleChanged \|\| emailChanged \|\| usernameChanged`, инкрементировать `generation` и отзывать сессии | ✅ Выполнено |
| 7 | **Performance / Redis** | Неэффективный глобальный `SCAN auth:session:*` в `revokeAllUserSessions` ($O(N)$ чтений) | Задержки и высокая сетевая нагрузка на Redis при большом числе сессий в продакшене | Использовать Redis Sorted Set (`ZSET`) `auth:user:{userId}:sessions` со score=expiration для $O(1)$ выборки, без утечек памяти | ✅ Выполнено |
| 8 | **OpenAPI / Profile** | `z.date().or(z.string())` в `userProfileSchema` и `publicUserProfileSchema` | Генерация `createdAt: unknown \| string` в клиенте `@packages/api` для профилей | Заменить на `z.iso.datetime()` в `packages/dto/src/profile/user-profile.dto.ts` | ✅ Выполнено |
| 9 | **API Validation** | Отсутствие `ParseUUIDPipe` в `sessions.controller.ts` и `notifications.controller.ts` | Некорректный UUID в пути вызывает `500 Internal Server Error` (Postgres syntax error) вместо `400` | Добавить `new ParseUUIDPipe()` для параметров `:id` и `:userId` | ⏳ Ожидает |
| 10 | **DTO Validation** | `addParticipantSchema.userId` использует `min(1)` вместо валидации UUID | Передача не-UUID строки приводит к ошибке БД вместо 400 ошибки валидации | Заменить на `z.string().uuid()` в `participant.dto.ts` | ✅ Выполнено |
| 11 | **Admin Panel / Consistency** | Отсутствие поля `deletedAt` в `userAdminResponseSchema` и `USER_ADMIN_SELECT` | Администратор не видит само-удаленные аккаунты (с 30-дневным окном восстановления) | Добавить `deletedAt` в селект и DTO схемы ответа администратора | ✅ Выполнено |
| 12 | **Storage / S3** | Отсутствие удаления старого аватара из S3 при замене/удалении администратором | Накопление файлов-сирот (orphaned objects) в S3 bucket | Добавить вызов `storageService.deleteFile` в `AdminUsersService.updateUser` | ✅ Выполнено |
| 13 | **Security / Admin** | Сброс логина (`username: null`) администратором не инициирует отзыв сессий | Сохранение доступа по старым токенам после обнуления/сброса логина пользователя | Использовать `dto.username !== undefined && dto.username !== existing.username` в `AdminUsersService.updateUser` | ✅ Выполнено |

---

## 🪨 Выявленные архитектурные подводные камни (Pitfalls & Mitigations)

1. **Утечка памяти в Redis при использовании обычного Set для сессий:**
   - *Проблема:* Когда ключ сессии `auth:session:{sid}` удаляется Redis по истечении TTL (7 дней), обычный Set `auth:user:{uid}:sessions` не знает об этом и сохраняет `sid` навсегда.
   - *Решение:* Использовать **Sorted Set (`ZSET`)**, где score = timestamp истечения срока действия (`now + ttlMs`). При каждом обращении/добавлении вызывается `ZREMRANGEBYSCORE auth:user:{uid}:sessions -inf <now>`, что атомарно и эффективно очищает "протухшие" записи.
2. **Атомарность добавления сессии в индекс пользователя:**
   - *Проблема:* Раздельный вызов `SETEX` для сессии и `ZADD` для пользовательского индекса приводит к race condition и рассинхрону при сбоях сети/процесса.
   - *Решение:* Добавить операцию `ZADD` и `ZREMRANGEBYSCORE` внутрь существующего атомарного Lua-скрипта `createSession`.
3. **Смена администратором собственного Email / Username / Role:**
   - *Проблема:* Если администратор изменит свой собственный `email`, `username` или `role`, инкремент `generation` немедленно отзовет все его сессии, вызвав мгновенный логаут (`401 Unauthorized`).
   - *Решение:* Это корректное поведение безопасности (security-by-design). Зафиксировать в тестах и убедиться, что клиент корректно обрабатывает 401 и перенаправляет на страницу входа с новыми учетными данными.
4. **Формат дат Date vs ISO String в сервисах NestJS:**
   - *Проблема:* При использовании `z.iso.datetime()` возвращаемые из Prisma объекты `Date` должны быть явно сериализованы в строки (`.toISOString()`), иначе TypeScript выдает ошибку несоответствия типов при компиляции.
   - *Решение:* Использовать хелперы маппинга (`mapToUserAdminResponse`, `mapToUserProfileDto`), преобразующие `Date` в стандартную ISO-строку.
5. **Проверка уникальности при сбросе опциональных полей (`username: null`):**
   - *Проблема:* При передаче `username: null` (сброс логина) обращение `prisma.user.findUnique({ where: { username: dto.username } })` приводит к ошибке типизации/рантайма Prisma, так как селектор `where` не принимает значение `null`.
   - *Решение:* Добавить защитное условие `if (dto.username && usernameChanged)` перед проверкой коллизий в БД.
6. **Отказоустойчивое удаление файлов в S3 (Fault Tolerance):**
   - *Проблема:* Сетевой сбой или временная недоступность S3 при удалении старого аватара не должны ломать успешный HTTP-ответ обновления пользователя или откатывать транзакцию БД.
   - *Решение:* Вызывать `storageService.deleteFile(...)` строго после фиксации транзакции БД с неблокирующей обработкой ошибок (`.catch(...)`) и логированием предупреждения.

---

## 🔍 Детальный анализ проблем и чек-лист реализации

---

### 1. Security & Zero-Knowledge: Исключение ручного ввода пароля администратором (Zero-Knowledge Admin Policy)

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/admin/create-user-admin.dto.ts`](../../packages/dto/src/admin/create-user-admin.dto.ts)
- **Суть:** Ранее `CreateUserAdminDto` содержал поле `password`, позволявшее администратору вручную задавать пароль при создании пользователя. Это нарушало приватность (Zero-Knowledge) и создавало риск установки предсказуемых или слабых паролей.
- **Риск / Impact:** Администратор знал начальный пароль пользователя, что снижало безопасность учетной записи. Кроме того, ошибки валидации email не имели четкой локализации.

#### 🛠️ План решения
- [x] **1.1.** Полностью удалить поле `password` из `createUserAdminSchema` и `CreateUserAdminDto`.
- [x] **1.2.** Внедрить генерацию криптографически стойкого временного пароля (16 символов) на стороне сервера в `AdminUsersService.createUser` с отправкой на email пользователя.
- [x] **1.3.** Обновить схему валидации `email`:
  ```typescript
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email"))
    .transform(normalizeEmail)
  ```
- [x] **1.4.** Добавить/обновить unit-тесты для `createUserAdminSchema` в `packages/dto`.

---

### 2. Отсутствие SQL-миграции для полей `generation`

#### 🛑 Описание проблемы
- **Файл модели:** [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma)
- **Суть:** В моделях `User` и `AuthRevocationTask` объявлены поля `generation`:
  - `User.generation Int @default(1)`
  - `AuthRevocationTask.generation Int?`
  Однако ни одна из существующих миграций в [`apps/api/prisma/migrations/`](../../apps/api/prisma/migrations/) не содержала инструкций `ADD COLUMN generation`.
- **Риск / Impact:** При запуске `apps/api/start.sh` (`prisma migrate deploy`) база данных не получала данные колонки. Запросы Prisma к моделям `User` и `AuthRevocationTask` завершались ошибками выполнения (runtime error `column "generation" does not exist`).

#### 🛠️ План решения
- [x] **2.1.** Создать директорию миграции `apps/api/prisma/migrations/20260914150000_add_generation_fields/migration.sql`.
- [x] **2.2.** Добавить DDL-скрипт с `ALTER TABLE "users" ADD COLUMN "generation"` и `ALTER TABLE "auth_revocation_tasks" ADD COLUMN "generation"`.

---

### 3. Проверка обновления `lastUsedAt` при ротации сессии

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/auth/services/auth-session.service.spec.ts`](../../apps/api/src/modules/auth/services/auth-session.service.spec.ts#L214-L223)
- **Суть:** Тест `"успешная ротация → обновляет refreshTokenHash и lastUsedAt"` проверял только `expect(result?.refreshTokenHash).toBe("new-hash")` и `expect(redisSet).toHaveBeenCalledTimes(1)`.
- **Риск / Impact:** Если реализация метода `rotateSession` сохранит старое значение `lastUsedAt`, тест все равно проходил (false positive), маскируя ошибку логики аудита активности сессий.

#### 🛠️ План решения
- [x] **3.1.** В [`apps/api/src/modules/auth/services/auth-session.service.spec.ts`](../../apps/api/src/modules/auth/services/auth-session.service.spec.ts) добавить проверку `expect(result?.lastUsedAt).not.toBe(...)` и `expect(persisted.lastUsedAt).toBe(result?.lastUsedAt)`.

---

### 4. Некорректное значение `isActive` молча отключает фильтрацию

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/admin/admin-users-query.dto.ts`](../../packages/dto/src/admin/admin-users-query.dto.ts#L32-L38)
- **Суть:** Использование `z.preprocess` возвращало `undefined` для любых значений, кроме `"true"`, `true`, `"false"`, `false`. Сервис `AdminUsersService` накладывал фильтр по `isActive` только при `query.isActive !== undefined`.
- **Риск / Impact:** При передаче некорректного значения (например, `?isActive=1`, `?isActive=TRUE`, `?isActive=yes`) Zod преобразовывал его в `undefined`, фильтр игнорировался, и API возвращал `200 OK` со всеми пользователями вместо `400 Bad Request`. Администратор мог принять полный список за список активных пользователей.

#### 🛠️ План решения
- [x] **4.1.** В [`packages/dto/src/admin/admin-users-query.dto.ts`](../../packages/dto/src/admin/admin-users-query.dto.ts) заменить `z.preprocess(...)` на `z.union([z.boolean(), z.enum(["true", "false"])]).transform(...)`.
- [x] **4.2.** Добавить unit-тесты для `adminUsersQuerySchema` в `packages/dto`.

---

### 5. Некорректный тип дат в OpenAPI для схемы ответа пользователя администратора

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/admin/user-admin-response.dto.ts`](../../packages/dto/src/admin/user-admin-response.dto.ts#L27-L33)
- **Суть:** Поля `createdAt`, `updatedAt`, `deactivatedAt` были описаны как `z.date().or(z.string())`. В генераторе OpenAPI это превращалось в `anyOf: [{}, {"type": "string"}]`. Ветка `{}` не валидировала тип, из-за чего спецификация теряла `format: "date-time"`, а кодогенерация API-клиентов создавала типы `any` / `unknown`.
- **Контекст:** В рантайме `AdminUsersService` получает `Date` из Prisma, контроллер возвращает объект в NestJS, а JSON-сериализатор преобразует `Date` в стандартную ISO-строку. В проекте уже используется Zod версии `^4.4.3` с поддержкой `z.iso.datetime()`.

#### 🛠️ План решения
- [x] **5.1.** В [`packages/dto/src/admin/user-admin-response.dto.ts`](../../packages/dto/src/admin/user-admin-response.dto.ts) заменить `z.date().or(z.string())` на `z.iso.datetime()`.
- [x] **5.2.** Добавить/обновить unit-тесты для схем ответа пользователя в `packages/dto`.

---

### 6. Инвалидация активных сессий при изменении `email` или `username` пользователя администратором

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts#L305-L350)
- **Суть:** В методе `updateUser` инкремент `generation: { increment: 1 }` и постановка задачи ревокации `authRevocationTask` выполняются только при изменении роли (`roleChanged = true`). При смене `email` или `username` сессии остаются активными.
- **Риск / Impact:** Если аккаунт передается другому владельцу или меняется email в связи с компрометацией, ранее выданные JWT/Refresh токены продолжают действовать до 7 дней, сохраняя несанкционированный доступ.

#### 🛠️ План решения
- [x] **6.1.** В [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts) расширить условие инвалидации: `const credentialsChanged = roleChanged || (dto.email && dto.email !== existing.email) || (dto.username && dto.username !== existing.username)`.
- [x] **6.2.** Инкрементировать `generation` и отправлять команду ревокации `revokeSessionsWithRetry` при `credentialsChanged`.
- [x] **6.3.** Обновить unit-тесты `admin-users.service.spec.ts` для проверки отзыва сессий при смене `email` и `username`.

---

### 7. Оптимизация поиска и ревокации сессий в Redis (Sorted Set `ZSET`)

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/auth/services/auth-session.service.ts`](../../apps/api/src/modules/auth/services/auth-session.service.ts#L309-L330)
- **Суть:** `revokeAllUserSessions` использует `SCAN auth:session:*` и делает отдельный `GET` запрос для каждой активной сессии в системе.
- **Риск / Impact:** В продакшене при десятках тысяч сессий операция поиска имеет сложность $O(N)$ по всем сессиям, создавая пиковую нагрузку на Redis и задержки в обработке HTTP-запросов.

#### 🛠️ План решения
- [x] **7.1.** В Lua-скрипт `createSession` добавить атомарное сохранение `sessionId` в Sorted Set `auth:user:{userId}:sessions` с `score = now_ms + ttl_ms` и очистку устаревших сессий `ZREMRANGEBYSCORE auth:user:{userId}:sessions -inf now_ms`.
- [x] **7.2.** При удалении сессии (`deleteSession` / `rotateSession`) удалять `sessionId` из ZSET (`ZREM`).
- [x] **7.3.** В `revokeAllUserSessions` запрашивать сессии конкретного пользователя через `ZRANGEBYSCORE auth:user:{userId}:sessions now_ms +inf` ($O(1)$) и удалять их пакетно через Redis pipeline.
- [x] **7.4.** Обновить unit-тесты `auth-session.service.spec.ts`.

---

### 8. Строгая типизация ISO-дат в схемах профиля пользователя

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/profile/user-profile.dto.ts`](../../packages/dto/src/profile/user-profile.dto.ts)
- **Суть:** `publicUserProfileSchema` и `userProfileSchema` используют `z.date().or(z.string())`, что приводит к генерации `createdAt: unknown | string` в сгенерированном API-клиенте.
- **Риск / Impact:** Потеря типобезопасности формата дат на фронтенде и в Swagger.

#### 🛠️ План решения
- [x] **8.1.** Заменить `z.date().or(z.string())` на `z.iso.datetime()` в `packages/dto/src/profile/user-profile.dto.ts`.
- [x] **8.2.** Убедиться, что `UsersService.getProfile` и `UsersService.updateProfile` сериализуют даты в ISO-строки.
- [x] **8.3.** Добавить unit-тесты в `packages/dto` и перегенерировать OpenAPI клиент.

---

### 9. Валидация параметров пути UUID через `ParseUUIDPipe`

#### 🛑 Описание проблемы
- **Файлы:** [`apps/api/src/modules/sessions/sessions.controller.ts`](../../apps/api/src/modules/sessions/sessions.controller.ts), [`apps/api/src/modules/notifications/notifications.controller.ts`](../../apps/api/src/modules/notifications/notifications.controller.ts)
- **Суть:** Эндпоинты используют `@Param("id") sessionId: string` без `ParseUUIDPipe`.
- **Риск / Impact:** Передача некорректного UUID приводит к `500 Internal Server Error` (Postgres syntax error `22P02`) вместо стандартного `400 Bad Request`.

#### 🛠️ План решения
- [ ] **9.1.** Добавить `new ParseUUIDPipe()` для параметров `id` и `userId` в `sessions.controller.ts`.
- [ ] **9.2.** Добавить `new ParseUUIDPipe()` для параметров `id` в `notifications.controller.ts`.
- [ ] **9.3.** Добавить/обновить тесты контроллеров.

---

### 10. Валидация UUID в `addParticipantSchema.userId`

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/sessions/participant.dto.ts`](../../packages/dto/src/sessions/participant.dto.ts)
- **Суть:** Поле `userId` валидируется как `z.string().min(1)` вместо UUID.
- **Риск / Impact:** Невалидная строка проходит Zod-валидацию и падает на уровне запроса к БД с 500 ошибкой.

#### 🛠️ План решения
- [x] **10.1.** Заменить на `userId: z.string().uuid("userId must be a valid UUID")`.
- [x] **10.2.** Обновить тесты DTO.

---

### 11. Поддержка и отображение статуса `deletedAt` в Admin Users API

#### 🛑 Описание проблемы
- **Файлы:** [`packages/dto/src/admin/user-admin-response.dto.ts`](../../packages/dto/src/admin/user-admin-response.dto.ts), [`apps/api/src/common/constants/user-select.constants.ts`](../../apps/api/src/common/constants/user-select.constants.ts)
- **Суть:** Само-удаленные пользователем аккаунты (`deletedAt !== null`, `isActive: true`) отображаются в админке как обычные активные пользователи без возможности отличить их.
- **Риск / Impact:** Неполнота данных в админ-панели и невозможность аудита удаленных аккаунтов.

#### 🛠️ План решения
- [x] **11.1.** Добавить `deletedAt: true` в `USER_ADMIN_SELECT`.
- [x] **11.2.** Добавить `deletedAt: z.iso.datetime().nullable()` в `userAdminResponseSchema`.
- [x] **11.3.** Обновить маппер `mapToUserAdminResponse` в `AdminUsersService`.

---

### 12. Удаление старых файлов аватара из S3 при редактировании администратором

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts)
- **Суть:** При обнулении (`avatarUrl: null`) или замене аватара администратором старый файл не удаляется из S3.
- **Риск / Impact:** Накопление мусорных файлов в хранилище S3/MinIO.

#### 🛠️ План решения
- [x] **12.1.** Внедрить `StorageService` в `AdminUsersService`.
- [x] **12.2.** При `dto.avatarUrl !== undefined && dto.avatarUrl !== existing.avatarUrl && existing.avatarUrl` вызывать `storageService.deleteFile(existing.avatarUrl)`.

---

### 13. Отзыв сессий и инкремент `generation` при сбросе логина (`username: null`)

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts)
- **Суть:** В методе `updateUser` определение изменения логина реализовано как `const usernameChanged = Boolean(dto.username && dto.username !== existing.username)`. При передаче `username: null` (сброс логина пользователя администратором) переменная `usernameChanged` вычисляется в `false`.
- **Риск / Impact:** При сбросе логина администратором (например, при подозрении на компрометацию или нарушении правил) `generation` пользователя не увеличивается и ранее выданные JWT/Refresh токены продолжают действовать до 7 дней.

#### 🛠️ План решения
- [x] **13.1.** В `AdminUsersService.updateUser` заменить условие на `const usernameChanged = Boolean(dto.username !== undefined && dto.username !== existing.username)`.
- [x] **13.2.** Добавить unit-тест в `admin-users.service.spec.ts` на сброс `username` в `null` с проверкой создания задачи отзыва сессий (`authRevocationTask`) и инкремента `generation`.

---

## 🔄 Порядок выполнения и верификации

- [x] 1. Применение исправлений в `packages/dto` (задачи 1, 4, 5).
- [x] 2. Создание SQL-миграции в `apps/api/prisma` (задача 2).
- [x] 3. Обновление тестов auth-сессий в `apps/api` (задача 3).
- [x] 4. Проверка и регенерация контрактов OpenAPI и API client.
- [x] 5. Запуск полного набора тестов (`pnpm test`).
- [x] 6. Реализация отзыва сессий при смене Email / Username администратором (задача 6).
- [x] 7. Оптимизация хранения и ревокации сессий в Redis через Sorted Set (задача 7).
- [x] 8. Исправление OpenAPI схем дат в профиле пользователя (задача 8).
- [ ] 9. Добавление `ParseUUIDPipe` в контроллеры сессий и уведомлений (задача 9).
- [x] 10. Добавление валидации UUID в `addParticipantSchema` (задача 10).
- [x] 11. Добавление `deletedAt` в Admin Users API (задача 11).
- [x] 12. Очистка старых аватаров в S3 при редактировании администратором (задача 12).
- [x] 13. Инвалидация сессий при сбросе логина (`username: null`) администратором (задача 13).
