# PostgreSQL и Prisma ORM (`apps/api`)

В качестве основной реляционной базы данных используется **PostgreSQL 16**, а для работы со схемой и типизированных запросов — **Prisma ORM 7** с официальным драйвером-адаптером `@prisma/adapter-pg`.

---

## 1. Схема данных (`prisma/schema.prisma`)

Схема объявляется в файле [`apps/api/prisma/schema.prisma`](../../../apps/api/prisma/schema.prisma):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}
```

### Соглашения по именованию:
* **Модели в Prisma**: PascalCase в единственном числе (`User`, `InterviewSession`, `Feedback`).
* **Таблицы в PostgreSQL**: snake_case во множественном числе через `@@map("users")`, `@@map("interview_sessions")`.
* **Колонки в PostgreSQL**: camelCase или явный `@map("column_name")`.
* **Первичные ключи**: UUID v4 (`@id @default(uuid()) @db.Uuid`).

---

## 2. Команды миграций и кодогенерации

Все команды запускаются через `pnpm` из корня или с фильтром:

```bash
# Генерация типизированного Prisma Client
pnpm --filter api run db:generate

# Создание новой миграции в процессе разработки (интерактивно)
pnpm --filter api run db:migrate:dev

# Применение существующих миграций (для CI/CD и продакшена)
pnpm --filter api run db:migrate:deploy
```

---

## 3. Использование `PrismaService` в NestJS

`PrismaService` зарегистрирован как `@Global()` модуль и инжектируется в любые сервисы приложения:

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, createdAt: true }, // не возвращаем passwordHash!
    });
  }
}
```

### 🔒 Безопасность запросов:
* **Никогда не возвращайте `passwordHash`** в ответах контроллеров. Используйте явный `select` при выборке данных пользователя.
* Используйте `this.prisma.$transaction([...])` для операций, затрагивающих несколько связанных таблиц.
