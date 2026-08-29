# Storybook Guidelines

Storybook используется для изолированной разработки, тестирования и визуальной документации UI-компонентов ([`@packages/ui`](./packages/ui)) и каталога иконок ([`@packages/icons`](./packages/icons)).  
Располагается в отдельном workspace-приложении [`apps/ui-docs`](./apps/ui-docs).  
Официальная документация: [https://storybook.js.org](https://storybook.js.org)

---

## 🔗 Быстрые ссылки

* 🏠 [Главный README проекта](../README.md)
* 🎨 [Документация Frontend](./docs/frontend/README.md)
* 🧩 [UI Kit & Design System](./docs/frontend/ui/ui-kit.md)
* 🖌️ [Стилизация и Tailwind CSS](./docs/frontend/ui/styling.md)

---

## 1. Структура и разделы Storybook

| Раздел в Storybook | Описание | Путь к историям |
| :--- | :--- | :--- |
| **`UI/Icons`** | Полный каталог всех 75 иконок `@packages/icons` с поиском, фильтрацией и копированием по клику | [`apps/ui-docs/src/stories/Icons/icons.stories.tsx`](./apps/ui-docs/src/stories/Icons/icons.stories.tsx) |
| **`Components/*`** | Базовые интерактивные компоненты (`Button`, `Card`, `Form`, `Table` и др.) | `apps/ui-docs/src/stories/<ComponentName>/` |
| **`UI/*`** | Презентационные атомы (`Avatar`, `Badge`, `Input` и др.) | `apps/ui-docs/src/stories/<AtomName>/` |

---

## 2. Правила создания Stories

* **Где размещаются:** файлы историй размещаются в `apps/ui-docs/src/stories/` в подпапке соответствующего компонента:
  ```text
  apps/ui-docs/src/stories/
  ├── Button/
  │   └── button.stories.tsx
  ├── Icons/
  │   └── icons.stories.tsx
  └── ...
  ```
* **Когда Story обязательна:**
  - Для **всех** кастомных компонентов, добавляемых в `@packages/ui`.
  - При модификации вариантов существующего компонента (например, добавлен новый `variant` или `size`).
  - При добавлении новых графических библиотек или дизайн-токенов.

---

## 3. Пример оформления Story

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@packages/ui';

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Нажми меня',
    variant: 'default',
  },
};

export const Destructive: Story = {
  args: {
    children: 'Удалить сессию',
    variant: 'destructive',
  },
};
```

---

## 4. Запуск и сборка Storybook

```bash
# Локальный запуск Storybook dev-сервера (порт 6006)
pnpm dev:storybook
# или
pnpm storybook
# или
pnpm --filter ui-docs dev

# Сборка статического Storybook для проверки в CI / продакшене
pnpm build:storybook
# или
pnpm --filter ui-docs build
```
