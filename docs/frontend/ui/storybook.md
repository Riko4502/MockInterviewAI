# Storybook Guidelines

Storybook используется для изолированной разработки, тестирования и визуальной документации компонентов `@packages/ui`.  
Располагается в отдельном workspace-приложении `apps/ui-docs`.  
Официальная документация: [https://storybook.js.org](https://storybook.js.org)

---

## 1. Правила создания Stories

* **Где размещаются:** файлы историй размещаются в `apps/ui-docs/src/stories/` в подпапке соответствующего компонента:
  ```text
  apps/ui-docs/src/stories/
  └── Button/
      └── button.stories.tsx
  ```
* **Когда Story обязательна:**
  - Для **всех** кастомных компонентов, добавляемых в `@packages/ui`.
  - При модификации вариантов существующего компонента (например, добавлен новый `variant` или `size`).

---

## 2. Пример оформления Story

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
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
      options: ['default', 'sm', 'lg', 'icon'],
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

## 3. Запуск и сборка Storybook

```bash
# Локальный запуск Storybook dev-сервера (порт 6006)
pnpm storybook
# или
pnpm --filter ui-docs storybook

# Сборка статического Storybook для проверки в CI
pnpm build:storybook
# или
pnpm --filter ui-docs build-storybook
```
