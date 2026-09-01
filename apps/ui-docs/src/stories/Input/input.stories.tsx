import { Input, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Input для Storybook.
 */
const meta = {
  title: "Components/Input",
  component: Input,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Input** — базовое поле ввода текста

Элемент управления для ввода текстовых, числовых, email и парольных данных. Поддерживает состояния валидации (\`aria-invalid\`), блокировки (\`disabled\`), плейсхолдеры и стилизацию под общую тему.

---

### **Установка и импорт**
\`\`\`tsx
import { Input, Label } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<div className="space-y-1.5 w-72">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="alex@example.com" />
</div>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "email", "password", "number", "search", "tel", "url"],
      description: "HTML-тип поля ввода.",
      table: {
        type: {
          summary:
            '"text" | "email" | "password" | "number" | "search" | "tel" | "url"',
        },
        defaultValue: { summary: '"text"' },
      },
    },
    placeholder: {
      control: "text",
      description: "Текст подсказки, отображаемый при пустом значении.",
      table: { type: { summary: "string" } },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует поле. Снижает прозрачность и отключает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    value: {
      control: "text",
      description: "Управляемое значение поля (требует `onChange`).",
      table: { type: { summary: "string | number" } },
    },
    defaultValue: {
      control: "text",
      description: "Неуправляемое начальное значение поля.",
      table: { type: { summary: "string | number" } },
    },
    onChange: {
      action: "changed",
      description: "Обработчик изменения значения поля.",
      table: { type: { summary: "ChangeEventHandler<HTMLInputElement>" } },
    },
    "aria-invalid": {
      control: "boolean",
      description:
        "Обозначает поле как невалидное. Меняет цвет рамки на красный.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showStepper: {
      control: "boolean",
      description:
        'Отображать ли кастомные стрелки регулирования (stepper) для числового поля (`type="number"`).',
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартное текстовое поле ввода (изменяйте type, placeholder и disabled в Controls).
 */
export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Введите текст...",
    disabled: false,
    showStepper: true,
  },
  render: (args) => (
    <div className="w-80">
      <Input key={args.type} {...args} />
    </div>
  ),
};

/**
 * Числовое поле ввода (type="number") с кастомным степпером и валидацией ввода.
 */
export const NumberInput: Story = {
  render: () => (
    <div className="space-y-1.5 w-80">
      <Label htmlFor="score">Проходной балл (0-100)</Label>
      <Input
        id="score"
        type="number"
        defaultValue="75"
        min={0}
        max={100}
        step={5}
      />
      <span className="text-xs text-muted-foreground">
        Принимает только цифры, поддерживает шаг изменения и клавиши стрелок.
      </span>
    </div>
  ),
};

/**
 * Поле ввода с меткой Label.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-1.5 w-80">
      <Label htmlFor="candidate-name">Имя кандидата</Label>
      <Input id="candidate-name" placeholder="Константин Константинопольский" />
    </div>
  ),
};

/**
 * Состояние ошибки валидации (`aria-invalid={true}`).
 */
export const InvalidState: Story = {
  render: () => (
    <div className="space-y-1.5 w-80">
      <Label htmlFor="err-email" className="text-destructive">
        Email кандидата
      </Label>
      <Input
        id="err-email"
        type="email"
        defaultValue="invalid-email"
        aria-invalid="true"
      />
      <span className="text-xs text-destructive">
        Пожалуйста, укажите корректный адрес электронной почты
      </span>
    </div>
  ),
};

/**
 * Заблокированное поле ввода (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-80">
      <Input disabled defaultValue="read-only-session-token-12345" />
    </div>
  ),
};
