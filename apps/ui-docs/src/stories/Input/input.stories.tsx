import { Input } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Input",
  component: Input,
  parameters: {
    layout: "centered",
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
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "text",
    placeholder: "Введите текст",
  },
};

export const Disabled: Story = {
  args: {
    type: "text",
    placeholder: "Недоступно для ввода",
    disabled: true,
  },
};

export const Invalid: Story = {
  args: {
    type: "text",
    placeholder: "Некорректное значение",
    "aria-invalid": true,
  },
};
