# TanStack Query (Server State)

Для управления серверным состоянием (кэширование, фоновое обновление, оптимистичные обновления) используется **TanStack Query v5**.  
Официальная документация: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)

---

## 1. Где находится инфраструктура TanStack Query?

* **Создание инстанса QueryClient:** `apps/web/src/shared/api/query-client.ts`.
* **Подключение React Provider:** `apps/web/src/app/providers/query-provider.tsx`.

---

## 2. Фабрики ключей запросов (Query Keys Factory)

Чтобы избежать опечаток и путаницы при инвалидации кэша, ключи запросов объявляются централизованно внутри соответствующих `entities`:

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

## 3. Пример использования Query и Mutation

```tsx
// features/create-interview/model/use-create-session.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionKeys } from '@/entities/interview-session';
import { createSessionApi } from '../api/create-session-api';

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSessionApi,
    onSuccess: () => {
      // Инвалидируем кэш списка сессий для автоматической перезагрузки данных
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}
```

> ❌ **Запрещено:** Сохранять данные, полученные из `useQuery`, в глобальный `Zustand` store. `useQuery` сам по себе является реактивным источником истины.
