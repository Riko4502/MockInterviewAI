# Стандарты разработки и Качество кода Backend

Данный документ описывает правила написания серверного кода, форматирования, обработки ошибок, логирования и тестирования.

---

## 1. Стиль кода и Линтинг

* **TypeScript / NestJS**:
  - Для проверки и автоформатирования используется **Biome** (`apps/api/biome.json`).
  - Проверка: `pnpm --filter api lint`.
  - Запрещен `any` (используйте `unknown` с type guard или явные типы).
  - Все методы сервисов и контроллеров должны иметь явные типы возвращаемых значений (`Promise<User>`, `Promise<{ accessToken: string }>`).
* **Go (`apps/realtime`)**:
  - Для проверки используется `golangci-lint` (`apps/realtime/.golangci.yml`).
  - Проверка: `pnpm lint:realtime`.
  - Все ошибки `error` обязаны явно проверяться (`if err != nil`).

---

## 2. Обработка ошибок (Error Handling)

### В NestJS (`apps/api`):
* Для всех ожидаемых клиентских ошибок выбрасывайте встроенные NestJS исключения:
  - `BadRequestException` (ошибка валидации)
  - `UnauthorizedException` (неверные учетные данные или истекший токен)
  - `ForbiddenException` (недостаточно прав)
  - `NotFoundException` (сущность не найдена)
  - `ConflictException` (дубликат email, сессия уже занята)
* Глобальный `HttpExceptionFilter` автоматически перехватывает ошибки и форматирует их в единую структуру:
  ```json
  {
    "statusCode": 400,
    "message": "Validation failed",
    "errors": [
      { "field": "email", "message": "Invalid email address" }
    ],
    "timestamp": "2026-08-23T20:00:00.000Z"
  }
  ```

---

## 3. Логирование

* Используйте встроенный NestJS `Logger`:
  ```typescript
  private readonly logger = new Logger(AuthService.name);
  
  this.logger.log(`User registered: ${user.id}`);
  this.logger.warn(`Failed login attempt for email: ${email}`);
  this.logger.error(`Database connection failed: ${err.message}`, err.stack);
  ```
* 🚫 **Строгий запрет:** Никогда не логируйте пароли, refresh-токены, номера кредитных карт или персональные данные в открытом виде.

---

## 4. Тестирование

### Unit-тесты:
* Каждый сервис и контроллер должен иметь сопутствующий `.spec.ts` файл рядом с исходником:
  - `auth.service.spec.ts`
  - `auth.controller.spec.ts`
* Все внешние зависимости (Prisma, Redis, HTTP клиенты) в unit-тестах **мокаются** (mocking).

### Запуск тестов:
```bash
# Запуск тестов API (Jest)
pnpm --filter api test

# Запуск тестов Go сервиса
pnpm test:realtime

# Запуск всех тестов монорепозитория
pnpm test
```
