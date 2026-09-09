# API Contracts, Swagger & Кодогенерация (@packages/api)

Backend REST API (`apps/api`) является **единственным источником истины** для всех контрактов данных.  
Ручное дублирование API-типов, эндпоинтов и интерфейсов на фронтенде **запрещено** (Принцип III Конституции).

Все TypeScript-модели DTO, API-функции и хуки **TanStack Query v5** генерируются автоматически из схемы OpenAPI (Swagger), формируемой бэкендом, с помощью **Orval** в единый общий пакет `@packages/api`.

---

## ⚡ Быстрый старт: Обновление API-контрактов для фронтенда

Когда бэкенд добавил новые эндпоинты или изменил существующие, выполните шаги кодогенерации в терминале:

### Вариант 1: Полный цикл одной командой (Рекомендуется)

Выполните в корне репозитория:
```bash
pnpm run codegen
```
* **Что делает:** Последовательно выполняет `pnpm run generate:api` и `pnpm run generate:client`.

---

### Вариант 2: Пошаговое обновление

#### Шаг 1. Сгенерировать актуальную схему Swagger / OpenAPI из бэкенда
```bash
pnpm run generate:api
```
* **Что делает:** Поднимает NestJS в изолированном контексте (с моками провайдеров) и сохраняет спецификацию в:
  - `apps/api/openapi/openapi.json`
  - `apps/api/openapi/openapi.yaml`
* 💡 **Важно:** Для этой команды **НЕ требуется запущенный Docker, PostgreSQL или Redis**. Генерация работает полностью автономно на любой ОС (Windows, macOS, Linux).

#### Шаг 2. Сгенерировать клиент Orval и хуки TanStack Query v5
```bash
pnpm run generate:client
```
* **Что делает:** Читает `apps/api/openapi/openapi.json`, нарезает эндпоинты по тегам (`mode: "tags-split"`) и генерирует типизированный клиент в:
  - `packages/api/src/generated/endpoints/` (контроллеры, функции, хуки TanStack Query v5, фабрики ключей)
  - `packages/api/src/generated/model/` (DTO и интерфейсы схем)

#### Шаг 3. Проверить изменения типов в веб-приложении
```bash
pnpm --filter web build
# или общая проверка типов:
pnpm typecheck
```
Если на бэкенде изменился контракт (например, поле стало обязательным или переименовалось), компилятор TypeScript сразу покажет точные строки кода в `apps/web`, где требуется исправление.

---

## 💻 Как использовать сгенерированный клиент в коде (`apps/web`)

Все сгенерированные сущности доступны через общий пакет `@packages/api` (или реэкспортируются через `@/shared/api`).

### 1. Использование хуков TanStack Query v5

Хуки мутаций и запросов генерируются Orval автоматически и не требуют ручного написания сетевых вызовов `fetch`:

