# @packages/api

Канонический типизированный API-клиент, DTO-модели и хуки **TanStack Query v5** для фронтенд-приложений монорепозитория **MockInterviewAI**.

Пакет генерируется автоматически из спецификации OpenAPI бэкенда (`apps/api`) с помощью **Orval** и предоставляет слой внедрения HTTP-транспорта (**Dependency Inversion**).

---

## Архитектурные границы монорепозитория

В соответствии с **Принципом I Конституции** проекта:
> `packages/*` НЕ ДОЛЖНЫ импортировать код из `apps/*`.

Пакет `@packages/api` является общей библиотекой и полностью изолирован от деталей окружения клиентских приложений:
- `@packages/api` **не знает** о существовании `apps/web`, `apps/landing` или других потребителей.
- В пакете **нет** прямой привязки к `sessionStorage`, `localStorage`, cookie-файлам или роутингу Next.js.
- Связывание клиентского рантайма с API-клиентом осуществляется через паттерн **Dependency Inversion (DI)**: пакет предоставляет контракт `HttpTransport` и функцию `setHttpTransport()`, с помощью которой клиентское приложение передаёт собственный авторизованный транспорт.

---

## Архитектура сквозного потока сетевого запроса

```
┌─────────────────────────────────────────────────────────┐
│                      apps/web                           │
│  UI Компонент / Экран                                   │
│      │                                                  │
│      ▼                                                  │
│  Хук useSessionsControllerFindAll() / useMutation()     │
└──────────────────────────┬──────────────────────────────┘
                           │ вызов
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    @packages/api                        │
│  API-функция: sessionsControllerFindAll()                │
│      │                                                  │
│      ▼                                                  │
│  Мутатор: customInstance(url, options)                  │
│      │ нормализует параметры в RequestConfig            │
│      ▼                                                  │
│  activeTransport: HttpTransport                         │
└──────────────────────────┬──────────────────────────────┘
                           │ делегирование через DI
                           ▼
┌─────────────────────────────────────────────────────────┐
│              apps/web (Runtime Transport)               │
│  createBaseFetchTransport() -> baseFetch()              │
│      │ Добавляет Authorization: Bearer <token>          │
│      │ credentials: "include" (HttpOnly cookie)         │
│      │ При 401: POST /api/v1/auth/refresh и повтор      │
│      ▼                                                  │
│  Нативный fetch()                                       │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTP сетевой запрос
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  apps/api (NestJS)                      │
│  REST API: /api/v1/...                                  │
└─────────────────────────────────────────────────────────┘
```

---

## Состав публичного API (`src/index.ts`)

Пакет экспортирует три основные категории сущностей:

```typescript
// 1. Сгенерированные эндпоинты и TanStack Query v5 хуки
export * from "./generated/endpoints/auth/auth";
export * from "./generated/endpoints/health/health";
export * from "./generated/endpoints/profile/profile";
export * from "./generated/endpoints/realtime/realtime";
export * from "./generated/endpoints/sessions/sessions";
export * from "./generated/endpoints/users/users";

// 2. Сгенерированные DTO модели
export * from "./generated/model";

// 3. HTTP Transport & Dependency Inversion
export {
  customInstance,
  defaultFetchTransport,
  getHttpTransport,
  type HttpTransport,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "./transport";
```

---

## Использование сгенерированного API-клиента

### 1. Хуки запросов (Queries)

Для получения данных используйте сгенерированные хуки `use*Controller*`:

```tsx
import {
  useSessionsControllerFindAll,
  getSessionsControllerFindAllQueryKey,
} from "@packages/api";

export function SessionsList() {
  const { data, isLoading, error } = useSessionsControllerFindAll();

  if (isLoading) return <div>Загрузка сессий...</div>;
  if (error) return <div>Ошибка загрузки</div>;

  return (
    <ul>
      {data?.map((session) => (
        <li key={session.id}>{session.title}</li>
      ))}
    </ul>
  );
}
```

### 2. Хуки мутаций (Mutations)

Для создания, обновления и удаления данных используйте хуки мутаций:

