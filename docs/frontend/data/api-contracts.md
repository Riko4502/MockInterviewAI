# API Contracts & OpenAPI Workflow

Backend REST API является единственным источником истины для всех контрактов данных.  
Ручное дублирование API-типов и интерфейсов на фронтенде **запрещено**.

---

## 1. 🔄 Практический Workflow обновления контрактов

Когда бэкенд добавляет или изменяет эндпоинты, выполните следующие шаги:

```text
1. Бэкенд обновил Swagger / OpenAPI схему
               │
               ▼
2. Фронтендер запускает генерацию:
   pnpm --filter @packages/api generate
               │
               ▼
3. TypeScript компилятор подсвечивает ошибки:
   pnpm typecheck (все места, где изменились типы)
               │
               ▼
4. Фронтендер обновляет вызовы в коде apps/web
               │
               ▼
5. Коммит изменений вместе со сгенерированным клиентом
               │
               ▼
6. CI проверяет отсутствие расхождений типов
```

---

## 2. Команды для работы с контрактами

```bash
# Генерация API клиента из OpenAPI спецификации
pnpm --filter @packages/api generate

# Сборка пакета API
pnpm --filter @packages/api build
```

## 3. Пакет @packages/api

- **Исходники:** `packages/api/`
- **Схема OpenAPI:** `packages/api/schema/openapi.json`
- **Сгенерированный код:** `packages/api/src/generated.ts` (в `.gitignore`)
- **Использование:** `import type { paths, components } from "@packages/api";`

### Порядок работы

1. Бэкенд обновляет `openapi.json` — кладёт в `packages/api/schema/openapi.json`
2. Фронтенд запускает `pnpm --filter @packages/api generate`
3. TypeScript проверяет типы через `pnpm typecheck`

> ⚠️ `src/generated.ts` не коммитится (`.gitignore`). При CI сборке нужно сначала запустить `generate`, затем `build`.

---

## 3. Маппинг DTO к UI-моделям

Если данные с бэкенда (API DTO) не соответствуют структуре отображения в UI, создавайте чистую функцию-маппер в слое `entities`:

```ts
// entities/interview-session/model/mappers.ts
import type { SessionDto } from '@packages/api';
import type { SessionUiModel } from './types';

export function mapSessionDtoToUi(dto: SessionDto): SessionUiModel {
  return {
    id: dto.id,
    title: dto.title,
    formattedDate: new Date(dto.createdAt).toLocaleDateString('ru-RU'),
    statusLabel: dto.isActive ? 'Идет сейчас' : 'Завершена',
  };
}
```