```tsx
// features/auth/ui/LoginForm.tsx
import { useAuthControllerLogin, type LoginDto } from "@packages/api";

export function LoginForm() {
  const loginMutation = useAuthControllerLogin({
    mutation: {
      onSuccess: (data) => {
        // data типизирован как AccessTokenResponseDto
        console.log("Успешная авторизация:", data.accessToken);
      },
      onError: (error) => {
        console.error("Ошибка входа:", error);
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

### 2. Прямой импорт DTO-моделей

Все типы данных импортируются напрямую из `@packages/api` без устаревшего синтаксиса `paths[...]`:

```ts
import type {
  LoginDto,
  RegisterDto,
  UserProfileDto,
  CreateSessionResponseDto,
  TicketDto,
  TicketResponseDto,
  ValidationErrorResponseDto,
} from "@packages/api";
```

### 3. Запросы данных и фабрики ключей (Query Keys)

Для запросов данных используйте готовые хуки `use*Controller*` и сгенерированные функции фабрик ключей:

```tsx
// entities/session/ui/SessionList.tsx
import {
  useSessionsControllerFindAll,
  getSessionsControllerFindAllQueryKey,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export function SessionList() {
  const queryClient = useQueryClient();
  const { data: sessions, isLoading } = useSessionsControllerFindAll();

  const handleRefresh = () => {
    // Инвалидация кэша через сгенерированную фабрику ключей
    queryClient.invalidateQueries({
      queryKey: getSessionsControllerFindAllQueryKey(),
    });
  };

  if (isLoading) return <div>Загрузка...</div>;

  return (
    <div>
      <button onClick={handleRefresh}>Обновить</button>
      <ul>
        {sessions?.map((s) => (
          <li key={s.id}>{s.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### 4. Маппинг DTO к UI-моделям (в слое `entities`)

Не прокидывайте сетевые DTO из API напрямую в глубокие презентационные компоненты. Преобразуйте сетевые данные в UI-модели на границе слоя `entities`:

```ts
// entities/user/model/mappers.ts
import type { UserProfileDto } from "@packages/api";
import type { UserUiModel } from "./types";

export function mapUserProfileToUi(dto: UserProfileDto): UserUiModel {
  return {
    id: dto.id,
    fullName: `${dto.firstName} ${dto.lastName}`.trim() || dto.username,
    avatarUrl: dto.avatarUrl ?? "/images/default-avatar.png",
    registeredAt: new Date(dto.createdAt).toLocaleDateString("ru-RU"),
  };
}
```

---

## 🔌 Архитектура транспорта и авторизации

Пакет `@packages/api` не зависит от `apps/web` (Принцип I Конституции: `packages/*` не импортируют `apps/*`).

Связывание происходит через **Dependency Inversion**:
1. Все запросы Orval проходят через мутатор `customInstance` в `packages/api/src/transport.ts`.
2. Веб-приложение `apps/web` инициализирует транспорт в `apps/web/src/shared/api/init.ts` через `setHttpTransport()`.
3. `createBaseFetchTransport()` делегирует вызовы авторизованному `baseFetch()` ([apps/web/src/shared/api/base.ts](./apps/web/src/shared/api/base.ts)).
4. `baseFetch` автоматически:
   - Добавляет `Authorization: Bearer <sessionStorage.accessToken>`.
   - Передает `credentials: "include"` для HttpOnly cookies.
   - При ответе **HTTP 401** выполняет авто-ротацию токена через `/api/v1/auth/refresh` и повторяет исходный запрос.
   - При неудаче рефреша сбрасывает сессию и редиректит на `/login`.

---

## 🌐 Интерактивный Swagger UI в браузере

Когда бэкенд запущен локально (`pnpm dev` или `pnpm dev:api`), интерактивная документация доступна по адресам:

* 🖥️ **Swagger UI:** [http://localhost:3001/docs](http://localhost:3001/docs)
* 📄 **OpenAPI JSON схема:** [http://localhost:3001/docs-json](http://localhost:3001/docs-json)

*(Обратите внимание: Swagger доступен именно по маршруту `/docs`, а не `/api/docs`).*

---

## 🚨 Troubleshooting (Частые вопросы)

### 1. IDE (VS Code / WebStorm) не подхватывает новые типы после кодогенерации
* **Причина:** Языковой сервер TypeScript закэшировал предыдущие файлы.
* **Решение:** В VS Code нажмите `Ctrl + Shift + P` (или `Cmd + Shift + P` на macOS) и выберите **`TypeScript: Restart TS Server`**.

### 2. При запуске `pnpm dev:api` возникает ошибка Docker
* **Причина:** Команда запуска бэкенда пытается поднять локальную инфраструктуру через Docker Compose.
* **Решение:** Если вам нужна только генерация контрактов или вёрстка фронтенда — используйте `pnpm run generate:api` и `pnpm dev:web`. Команда `generate:api` **не требует Docker**.

### 3. Можно ли вручную редактировать файлы в `packages/api/src/generated/`?
* **Ответ:** **НЕТ, категорически запрещено.** Все файлы в `packages/api/src/generated/**` генерируются автоматически Orval. Любые ручные изменения будут затёрты при следующем `codegen`. Изменения вносятся в контроллеры бэкенда или схемы `@packages/dto`, после чего запускается `pnpm run codegen`.

### 4. Проверка синхронизации сгенерированного клиента в CI
* Для валидации актуальности сгенерированного кода в CI и локально используется команда:
  ```bash
  pnpm run codegen:check
  ```
  Она выполняет `generate:client` и проверяет через `git diff --exit-code`, что закоммиченные файлы `packages/api/src/generated` совпадают с текущей схемой OpenAPI.
