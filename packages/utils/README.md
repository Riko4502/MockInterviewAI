# @packages/utils

Пакет общих переиспользуемых утилит для приложений и пакетов монорепозитория.

---

## Экспортируемые функции и типы

### 1. Стилизация и классы
* **`cn(...inputs: ClassValue[]): string`** — безопасное объединение классов с помощью `clsx` и `tailwind-merge`;
* **`cva(base?: ClassValue, config?: Config): (...args) => string`** — создание вариантов стилей компонентов (Class Variance Authority);
* **`cx(...inputs: ClassValue[]): string`** — базовая композиция классов;
* **`type VariantProps<Component>`** — извлечение TypeScript-типов вариантов `cva`.

### 2. Строковые утилиты
* **`normalizeEmail(email: string): string`** — нормализация и валидация email-адресов.

---

## Установка и использование

```tsx
import { cn, cva, type VariantProps } from '@packages/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border bg-background hover:bg-muted',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```
