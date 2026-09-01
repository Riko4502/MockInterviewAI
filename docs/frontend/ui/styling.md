# Стилизация и Tailwind CSS

Основным инструментом стилизации является **Tailwind CSS v4**.  
Официальная документация Tailwind: [https://tailwindcss.com/docs/installation/using-vite](https://tailwindcss.com/docs/installation/using-vite)

---

## 1. Организация стилей

* **Дизайн-токены и CSS-переменные:** определены централизованно в `packages/ui/src/styles/globals.css` (цвета `background`, `foreground`, `primary`, `destructive`, радиусы скруглений `radius` и т.д.).
* **Приложения:** подключают стили UI Kit и используют глобальную тему.

---

## 2. Утилиты `@packages/utils` (`cn`, `cva`, `VariantProps`)

Для безопасного объединения Tailwind-классов и управления вариантами компонентов (`cva`) используется пакет `@packages/utils`:

```tsx
import { cn, cva, type VariantProps } from '@packages/utils';

export const cardVariants = cva(
  'p-4 rounded-lg bg-card text-card-foreground border transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border',
        primary: 'border-primary shadow-md',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface CardProps extends VariantProps<typeof cardVariants> {
  className?: string;
  isActive?: boolean;
}

export function Card({ className, variant, isActive }: CardProps) {
  return (
    <div
      className={cn(
        cardVariants({ variant }),
        isActive && 'ring-2 ring-primary',
        className // внешние классы корректно переопределят базовые
      )}
    />
  );
}
```

---

## 3. Правила написания стилей

1. **Не пишите инлайновые стили (`style={{ ... }}`):** используйте классы Tailwind.
2. **Не создавайте кастомные CSS-файлы на каждый компонент:** стилизуйте с помощью Tailwind-классов и CVA из `@packages/utils`.
3. **Используйте семантические токены темы:** вместо жестких цветов (например, `#ffffff` или `bg-blue-500`) используйте `bg-background`, `text-primary`, `bg-muted`. Это гарантирует корректную работу темной и светлой темы.
