# Стилизация и Tailwind CSS

Основным инструментом стилизации является **Tailwind CSS v4**.  
Официальная документация Tailwind: [https://tailwindcss.com/docs](https://tailwindcss.com/docs)

---

## 1. Организация стилей

* **Дизайн-токены и CSS-переменные:** определены централизованно в `packages/ui/src/styles/globals.css` (цвета `background`, `foreground`, `primary`, `destructive`, радиусы скруглений `radius` и т.д.).
* **Приложения:** подключают стили UI Kit и используют глобальную тему.

---

## 2. Утилита `cn` (Композиция классов)

Для безопасного объединения Tailwind-классов и разрешения конфликтов используется утилита `cn`:

```tsx
import { cn } from '@packages/ui/lib/utils'; // или shared/lib/cn

interface CardProps {
  className?: string;
  isActive?: boolean;
}

export function Card({ className, isActive }: CardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg bg-card text-card-foreground border transition-colors',
        isActive && 'border-primary shadow-md',
        className // внешние классы корректно переопределят базовые
      )}
    />
  );
}
```

---

## 3. Правила написания стилей

1. **Не пишите инлайновые стили (`style={{ ... }}`):** используйте классы Tailwind.
2. **Не создавайте кастомные CSS-файлы на каждый компонент:** стилизуйте с помощью Tailwind-классов и CVA (`class-variance-authority`).
3. **Используйте семантические токены темы:** вместо жестких цветов (например, `#ffffff` или `bg-blue-500`) используйте `bg-background`, `text-primary`, `bg-muted`. Это гарантирует корректную работу темной и светлой темы.