```tsx
import {
  useAuthControllerLogin,
  type LoginDto,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export function LoginForm() {
  const queryClient = useQueryClient();
  const loginMutation = useAuthControllerLogin({
    mutation: {
      onSuccess: (data) => {
        console.log("Успешный вход, токен получен:", data.accessToken);
      },
      onError: (error) => {
        console.error("Ошибка авторизации:", error);
      },
    },
  });

  const onSubmit = (formData: LoginDto) => {
    loginMutation.mutate({ data: formData });
  };

  return (
    <button
      onClick={() => onSubmit({ email: "user@example.com", password: "Password123!" })}
      disabled={loginMutation.isPending}
    >
      {loginMutation.isPending ? "Вход..." : "Войти"}
    </button>
  );
}
```

### 3. Прямой вызов API-функций (без React Hooks)

В серверных компонентах, скриптах, middleware или утилитах можно вызывать базовые API-функции напрямую:

```typescript
import {
  sessionsControllerFindAll,
  realtimeControllerGetTicket,
} from "@packages/api";

// Прямой вызов возвращает Promise с типизированным ответом
const sessions = await sessionsControllerFindAll();

// Вызов с передачей параметров
const ticketResponse = await realtimeControllerGetTicket({
  sessionId: "session-uuid",
});
```

### 4. Фабрики ключей и опций (Query Keys & Options)

Orval автоматически генерирует функции для получения ключей запросов и параметров мутаций, что исключает ошибки инвалидации кэша:

```typescript
import {
  getSessionsControllerFindAllQueryKey,
  getSessionsControllerFindAllQueryOptions,
  getSessionsControllerCreateSessionMutationKey,
} from "@packages/api";

// Инвалидация списка сессий в QueryClient
queryClient.invalidateQueries({
  queryKey: getSessionsControllerFindAllQueryKey(),
});
```

---

## DTO и модели данных (`generated/model`)

Все DTO генерируются из схем OpenAPI NestJS бэкенда и доступны по прямому импорту:

```typescript
import type {
  LoginDto,
  RegisterDto,
  UserProfileDto,
  CreateSessionResponseDto,
  TicketDto,
  TicketResponseDto,
  ChangePasswordDto,
  ValidationErrorResponseDto,
} from "@packages/api";
```

Ручное создание параллельных интерфейсов запросов/ответов **запрещено** (Принцип III Конституции).

---

## Сетевой транспорт и Dependency Inversion (`src/transport.ts`)

### Контракт `RequestConfig`

Конфигурация HTTP-запроса, формируемая мутатором Orval:

```typescript
export interface RequestConfig {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  responseType?: string;
}
```

### Интерфейс `HttpTransport`

Сигнатура сетевой функции-исполнителя:

```typescript
export type HttpTransport = <T>(config: RequestConfig) => Promise<T>;
```

### Fallback-транспорт `defaultFetchTransport`

Пакет включает автономный транспорт по умолчанию на базе нативного `fetch`:
- Автоматически сериализует `params` в query-строку URL.
- Поддерживает `FormData` (не перезаписывает `Content-Type`).
- Сериализует объекты `data` в JSON (`Content-Type: application/json`).
- При статусе ошибки формирует исключение `Error & { status: number; data: unknown }`.
- При HTTP 204 No Content возвращает `undefined`.
- Парсит JSON при соответствующем `content-type` заголовке.
- Используется по умолчанию в тестах и headless-скриптах без необходимости настройки DI.

### Мутатор Orval `customInstance`

Функция `customInstance` настроена в `orval.config.ts` в секции `override.mutator`:
- Поддерживает вызов со структурированным объектом `RequestConfig`.
- Поддерживает стандартный двухпараметрический вызов Orval `(url, options)`.
- Нормализует заголовки (экземпляр `Headers`, массив пар `[key, value]`, плоский объект).
- Делегирует выполнение текущему активному транспорту `activeTransport`.

### Функции управления DI

```typescript
// Установить активный транспорт (вызывается веб-приложением при старте)
setHttpTransport(myCustomTransport);

// Получить текущий транспорт
const currentTransport = getHttpTransport();

// Сбросить транспорт на defaultFetchTransport (для изоляции тестов)
resetHttpTransport();
```

---

## Интеграция с `apps/web`

В веб-приложении `apps/web` связь со сгенерированным клиентом настраивается в слое `shared/api`:

1. **Адаптер транспорта** ([apps/web/src/shared/api/init.ts](./apps/web/src/shared/api/init.ts)):
   Функция `createBaseFetchTransport()` преобразует вызовы `RequestConfig` в вызовы авторизованного `baseFetch`:
   ```typescript
   export function createBaseFetchTransport(): HttpTransport {
     return async <T>(config: RequestConfig): Promise<T> => {
       // сериализация URL и параметров
       return baseFetch<T>(fullUrl, { method, headers, body, signal });
     };
   }
   ```
