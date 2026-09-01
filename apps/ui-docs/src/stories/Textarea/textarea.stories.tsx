import { Label, Textarea } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Textarea для Storybook.
 */
const meta = {
  title: "Components/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Textarea** — многострочное поле ввода

Компонент для ввода развернутого текста (описание задачи, текст ответа кандидата, AI-фидбэк, системный промпт). Поддерживает состояния валидации (\`aria-invalid\`) и блокировки (\`disabled\`).

---

### **Установка и импорт**
\`\`\`tsx
import { Textarea, Label } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<div className="space-y-1.5 w-96">
  <Label htmlFor="feedback">Отзыв AI-интервьюера</Label>
  <Textarea id="feedback" placeholder="Введите подробный отзыв..." />
</div>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    placeholder: {
      control: "text",
      description: "Текст подсказки, отображаемый при пустом значении.",
      table: { type: { summary: "string" } },
    },
    value: {
      control: "text",
      description: "Управляемое значение поля.",
      table: { type: { summary: "string" } },
    },
    defaultValue: {
      control: "text",
      description: "Неуправляемое начальное значение поля.",
      table: { type: { summary: "string" } },
    },
    rows: {
      control: "number",
      description: "Количество видимых строк.",
      table: { type: { summary: "number" } },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует поле ввода.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    "aria-invalid": {
      control: "boolean",
      description: "Обозначает поле как невалидное (красная рамка).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартное многострочное поле ввода.
 */
export const Default: Story = {
  args: {
    placeholder: "Опишите ваш опыт работы с микросервисной архитектурой...",
    disabled: false,
  },
  render: (args) => (
    <div className="w-96">
      <Textarea {...args} />
    </div>
  ),
};

/**
 * Поле ввода с меткой Label и вспомогательным текстом.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1.5 w-96">
      <Label htmlFor="system-prompt">Системные инструкции для AI</Label>
      <Textarea
        id="system-prompt"
        defaultValue="Вы опытный техлид. Оцените ответы кандидата по критериям Clean Architecture и SOLID."
        rows={4}
      />
      <span className="text-xs text-muted-foreground">
        Максимум 2000 символов.
      </span>
    </div>
  ),
};

/**
 * Ошибка валидации (`aria-invalid={true}`).
 */
export const InvalidState: Story = {
  render: () => (
    <div className="space-y-1.5 w-96">
      <Label htmlFor="err-solution" className="text-destructive">
        Решение задачи
      </Label>
      <Textarea
        id="err-solution"
        defaultValue=""
        aria-invalid="true"
        placeholder="Вставьте код решения..."
      />
      <span className="text-xs text-destructive">
        Поле обязательно для заполнения перед отправкой на проверку.
      </span>
    </div>
  ),
};

/**
 * Заблокированное поле ввода (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-96">
      <Textarea
        disabled
        defaultValue="Текст заблокированного ответа кандидата (только для чтения)."
      />
    </div>
  ),
};
