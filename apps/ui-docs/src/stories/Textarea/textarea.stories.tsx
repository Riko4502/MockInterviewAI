import { Textarea } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
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
      description: "Управляемое значение поля (требует `onChange`).",
      table: { type: { summary: "string" } },
    },
    defaultValue: {
      control: "text",
      description: "Неуправляемое начальное значение поля.",
      table: { type: { summary: "string" } },
    },
    rows: {
      control: "number",
      description:
        "Количество видимых строк. По умолчанию минимальная высота задана через CSS (120px).",
      table: { type: { summary: "number" } },
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
    "aria-invalid": {
      control: "boolean",
      description:
        "Обозначает поле как невалидное. Меняет цвет рамки на красный.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onChange: {
      action: "changed",
      description: "Обработчик изменения значения поля.",
      table: { type: { summary: "ChangeEventHandler<HTMLTextAreaElement>" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const Placeholder: Story = {
  args: {
    placeholder: "Введите текст",
  },
};

export const Filled: Story = {
  args: {
    defaultValue: "Краткое описание сессии интервью.",
  },
};

export const Disabled: Story = {
  args: {
    placeholder: "Недоступно для ввода",
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    placeholder: "Некорректное значение",
    "aria-invalid": true,
  },
};

export const LongText: Story = {
  args: {
    defaultValue:
      "Подготовьте рассказ о сложной задаче: контекст, ограничения, выбранный подход, компромиссы и результат. Укажите, как измеряли успех, что бы сделали иначе и какие риски остались. Добавьте детали по стеку, команде и срокам, чтобы интервьюер мог задать уточняющие вопросы по реализации.",
  },
};