2. **Идемпотентная инициализация**:
   ```typescript
   export function initApiTransport(): void {
     if (initialized) return;
     setHttpTransport(createBaseFetchTransport());
     initialized = true;
   }
   ```
3. **Автоматический запуск**:
   `initApiTransport()` гарантированно вызывается при загрузке:
   - Модуля `apps/web/src/shared/api/index.ts`.
   - Провайдера `QueryProvider` ([apps/web/src/shared/api/client.tsx](./apps/web/src/shared/api/client.tsx)).
4. **Авторизационный цикл `baseFetch`** ([apps/web/src/shared/api/base.ts](./apps/web/src/shared/api/base.ts)):
   - Добавляет `Authorization: Bearer <sessionStorage.accessToken>` ко всем запросам.
   - Передает `credentials: "include"` для работы с HttpOnly cookie.
   - При ответе **HTTP 401** пытается автоматически обновить токен через `POST /api/v1/auth/refresh`.
   - Если рефреш успешен — обновляет токен в `sessionStorage` и прозрачно повторяет исходный запрос.
   - Если рефреш не удался — очищает `sessionStorage` и редиректит пользователя на `/login`.

---

## Пайплайн кодогенерации (OpenAPI → Orval)

Конфигурация генератора находится в [orval.config.ts](./orval.config.ts):

- **Input**: `./apps/api/openapi/openapi.json`.
- **Output Target**: `./packages/api/src/generated/endpoints` (`mode: "tags-split"`).
- **Output Schemas**: `./packages/api/src/generated/model`.
- **Client**: `react-query` (TanStack Query v5).
- **Mutator**: `./packages/api/src/transport.ts` (`customInstance`).

### Команды генерации

Выполняются из корня монорепозитория:

```bash
# 1. Сгенерировать спецификацию OpenAPI из бэкенда (без Docker):
pnpm run generate:api

# 2. Сгенерировать клиент Orval в packages/api:
pnpm run generate:client

# 3. Выполнить полный цикл кодогенерации (OpenAPI + Orval):
pnpm run codegen

# 4. Проверить в CI, что сгенерированный клиент актуален и синхронизирован:
pnpm run codegen:check
```

---

## Правила работы со сгенерированными файлами (`src/generated/**`)

1. **СТРОГИЙ ЗАПРЕТ РУЧНЫХ ПРАВОК**: файлы в каталоге `packages/api/src/generated/**` генерируются автоматически. Любые ручные изменения будут перезаписаны при следующем запуске генератора.
2. **Как вносить изменения в API**:
   - Измените контроллер, DTO или аннотации Swagger в `apps/api` (или схему в `@packages/dto`).
   - Запустите команду полного цикла: `pnpm run codegen`.
   - Проверьте изменения типов в веб-приложении: `pnpm --filter web build` или `pnpm typecheck`.
3. **Игнорирование в Biome**: каталог `packages/api/src/generated` исключён из форматирования и линтинга в [biome.json](./biome.json) (`!packages/api/src/generated`), чтобы предотвратить конфликты стилей генератора.
4. **Фиксация в Git**: сгенерированные файлы коммитятся в репозиторий. Команда `pnpm run codegen:check` в CI гарантирует отсутствие расхождений между схемой OpenAPI и кодом клиента.

---

## Тестирование и сборка пакета

Из корня монорепозитория:

```bash
# Запуск юнит-тестов транспорта (Vitest)
pnpm --filter @packages/api test

# Проверка типов TypeScript (tsc --noEmit)
pnpm --filter @packages/api typecheck

# Сборка пакета в dist/ (tsc)
pnpm --filter @packages/api build

# Проверка кода линтером Biome
pnpm --filter @packages/api lint
```

### Изоляция модульных тестов

При написании тестов, мокирующих транспорт через `setHttpTransport()`, всегда вызывайте `resetHttpTransport()` в хуках очистки:

```typescript
import { beforeEach, afterEach } from "vitest";
import { setHttpTransport, resetHttpTransport } from "@packages/api";

beforeEach(() => {
  resetHttpTransport();
});

afterEach(() => {
  resetHttpTransport();
});
```
Это предотвращает утечку моков между тестами и гарантирует чистое состояние рантайма.
