# Работа с динамическими `className`

## Назначение

Для формирования динамических `className` в `apps/web` используется общая функция `cn` из UI-пакета:

```ts
import { cn } from "@packages/ui/lib/utils";
```

Не следует устанавливать или импортировать `clsx` и `tailwind-merge` непосредственно в `apps/web`, если они нужны только для формирования `className`.

---

## Где находится реализация

Функция `cn` является частью общего UI-пакета:

```text
packages/ui/src/lib/utils.ts
```

Реализация:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Пакет `@packages/ui` инкапсулирует используемые для работы с классами зависимости:

```text
apps/web
    │
    └── @packages/ui/lib/utils
                │
                └── cn()
                    ├── clsx
                    └── tailwind-merge
```

Поэтому код приложения должен зависеть от публичного API `@packages/ui`, а не от деталей его реализации.

---

## Принцип использования

Для динамических классов используем `cn`:

```tsx
className={cn(
  "flex",
  directionClasses[direction],
  justifyClasses[justify],
  gap && gapClasses[gap],
  max && "w-full",
  className,
)}
```

Для полностью статических классов `cn` не требуется:

```tsx
<div className="flex items-center gap-4" />
```

---

## Почему используется `cn`, а не `clsx`

`cn` объединяет две возможности:

- `clsx` — формирует строку классов и поддерживает условные классы;
- `tailwind-merge` — разрешает конфликты между Tailwind CSS-классами.

Например:

```tsx
cn("px-4", "px-8");
```

вернёт итоговый набор классов без конфликтующих Tailwind-значений.

Это особенно важно для переиспользуемых компонентов, принимающих внешний `className`.

---

## Когда использовать

Используем `cn`, когда:

- классы зависят от props или состояния;
- есть условные Tailwind-классы;
- компонент имеет несколько UI-вариантов;
- внутренние классы компонента объединяются с внешним `className`.

Например:

```tsx
<div
  className={cn(
    "flex items-center",
    isActive && "font-medium",
    disabled && "opacity-50",
    className,
  )}
/>
```

---

## Когда НЕ использовать

Для статического набора классов:

```tsx
// ❌ избыточно
<div className={cn("flex", "items-center", "gap-4")} />

// ✅
<div className="flex items-center gap-4" />
```

---

## Пример: Stack

`Stack` использует `cn` для формирования layout-классов:

```text
apps/web/src/shared/ui/Stack/Stack.tsx
```

Импорт:

```ts
import { cn } from "@packages/ui/lib/utils";
```

Использование:

```tsx
className={cn(
  "flex",
  directionClasses[direction],
  justifyClasses[justify],
  alignClasses[align],
  gap && gapClasses[gap],
  max && "w-full",
  wrap && "flex-wrap",
  className,
)}
```

Для ограниченного набора вариантов используются типы и mapping-объекты:

```ts
const directionClasses: Record<StackDirection, string> = {
  row: "flex-row",
  column: "flex-col",
};
```

---

## Зависимости

`clsx` и `tailwind-merge` являются внутренними зависимостями `@packages/ui`:

```text
packages/ui/package.json
```

Если `apps/web` использует только `cn`, добавлять следующие зависимости в `apps/web/package.json` не требуется:

```text
clsx
tailwind-merge
```

Не следует импортировать:

```ts
// ❌
import clsx from "clsx";

// ❌
import { clsx } from "@packages/ui";
```

Используем:

```ts
// ✅
import { cn } from "@packages/ui/lib/utils";
```

---

## Правила

- Для динамических `className` в `apps/web` использовать `cn` из `@packages/ui/lib/utils`.
- Не устанавливать `clsx` или `tailwind-merge` в `apps/web`, если они нужны только для формирования классов через `cn`.
- Для статических классов использовать обычный `className`.
- Не использовать ручную конкатенацию строк для сложных условных классов.
- Не переносить бизнес-логику в формирование CSS-классов.
- Ограниченные варианты компонентов описывать типами и mapping-объектами.
- Перед добавлением UI-утилиты или UI-зависимости проверять, не предоставляет ли её уже `@packages/ui`.
