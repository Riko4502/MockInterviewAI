import { Input, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Label для Storybook.
 */
const meta = {
  title: "Components/Label",
  component: Label,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Label** — текстовая метка поля

Доступная текстовая метка на базе примитива \`@radix-ui/react-label\`. Поддерживает связь с элементами формы по \`htmlFor\`, индикатор обязательного поля (\`required\`), варианты цветов (\`default\`, \`muted\`, \`destructive\`, \`success\`) и размеры (\`sm\`, \`default\`, \`lg\`).

---

### **Установка и импорт**
\`\`\`tsx
import { Label, Input } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "muted", "destructive", "success"],
      description: "Цветовой вариант текста метки.",
      table: {
        type: { summary: '"default" | "muted" | "destructive" | "success"' },
        defaultValue: { summary: '"default"' },
      },
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
      description: "Размер шрифта метки.",
      table: {
        type: { summary: '"sm" | "default" | "lg"' },
        defaultValue: { summary: '"default"' },
      },
    },
    required: {
      control: "boolean",
      description: "Обязательное ли поле (отображение звездочки *).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    children: {
      control: "text",
      description: "Текст метки.",
      table: { type: { summary: "ReactNode" } },
    },
  },
  args: {
    children: "Имя пользователя",
    variant: "default",
    size: "default",
    required: false,
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовая текстовая метка по умолчанию.
 */
export const Default: Story = {
  args: {
    children: "Электронная почта",
  },
};

/**
 * Метка обязательного поля с индикатором (*).
 */
export const Required: Story = {
  args: {
    children: "Пароль",
    required: true,
  },
};

/**
 * Варианты цветов (Default, Muted, Destructive, Success).
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Label variant="default">Стандартная метка (Default)</Label>
      <Label variant="muted">Приглушенная метка (Muted)</Label>
      <Label variant="destructive" required>
        Метка с ошибкой (Destructive)
      </Label>
      <Label variant="success">Успешно заполнено (Success)</Label>
    </div>
  ),
};

/**
 * Использование с полем ввода Input.
 */
export const WithInput: Story = {
  render: () => (
    <div className="space-y-1.5 w-72">
      <Label htmlFor="fullname" required>
        ФИО Кандидата
      </Label>
      <Input id="fullname" placeholder="Иван Иванов" />
    </div>
  ),
};
