# План улучшений и доработок модуля Admin Users

Документ содержит подробный технический анализ выявленных архитектурных рисков, функциональных пробелов и задач оптимизации для модуля административного управления пользователями (`apps/api/src/modules/admin`, `@packages/dto`).

---

## 📋 Сводка задач

| # | Область | Проблема / Задача | Влияние | Предлагаемое решение | Приоритет | Статус |
|---|---|---|---|---|---|---|
| 1 | **Security / Admin** | Смена собственной роли администратором (Self-Role Modification) | Нарушение принципа разделения прав и риск случайного лишения себя доступа | Запретить администратору менять роль самому себе (`id === currentAdminId && roleChanged`), выбрасывая `BadRequestException('Cannot change own administrator role')` | 🔴 Высокий | ✅ Выполнено |
| 2 | **API / Admin Users** | Отсутствие фильтрации по удаленным аккаунтам (`isDeleted` / `deletedAt`) | Невозможность быстро отфильтровать пользователей в 30-дневном окне восстановления | Добавить query-параметр `isDeleted?: boolean` в `adminUsersQuerySchema` и фильтрацию в `AdminUsersService.getUsersList` | 🟡 Средний | ✅ Выполнено |
| 3 | **Security / Features** | Сброс пароля пользователя администратором с генерацией временного пароля | Невозможность восстановить доступ скомпрометированному пользователю или пользователю без доступа к email | Добавить эндпоинт `POST /api/v1/admin/users/:id/reset-password` (генерация временного пароля сервером, отправка на email, инкремент `generation` и отзыв сессий) | 🟡 Средний | ✅ Выполнено |
| 4 | **Admin / Lifecycle** | Отсутствие ручного восстановления или принудительного удаления аккаунтов | Невозможность удалить спам-ботов или вручную восстановить аккаунт по обращению в поддержку | Добавить эндпоинты `DELETE /api/v1/admin/users/:id` (мягкое удаление и отзыв сессий) и `POST /api/v1/admin/users/:id/restore` (восстановление) | 🟡 Средний | ✅ Выполнено |
| 5 | **Audit / Security** | Отсутствие персистентного журнала административных действий (Audit Log) | Невозможность расследовать инциденты безопасности и изменения прав/статусов пользователей | Создать модель `AdminAuditLog` в Prisma и сохранять записи при создании, редактировании, смене статуса или роли пользователя | 🟡 Средний | ❌ Отклонено |
| 6 | **Performance / DB** | Неоптимальный поиск по подстроке (`ILIKE '%query%'`) без Trigram-индекса | Full Table Scan (Seq Scan) при большом количестве пользователей в продакшене | Добавить миграцию PostgreSQL с расширением `pg_trgm` и триграммными GIN-индексами для `email`, `username`, `displayName` | 🟢 Низкий | ✅ Выполнено |

---

## 🪨 Выявленные архитектурные подводные камни (Pitfalls & Mitigations)

1. **Защита от изменения собственных привилегий (Self-Modification Guard):**
   - *Проблема:* Администратор не должен иметь возможность повышать или понижать свои собственные привилегии или менять собственную роль, чтобы избежать ошибок конфигурации доступа или злоупотреблений.
   - *Решение:* По аналогии с защитой от самодеактивации в `updateStatus`, метод `updateUser` должен проверять `if (id === currentAdminId && roleChanged)` и прерывать выполнение с `BadRequestException("Cannot change own administrator role")`. Для изменения роли администратора требуется действие другого администратора.

2. **Безопасность сброса пароля администратором (Zero-Knowledge & Email Delivery):**
   - *Проблема:* Администратор не должен иметь возможность придумывать и задавать пароль вручную (нарушение приватности и риска установки слабых паролей).
   - *Решение:*
     - Сервер самостоятельно генерирует криптографически стойкий случайный временный пароль (16 символов, буквы, цифры, спецсимволы);
     - Пароль хешируется через Argon2id, обновляется в БД с инкрементом `generation: { increment: 1 }` и немедленным отзывом всех активных сессий пользователя (`revokeSessionsWithRetry`);
     - Пароль отправляется пользователю на email.

3. **Восстановление само-удаленного аккаунта администратором:**
   - *Проблема:* Если пользователь само-удалился (`deletedAt !== null`), но обратился в поддержку в течение 30 дней, администратор должен иметь возможность восстановить аккаунт (`deletedAt = null`), при этом `isActive` должен оставаться консистентным.
   - *Решение:* Разрешить передачу `deletedAt: null` в `UpdateUserAdminDto` или реализовать выделенный эндпоинт `POST /api/v1/admin/users/:id/restore`.

4. **Производительность составного поиска через OR:**
   - *Проблема:* Условие `where.OR: [email, username, displayName]` при стандартном B-Tree индексе приводит к сканированию всей таблицы.
   - *Решение:* Использование PostgreSQL `gin_trgm_ops` индексов позволяет ускорить `ILIKE` поиск по подстроке до $O(\log N)$.

---

## 🔍 Детальное описание задач

---

### 1. Запрет смены собственной роли администратора (Self-Role Modification Protection)

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts#L294-L310)
- **Суть:** В методе `updateUser` администратор может передать `{ role: "USER" }` или любую другую роль для своего собственного аккаунта. В отличие от `updateStatus` (где реализована проверка `if (id === currentAdminId && !dto.isActive)`), в `updateUser` текущий `currentAdminId` не передается и не проверяется.
- **Риск / Impact:** Администратор может случайно лишить себя административного доступа или нарушить принцип разделения привилегий. Изменение роли администратора должно выполняться исключительно другим администратором.

