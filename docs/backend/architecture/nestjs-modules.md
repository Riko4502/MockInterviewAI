# Архитектура NestJS API (`apps/api`)

API построено на базе фреймворка **NestJS 11** и следует принципам модульной архитектуры, разделения слоев (Separation of Concerns) и внедрения зависимостей (Dependency Injection).

---

## 1. Структура слоев в модуле

Каждый функциональный домен API оформляется в виде изолированного NestJS модуля:

```text
apps/api/src/modules/<module-name>/
├── <module-name>.controller.ts    # HTTP-слой: эндпоинты, DTO валидация, статус-коды
├── <module-name>.service.ts       # Бизнес-логика: правила, оркестрация, транзакции
├── <module-name>.module.ts        # Определение модуля (imports, providers, exports)
├── <module-name>.constants.ts     # Локальные константы модуля
├── guards/                        # Защитные гарды модуля (авторизация, рейт-лимиты)
└── services/                      # Дополнительные вспомогательные сервисы
```

---

## 2. Разделение обязанностей между слоями

### 1. Контроллер (`Controller`) — Тонкий HTTP слой
* **Обязанности:** Прием запроса, валидация DTO через `ZodValidationPipe`, вызов соответствующего метода сервиса, установка cookies/заголовков и возврат HTTP-ответа.
* 🚫 **Запрещено:** Писать бизнес-логику, вызывать `PrismaService` напрямую, хэшировать пароли в контроллере.

```typescript
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string }> {
    const result = await this.authService.register(dto);
    // установка cookies и возврат accessToken
    return { accessToken: result.accessToken };
  }
}
```

### 2. Сервис (`Service`) — Слой бизнес-логики
* **Обязанности:** Основная бизнес-логика, хэширование (Argon2id), взаимодействие с БД через `PrismaService`, работа с Redis и S3, выброс типизированных `HttpException`.

```typescript
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(data: { email: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data });
  }
}
```

---

## 3. Валидация входных данных через Zod (`@packages/dto`)

Вместо `class-validator` проект использует **Zod** и общий пакет `@packages/dto`. Это гарантирует 100% синхронизацию типов и схем валидации между Frontend и Backend:

1. Схема описывается в `packages/dto/src/<domain>/<name>.schema.ts`:
   ```typescript
   export const registerSchema = z.object({
     email: z.string().email().transform(v => v.toLowerCase().trim()),
     password: z.string().min(8).max(100),
   });
   export type RegisterDto = z.infer<typeof registerSchema>;
   ```
2. В контроллере применяется глобальный или локальный `ZodValidationPipe`:
   ```typescript
   @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto
   ```

---

## 4. Глобальные фильтры и пайпы (`src/common`)

* **`HttpExceptionFilter`**: перехватывает все исключения и нормализует формат ошибки. В продакшене маскирует внутренние детали БД и стектрейсы.
* **`ZodValidationPipe`**: преобразует ошибки валидации Zod в `400 Bad Request` с понятным описанием проблемных полей.
* **`OriginCheckGuard`**: точный матч `Origin`/`Referer` против `ALLOWED_ORIGINS` (защита от CSRF); допускает self-origin; применяется глобально и на `POST /realtime/ticket`.
* **`AccessTokenGuard`**: глобальный async-гард авторизации — верифицирует JWT access и выполняет live-проверку в Redis (сессия `auth:session:{sid}` активна, `EXISTS`).
