import { Skeleton } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Skeleton для Storybook.
 */
const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Skeleton** — заглушка состояния загрузки

Компонент для отображения "скелетона" контента, пока данные ещё не загружены (вместо аватарки, строки текста, карточки и т.д.). Форма и размер задаются через \`className\` — сам компонент не содержит фиксированных размеров.

---

### **Установка и импорт**
\`\`\`tsx
import { Skeleton } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description:
        "Задаёт форму и размер заглушки (высота, ширина, скругление).",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная прямоугольная заглушка (например, вместо строки текста или карточки).
 */
export const Default: Story = {
  args: {
    className: "h-4 w-64",
  },
};

/**
 * Круглая заглушка — например, вместо аватарки пользователя.
 */
export const Circle: Story = {
  args: {
    className: "size-12 rounded-full",
  },
};

/**
 * Составной пример: заглушка карточки собеседования (аватар + строки текста).
 */
export const CardExample: Story = {
  render: () => (
    <div className="flex items-center gap-4 w-80">
      <Skeleton className="size-12 rounded-full" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ),
};