#### 🛠️ План решения
- [x] **1.1.** В `AdminUsersController.updateUser` внедрить декоратор `@CurrentUser("sub") currentAdminId: string` и передавать его третьим аргументом в `adminUsersService.updateUser(id, dto, currentAdminId)`.
- [x] **1.2.** В `AdminUsersService.updateUser` после вычисления `roleChanged`:
  ```typescript
  if (id === currentAdminId && roleChanged) {
    throw new BadRequestException("Cannot change own administrator role");
  }
  ```
- [x] **1.3.** Добавить unit-тесты в `admin-users.service.spec.ts` и `admin-users.controller.spec.ts`.

---

### 2. Фильтрация списка пользователей по статусу удаления (`isDeleted`)

#### 🛑 Описание проблемы
- **Файл:** [`packages/dto/src/admin/admin-users-query.dto.ts`](../../packages/dto/src/admin/admin-users-query.dto.ts)
- **Суть:** В ответе `UserAdminResponseDto` уже присутствует поле `deletedAt`, однако в query-параметрах `AdminUsersQueryDto` нет возможности отфильтровать пользователей:
  - только удаленные (`deletedAt !== null`);
  - только не удаленные (`deletedAt === null`).
- **Риск / Impact:** Администратор не может отслеживать пользователей, находящихся в 30-дневном льготном периоде перед окончательной очисткой (User Cleanup Cron).

#### 🛠️ План решения
- [x] **2.1.** В `adminUsersQuerySchema` добавить поле `isDeleted`:
  ```typescript
  isDeleted: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => val === true || val === "true")
    .optional(),
  ```
- [x] **2.2.** В `AdminUsersService.getUsersList` применять условие:
  ```typescript
  if (isDeleted !== undefined) {
    where.deletedAt = isDeleted ? { not: null } : null;
  }
  ```
- [x] **2.3.** Обновить Swagger документацию и Swagger-аннотацию `@ApiQuery({ name: "isDeleted", ... })`.
- [x] **2.4.** Добавить unit-тесты для DTO и сервиса.

---

### 3. Сброс пароля пользователя администратором (генерация временного пароля)

#### 🛑 Описание проблемы
- **Файлы:** [`apps/api/src/modules/admin/controllers/admin-users.controller.ts`](../../apps/api/src/modules/admin/controllers/admin-users.controller.ts), [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts)
- **Суть:** Администратор не имеет интерфейса для инициирования сброса пароля пользователя при компрометации аккаунта или обращении в службу поддержки. Администратор не должен придумывать пароль вручную.
- **Риск / Impact:** Невозможность восстановить доступ легитимному пользователю силами технической поддержки.

#### 🛠️ План решения
- [x] **3.1.** Реализовать эндпоинт `POST /api/v1/admin/users/:id/reset-password` (без тела запроса, доступен администраторам).
- [x] **3.2.** В `AdminUsersService`:
  - Сгенерировать криптографически стойкий временный пароль (16 символов, буквы, цифры, спецсимволы);
  - Захешировать пароль через Argon2id;
  - В транзакции БД обновить `passwordHash`, инкрементировать `generation: { increment: 1 }` и создать `authRevocationTask`;
  - Инициировать отзыв всех сессий пользователя через `revokeSessionsWithRetry`;
  - Отправить сгенерированный временный пароль на email пользователя.
- [x] **3.3.** Добавить unit-тесты в `admin-users.service.spec.ts` и `admin-users.controller.spec.ts`.
- [x] **3.4.** Перегенерировать контракты OpenAPI и API-клиент.

---

### 4. Ручное восстановление и принудительное удаление аккаунта

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts)
- **Суть:** Отсутствуют операции административного удаления спам-аккаунтов (`DELETE`) и ручного восстановления ошибочно удаленных учетных записей.
- **Риск / Impact:** Накопление вредоносных аккаунтов в системе до срабатывания глобального 30-дневного крона.

#### 🛠️ План решения
- [x] **4.1.** Добавить эндпоинт `DELETE /api/v1/admin/users/:id` для немедленной мягкой деактивации/удаления (с защитой от удаления собственного аккаунта администратора и отзывом сессий).
- [x] **4.2.** Добавить эндпоинт `POST /api/v1/admin/users/:id/restore` для сброса `deletedAt: null` и активации (`isActive: true`).
- [x] **4.3.** Добавить соответствующие unit-тесты.
- [x] **4.4.** Перегенерировать OpenAPI спецификацию и клиент `@packages/api`.

---

### 5. Журнал аудита действий администраторов (Audit Log)

> [!NOTE]
> Задача отклонена пользователем (не требуется в рамках текущей итерации).

---

### 6. Оптимизация полнотекстового поиска через Trigram GIN-индексы

#### 🛑 Описание проблемы
- **Файл:** [`apps/api/src/modules/admin/services/admin-users.service.ts`](../../apps/api/src/modules/admin/services/admin-users.service.ts#L68-L74)
- **Суть:** Запрос `where.OR = [{ email: { contains: search } }, ...]` генерирует SQL с `ILIKE '%...%'`, что приводит к полному сканированию таблицы при каждом поисковом запросе администратора.
- **Риск / Impact:** Высокая нагрузка на CPU и дисковую подсистему PostgreSQL при росте базы.

#### 🛠️ План решения
- [x] **6.1.** Создать SQL-миграцию:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" ON "users" USING gin ("email" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "users_username_trgm_idx" ON "users" USING gin ("username" gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS "users_display_name_trgm_idx" ON "users" USING gin ("displayName" gin_trgm_ops);
  ```
- [x] **6.2.** Миграция подготовлена в `apps/api/prisma/migrations/20260914160000_add_trigram_search_indices`.
