import { Textarea } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
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
