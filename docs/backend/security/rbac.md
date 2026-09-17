# Динамическая ролевая модель доступа (Bitmask RBAC & PBAC)

В платформе MockInterviewAI реализована масштабируемая высокопроизводительная модель разграничения прав доступа на основе **числовой битовой маски (BigInt Bitmask / Permissions Bitfield)**.

---

## 1. Концепция и преимущества

- **Компактность JWT**: Вместо передачи тяжелого строкового массива прав, в токене передается компактное число `permissions: 31` (экономия сетевого трафика на каждом HTTP-запросе). Поле `role` исключено из JWT — авторизация выполняется строго по атомарным правам (PBAC).
- **Мгновенная проверка прав (`O(1)`)**: Проверка прав на уровне процессора через побитовое `AND` (`(userPermissions & required) === required`).
- **Суперпользователь (ADMINISTRATOR)**: Специальный бит `SystemPermission.ADMINISTRATOR = 1n` автоматически открывает доступ ко всем защищенным эндпоинтам (Superuser bypass).
- **Изоморфные утилиты**: Универсальные функции проверки и расшифровки прав находятся в `@packages/utils` и могут использоваться как в NestJS бэкенде, так и в React/Next.js на клиенте.
- **Динамическое управление**: Роли и битовые маски хранятся в PostgreSQL (`Role.permissions`), что позволяет создавать новые роли и настраивать права через UI в будущем.

---

## 2. Системные битовые права (`@packages/types`)

```typescript
export const SystemPermission = {
  NONE: 0n,
  /** Суперпользователь: автоматически обходит любые проверки прав */
  ADMINISTRATOR: 1n << 0n,   // 1n (0b000001)
  USERS_READ: 1n << 1n,      // 2n (0b000010) - Просмотр пользователей
  USERS_MANAGE: 1n << 2n,    // 4n (0b000100) - Управление пользователями
  ROLES_MANAGE: 1n << 3n,    // 8n (0b001000) - Управление ролями и правами
  SESSIONS_MANAGE: 1n << 4n, // 16n (0b010000) - Управление сессиями интервью
  ANALYTICS_READ: 1n << 5n,  // 32n (0b100000) - Просмотр аналитики

  /** Пресет: все базовые права */
  ALL: (1n << 6n) - 1n, // 63n
} as const;
```

---

## 3. Изоморфные утилиты (`@packages/utils`)

Пакет `@packages/utils` предоставляет функции для работы с правами:

| Функция | Описание |
| :--- | :--- |
| `hasPermission(userBitmask, permission)` | Проверяет наличие права с учетом флага `ADMINISTRATOR`. |
| `hasAllPermissions(userBitmask, ...perms)` | Проверяет наличие **всех** указанных прав (AND). |
| `hasAnyPermission(userBitmask, ...perms)` | Проверяет наличие **хотя бы одного** права (OR). |
| `combinePermissions(...perms)` | Объединяет набор прав в единую битовую маску. |
| `decodePermissions(userBitmask)` | **Расшифровывает** числовую маску в массив строковых слагов `["administrator", "users:read", ...]` для отображения в UI и отладки. |
| `toBigIntBitmask(val)` | Безопасно приводит `bigint`, `string`, `number` к `bigint`. |

### Пример расшифровки в UI (Frontend):
```typescript
import { decodePermissions, hasPermission } from "@packages/utils";
import { SystemPermission } from "@packages/types";

// Проверка права на клиенте:
const canManageUsers = hasPermission(user.permissions, SystemPermission.USERS_MANAGE);

// Расшифровка списка прав для отображения в личном кабинете:
const permissionList = decodePermissions(user.permissions);
// => ["users:read", "sessions:manage"]
```

---

## 4. Защита эндпоинтов в NestJS

### Декоратор `@RequirePermissions`

```typescript
import { Controller, Delete, Param } from "@nestjs/common";
import { SystemPermission } from "@packages/types";
import { RequirePermissions } from "src/common/decorators/permissions.decorator";

@Controller("admin/users")
export class AdminUsersController {
  @Delete(":id")
  @RequirePermissions(SystemPermission.USERS_MANAGE)
  deleteUser(@Param("id") id: string) {
    // Доступно только пользователям с USERS_MANAGE или флагом ADMINISTRATOR
  }
}
```

---

## 5. Схема базы данных (Prisma)

```prisma
model Role {
  id          String   @id @default(uuid()) @db.Uuid
  slug        String   @unique
  name        String
  description String?
  permissions BigInt   @default(0)
  isSystem    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       User[]

  @@map("roles")
}

model Permission {
  id          String   @id @default(uuid()) @db.Uuid
  slug        String   @unique
  name        String
  description String?
  bitValue    BigInt
  createdAt   DateTime @default(now())

  @@map("permissions")
}
```

---

## 6. Управление администраторами через CLI

```bash
# Назначить роль ADMIN с флагом ADMINISTRATOR существующему пользователю:
pnpm --filter api seed:admin -- --email admin@mockinterview.tech

# Создать нового администратора:
pnpm --filter api seed:admin -- --email newadmin@mockinterview.tech --password "SuperSecret123!"
```
