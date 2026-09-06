# TanStack Query (Server State)

Для управления серверным состоянием (кэширование, фоновое обновление, оптимистичные обновления) используется **TanStack Query v5**.  
Официальная документация: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)

---

## 1. Где находится инфраструктура TanStack Query?

* **Создание инстанса QueryClient и React Provider:** [apps/web/src/shared/api/client.tsx](./apps/web/src/shared/api/client.tsx) (`QueryProvider`).
* **Подключение в корневой Layout:** [apps/web/src/app/layout.tsx](./apps/web/src/app/layout.tsx).
* **Сгенерированные хуки запросов и мутаций:** `@packages/api` (генерируются Orval автоматически).

---

## 2. Ключи запросов (Query Keys)

Чтобы избежать опечаток и путаницы при инвалидации кэша:

### Вариант А. Сгенерированные фабрики ключей из `@packages/api` (Рекомендуется)
Orval генерирует готовые функции ключей для каждого эндпоинта:
```ts
import {
  getSessionsControllerFindAllQueryKey,
  getProfileControllerGetProfileQueryKey,
} from "@packages/api";

// Возвращает стабильный ключ запроса: ['/api/v1/sessions']
const sessionListKey = getSessionsControllerFindAllQueryKey();
```

### Вариант Б. Доменные фабрики ключей в слое `entities`
Для сложных составных иерархий ключей с клиентскими фильтрами:
```ts
// entities/interview-session/model/query-keys.ts
export const sessionKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionKeys.all, 'list'] as const,
  list: (filters: { status?: string }) => [...sessionKeys.lists(), filters] as const,
  details: () => [...sessionKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
};
```

---

## 3. Пример использования сгенерированных хуков из `@packages/api`

Вместо рукописных функций с вызовом `fetch` используются типизированные хуки из `@packages/api`:

```tsx
// features/create-interview/model/use-create-session.ts
import {
  useSessionsControllerCreateSession,
  getSessionsControllerFindAllQueryKey,
} from "@packages/api";
import { useQueryClient } from "@tanstack/react-query";

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useSessionsControllerCreateSession({
    mutation: {
      onSuccess: () => {
        // Инвалидируем кэш списка сессий для автоматической перезагрузки данных
        queryClient.invalidateQueries({
          queryKey: getSessionsControllerFindAllQueryKey(),
        });
      },
    },
  });
}
```

### Использование хука запроса (Query):

```tsx
// entities/session/ui/SessionList.tsx
import { useSessionsControllerFindAll } from "@packages/api";

export function SessionList() {
  const { data: sessions, isLoading, error } = useSessionsControllerFindAll();

  if (isLoading) return <div>Загрузка списка сессий...</div>;
  if (error) return <div>Ошибка загрузки данных</div>;

  return (
    <ul>
      {sessions?.map((session) => (
        <li key={session.id}>{session.title}</li>
      ))}
    </ul>
  );
}
```

> ❌ **Запрещено:** Сохранять данные, полученные из `useQuery`, в глобальный `Zustand` store. `useQuery` сам по себе является реактивным источником истины.
