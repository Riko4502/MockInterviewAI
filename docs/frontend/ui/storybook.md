# Storybook Guidelines

Storybook используется для изолированной разработки, тестирования и визуальной документации компонентов `@packages/ui`.  
Официальная документация: [https://storybook.js.org](https://storybook.js.org)

---

## 1. Правила создания Stories

* **Где размещаются:** файл истории создается **рядом с компонентом**:
  ```text
  packages/ui/src/components/
  └── button/
      ├── button.tsx
      └── button.stories.tsx
  ```
* **Когда Story обязательна:**
  - Для **всех** кастомных компонентов, добавляемых в `@packages/ui`.
  - При модификации вариантов существующего компонента (например, добавлен новый `variant` или `size`).

---

## 2. Пример оформления Story

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

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

## 3. Запуск и сборка Storybook

```bash
# Локальный запуск Storybook dev-сервера (порт 6006)
pnpm --filter @packages/ui storybook

# Сборка статического Storybook для проверки в CI
pnpm --filter @packages/ui build-storybook
```
