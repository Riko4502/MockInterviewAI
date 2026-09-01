# API Contracts, Swagger & Кодогенерация (@packages/api)

Backend REST API является **единственным источником истины** для всех контрактов данных.  
Ручное дублирование API-типов, эндпоинтов и интерфейсов на фронтенде **запрещено**.

Все TypeScript-типы генерируются автоматически из схемы OpenAPI (Swagger), формируемой бэкендом.

---

## ⚡ Быстрый старт: Обновление API-типов для фронтенда

Когда бэкенд добавил новые эндпоинты или изменил существующие, выполните **2 шага** в терминале:

### Шаг 1. Сгенерировать актуальную схему Swagger / OpenAPI из бэкенда
Выполните в корне репозитория:
```bash
pnpm run generate:api
```
* **Что делает:** Поднимает NestJS в изолированном контексте (с моками провайдеров) и сохраняет актуальную спецификацию в:
  - `apps/api/openapi/openapi.json`
  - `apps/api/openapi/openapi.yaml`
* 💡 **Важно:** Для этой команды **НЕ требуется запущенный Docker, PostgreSQL или Redis**. Генерация работает полностью автономно на любой ОС (Windows, macOS, Linux).

---

### Шаг 2. Сгенерировать TypeScript-типы клиента
Выполните команду генерации типов:
```bash
pnpm --filter @packages/api generate
```
* **Что делает:** Читает `apps/api/openapi/openapi.json` и с помощью `openapi-typescript` формирует готовые типизированные интерфейсы в `packages/api/src/generated.ts`.

---

### Шаг 3. Проверить изменения типов в веб-приложении
```bash
pnpm --filter web build
```
Если на бэкенде изменился контракт (например, поле стало обязательным или переименовалось), компилятор TypeScript сразу покажет точные строки кода в `apps/web`, где требуется исправление.

---

## 💻 Как использовать сгенерированные типы в коде (`apps/web`)

Все сгенерированные типы доступны через общий пакет `@packages/api`.

### 1. Извлечение типов запросов и ответов

```ts
import type { paths, components } from "@packages/api";

// 1. Тело запроса (RequestBody)
export type RegisterRequestBody =
  paths["/api/v1/auth/register"]["post"]["requestBody"]["content"]["application/json"];

export type LoginRequestBody =
  paths["/api/v1/auth/login"]["post"]["requestBody"]["content"]["application/json"];

// 2. Успешный ответ сервера (Response 200/201)
export type UserProfileResponse =
  paths["/api/v1/profile/me"]["get"]["responses"]["200"]["content"]["application/json"];

// 3. Параметры маршрута (Path Parameters)
export type UserPathParam =
  paths["/api/v1/users/{idOrUsername}"]["get"]["parameters"]["path"];

// 4. Ошибка валидации (400)
export type ValidationErrorResponse =
  paths["/api/v1/auth/login"]["post"]["responses"]["400"]["content"]["application/json"];
```

---

### 2. Пример использования в TanStack Query (хуки данных)

```ts
// features/auth/api/use-login-mutation.ts
import { useMutation } from "@tanstack/react-query";
import type { paths } from "@packages/api";

type LoginPayload = paths["/api/v1/auth/login"]["post"]["requestBody"]["content"]["application/json"];
type LoginResponse = paths["/api/v1/auth/login"]["post"]["responses"]["200"]["content"]["application/json"];

async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Ошибка авторизации");
  }

  return response.json();
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: loginUser,
  });
}
```

---

### 3. Маппинг DTO к UI-моделям (в слое `entities`)

Не прокидывайте сырые DTO из API глубоко в компоненты представления. Если данные с бэкенда требуют форматирования для UI, создавайте чистую функцию-маппер:

```ts
// entities/user/model/mappers.ts
import type { paths } from "@packages/api";
import type { UserUiModel } from "./types";

type UserDto = paths["/api/v1/profile/me"]["get"]["responses"]["200"]["content"]["application/json"];

export function mapUserDtoToUi(dto: UserDto): UserUiModel {
  return {
    id: dto.id,
    fullName: `${dto.firstName} ${dto.lastName}`.trim() || dto.username,
    avatarUrl: dto.avatarUrl ?? "/images/default-avatar.png",
    registeredAt: new Date(dto.createdAt).toLocaleDateString("ru-RU"),
  };
}
```

---

## 🌐 Интерактивный Swagger UI в браузере

Когда бэкенд запущен локально (`pnpm dev` или `pnpm dev:api`), интерактивная документация с возможностью тестирования запросов доступна по адресам:

* 🖥️ **Swagger UI:** [http://localhost:3001/docs](http://localhost:3001/docs)
* 📄 **OpenAPI JSON схема:** [http://localhost:3001/docs-json](http://localhost:3001/docs-json)

*(Обратите внимание: Swagger доступен именно по маршруту `/docs`, а не `/api/docs`).*

---

## 🚨 Troubleshooting (Частые вопросы)

### 1. IDE (VS Code / WebStorm) не подхватывает новые типы после генерации
* **Причина:** TypeScript-сервер в IDE закэшировал предыдущее состояние файлов.
* **Решение:** В VS Code нажмите `Ctrl + Shift + P` (или `Cmd + Shift + P` на macOS) и выберите **`TypeScript: Restart TS Server`**.

### 2. При запуске `pnpm dev:api` возникает ошибка Docker (`dockerDesktopLinuxEngine`)
* **Причина:** Скрипт запуска бэкенда `dev:api` пытается автоматически поднять PostgreSQL и Redis через Docker Compose.
* **Решение:** Запустите Docker Desktop. Если вам нужна только верстка фронтенда и вызов генерации типов — запускайте только `pnpm dev:web`, Docker для него не требуется.

### 3. Файл `packages/api/src/generated.ts` отсутствует или подсвечен серым
* **Причина:** Файл добавлен в `.gitignore`, чтобы предотвратить конфликты слияния в Git.
* **Решение:** Просто выполните `pnpm --filter @packages/api generate` — файл будет создан локально.
