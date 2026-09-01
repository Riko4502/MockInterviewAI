import { Button, Separator } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Separator для Storybook.
 */
const meta = {
  title: "Components/Separator",
  component: Separator,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Separator** — визуальный разделитель

Компонент для логического разделения секций интерфейса, меню и списков. Поддерживает горизонтальную и вертикальную ориентацию, стилистические варианты (\`default\`, \`muted\`, \`dashed\`, \`dotted\`) и текстовую плашку по центру (\`label\`).

---

### **Установка и импорт**
\`\`\`tsx
import { Separator } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Ориентация разделителя (горизонтальная или вертикальная).",
      table: {
        type: { summary: '"horizontal" | "vertical"' },
        defaultValue: { summary: '"horizontal"' },
      },
    },
    variant: {
      control: "select",
      options: ["default", "muted", "dashed", "dotted"],
      description: "Стиль линии разделителя.",
      table: {
        type: { summary: '"default" | "muted" | "dashed" | "dotted"' },
        defaultValue: { summary: '"default"' },
      },
    },
    decorative: {
      control: "boolean",
      description: "Является ли разделитель чисто декоративным (a11y).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    label: {
      control: "text",
      description: "Текстовая подпись по центру горизонтального разделителя.",
      table: { type: { summary: "ReactNode" } },
    },
  },
  args: {
    orientation: "horizontal",
    variant: "default",
    decorative: true,
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный горизонтальный разделитель контента.
 */
export const Horizontal: Story = {
  render: (args) => (
    <div className="w-80 space-y-3">
      <div>
        <h4 className="text-sm font-semibold leading-none">MockInterview AI</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Платформа для подготовки к техническим собеседованиям.
        </p>
      </div>
      <Separator {...args} />
      <div className="flex text-xs text-muted-foreground gap-4">
        <span>Документация</span>
        <span>Тарифы</span>
        <span>Контакты</span>
      </div>
    </div>
  ),
};

/**
 * Разделитель с текстом по центру (например, для форм входа).
 */
export const WithLabel: Story = {
  render: () => (
    <div className="w-80 space-y-3">
      <Button variant="outline" className="w-full">
        Войти через GitHub
      </Button>
      <Separator label="или продолжить с email" variant="muted" />
      <Button className="w-full">Войти с паролем</Button>
    </div>
  ),
};

/**
 * Вертикальный разделитель в панели инструментов.
 */
export const Vertical: Story = {
  render: () => (
    <div className="flex items-center gap-3 h-8 px-3 border rounded-lg bg-card">
      <span className="text-xs font-medium">Главная</span>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-xs font-medium">Собеседования</span>
      <Separator orientation="vertical" className="h-4" />
      <span className="text-xs text-muted-foreground">Настройки</span>
    </div>
  ),
};

/**
 * Стили линий (Dashed & Dotted).
 */
export const LineStyles: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Dashed (пунктир):</span>
        <Separator variant="dashed" />
      </div>
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Dotted (точки):</span>
        <Separator variant="dotted" />
      </div>
    </div>
  ),
};
