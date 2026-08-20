# @packages/dto

Общий пакет DTO и валидации для монорепы **MockInterviewAI**.

Содержит централизованные схемы валидации (zod), политики паролей и утилиты нормализации данных, используемые в нескольких модулях приложения.

## Зависимости

| Зависимость | Назначение |
|---|---|
| `zod` | Схема валидации входных данных |

## Экспорты

### Регистрация

| Экспорт | Тип | Описание |
|---|---|---|
| `registerSchema` | `z.ZodObject` | Zod-схема валидации данных регистрации |
| `RegisterDto` | `z.infer<typeof registerSchema>` | Типизированный DTO регистрации |
| `normalizeEmail` | `function` | Нормализация email (trim + lowercase) |
| `PASSWORD_MIN_LENGTH` | `number` | Минимальная длина пароля (12) |
| `PASSWORD_MAX_LENGTH` | `number` | Максимальная длина пароля (128) |

## Использование

### Валидация регистрации

```ts
import { registerSchema, type RegisterDto } from "@packages/dto";

const result = registerSchema.safeParse({
  email: "  User@Example.COM  ",
  password: "StrongPassword123!",
});

if (!result.success) {
  // 400 Bad Request — ошибки валидации
  console.error(result.error.issues);
  return;
}

const dto: RegisterDto = result.data;
// dto.email === "user@example.com" (нормализован)
// dto.password === "StrongPassword123!"
```

### Нормализация email

```ts
import { normalizeEmail } from "@packages/dto";

normalizeEmail("  User@Example.COM  ");
// → "user@example.com"
```

### Password Policy

```ts
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from "@packages/dto";

PASSWORD_MIN_LENGTH;  // 12
PASSWORD_MAX_LENGTH;  // 128
```

## Сборка

```bash
# Сборка в dist/
pnpm --filter @packages/dto build

# Проверка типов
pnpm --filter @packages/dto typecheck

# Линтинг
pnpm --filter @packages/dto lint
```

## Структура

```
packages/dto/
├── src/
│   ├── index.ts                    # Экспорты
│   └── auth/
│       ├── email.ts                # normalizeEmail
│       ├── password-policy.ts      # PASSWORD_MIN/MAX_LENGTH
│       └── register.dto.ts         # registerSchema, RegisterDto
├── package.json
├── tsconfig.json
├── biome.json
└── .gitignore
```
