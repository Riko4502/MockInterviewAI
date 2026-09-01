import { Kbd } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Kbd для Storybook.
 */
const meta = {
  title: "Components/Kbd",
  component: Kbd,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Kbd** — обозначение клавиш клавиатуры

Компонент для отображения клавиш и их сочетаний в интерфейсе (например, подсказки горячих клавиш вида «Ctrl + K»). Использует семантический HTML-тег \`<kbd>\` для корректной доступности (a11y).

---

### **Установка и импорт**
\`\`\`tsx
import { Kbd } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Размер компонента.",
      table: {
        type: { summary: '"default" | "sm"' },
        defaultValue: { summary: '"default"' },
      },
    },
    children: {
      control: "text",
      description: "Содержимое — название клавиши.",
      table: { type: { summary: "ReactNode" } },
    },
  },
  args: {
    size: "default",
    children: "Ctrl",
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная отдельная клавиша.
 */
export const Default: Story = {};

/**
 * Сочетание клавиш (например, для подсказки горячей клавиши поиска).
 */
export const Combination: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Kbd>Ctrl</Kbd>
      <span className="text-xs text-muted-foreground">+</span>
      <Kbd>K</Kbd>
    </div>
  ),
};

/**
 * Уменьшенный размер — например, внутри компактных элементов интерфейса.
 */
export const Small: Story = {
  args: {
    size: "sm",
    children: "Esc",
  },
};
