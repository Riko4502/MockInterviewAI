# TypeScript Guidelines

Проект использует TypeScript в строгом режиме (**Strict Mode**).

---

## 1. Строгая типизация и запрет `any`

* Использование `any` **запрещено**.
* Если тип данных заранее неизвестен (например, сторонний ответ или пользовательский ввод), используйте `unknown` с последующим сужением типа (**type narrowing**):

```ts
// ❌ НЕПРАВИЛЬНО
function parsePayload(data: any) {
  return data.name;
}

// ✅ ПРАВИЛЬНО
function parsePayload(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data && typeof data.name === 'string') {
    return data.name;
  }
  throw new Error('Invalid payload');
}
```

---

## 2. Экспорт типов

* Всегда используйте ключевое слово `type` при импорте/экспорте типов:
  ```ts
  import type { UserDto } from '@packages/api';
  export type { SessionUiModel } from './types';
  ```
* Выводите типы форм и схем валидации напрямую из Zod с помощью `z.infer<typeof schema>`.
