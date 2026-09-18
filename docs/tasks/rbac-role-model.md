# feat(api): Динамическая ролевая модель доступа (Bitmask RBAC & PBAC)

## Статус: Реализовано ✅

## Контекст и цели
Необходимо обеспечить масштабируемую динамическую ролевую модель доступа (Role-Based & Permission-Based Access Control) с компактной числовой битовой маской прав (**BigInt Bitmask**).

### Ключевые требования:
1. **Числовая битовая маска разрешений (BigInt Bitmask)**:
   - Каждое право — степень двойки (`1n << 0n`, `1n << 1n` ...).
   - Хранение в PostgreSQL как `BIGINT` в таблице `roles`.
   - В JWT передается компактный числовой `permissions` (например `0`, `1`, `31`), поле `role` исключено из JWT токена для минимизации размера и соблюдения принципа PBAC.
2. **Изоморфные утилиты прав в `@packages/utils`**:
   - Функции `hasPermission`, `hasAllPermissions`, `hasAnyPermission`, `combinePermissions`, `decodePermissions` (расшифровка маски в массив человекочитаемых slug для UI).
   - Типы и константы (`SystemRole`, `SystemPermission`, `PermissionSlugs`) в `@packages/types`.
3. **Бэкенд-авторизация (`apps/api`)**:
   - Декоратор `@RequirePermissions(...)` для защиты эндпоинтов.
   - Глобальный `RolesGuard` с Superuser bypass для флага `ADMINISTRATOR`.
   - Профиль пользователя `GET /api/v1/profile/me` возвращает имя роли и битовую маску `permissions`.
4. **CLI-управление (`seed:admin`)**:
   - Скрипт `pnpm --filter api seed:admin -- --email <email> [--password <password>]` для назначения/создания администратора с флагом `ADMINISTRATOR` и сбросом сессий в Redis.
5. **E2E и Unit тестирование**:
   - Полное покрытие E2E тестами в `apps/api/test/rbac.e2e-spec.ts`.
   - Unit-тесты для функций битовых масок в `@packages/utils`.

---

## Архитектура

### 1. Битовые права (`@packages/types` и `@packages/utils`)
```typescript
export const SystemPermission = {
  NONE: 0n,
  ADMINISTRATOR: 1n << 0n, // 1n (Суперпользователь / Superuser bypass)
  USERS_READ: 1n << 1n,    // 2n (Просмотр пользователей)
  USERS_MANAGE: 1n << 2n,  // 4n (Управление пользователями)
  ROLES_MANAGE: 1n << 3n,  // 8n (Управление ролями)
  SESSIONS_MANAGE: 1n << 4n, // 16n (Управление сессиями)
  ANALYTICS_READ: 1n << 5n,  // 32n (Просмотр аналитики)
} as const;
```

### 2. Схема базы данных
- `Role`: `id`, `slug`, `name`, `description`, `permissions BigInt @default(0)`, `isSystem Boolean`.
- `Permission`: `id`, `slug`, `name`, `description`, `bitValue BigInt`, `createdAt`.
- `User`: `roleId` relation на `Role`.
