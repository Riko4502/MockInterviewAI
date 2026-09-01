import { Checkbox } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "select",
      options: [true, false, "indeterminate"],
      description:
        'Управляемое состояние чекбокса. `true` — отмечен; `false` — снят; `"indeterminate"` — неопределённое (частичный выбор).',
      table: {
        type: { summary: 'boolean | "indeterminate"' },
      },
    },
    defaultChecked: {
      control: "boolean",
      description: "Неуправляемое начальное состояние чекбокса.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует чекбокс. Снижает прозрачность и запрещает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onCheckedChange: {
      action: "checkedChange",
      description:
        'Обработчик изменения состояния. Вызывается с новым значением `boolean | "indeterminate"`.',
      table: {
        type: { summary: '(checked: boolean | "indeterminate") => void' },
      },
    },
    "aria-label": {
      control: "text",
      description:
        "Доступное название чекбокса. Обязательно, если нет видимого лейбла.",
      table: { type: { summary: "string" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { "aria-label": "Чекбокс" },
};

export const Checked: Story = {
  args: { defaultChecked: true, "aria-label": "Чекбокс" },
};
export const Indeterminate: Story = {
  args: {
    checked: "indeterminate",
    "aria-label": "Чекбокс",
    onCheckedChange: () => {},
  },
};

export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Чекбокс" },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true, "aria-label": "Чекбокс" },
};
