import { Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Switch",
  component: Switch,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description:
        "Размер переключателя. `default` — стандартный 32×18px; `sm` — уменьшенный 24×14px.",
      table: {
        type: { summary: '"default" | "sm"' },
        defaultValue: { summary: '"default"' },
      },
    },
    checked: {
      control: "boolean",
      description:
        "Управляемое состояние переключателя (вкл/выкл). Требует `onCheckedChange`.",
      table: { type: { summary: "boolean" } },
    },
    defaultChecked: {
      control: "boolean",
      description: "Неуправляемое начальное состояние переключателя.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует переключатель. Снижает прозрачность и запрещает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onCheckedChange: {
      action: "checkedChange",
      description:
        "Обработчик изменения состояния. Вызывается с новым значением `boolean`.",
      table: { type: { summary: "(checked: boolean) => void" } },
    },
    "aria-label": {
      control: "text",
      description:
        "Доступное название переключателя. Обязательно, если нет видимого текста рядом.",
      table: { type: { summary: "string" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { "aria-label": "Переключатель" } };

export const Checked: Story = {
  args: { defaultChecked: true, "aria-label": "Переключатель" },
};

export const Disabled: Story = {
  args: { disabled: true, "aria-label": "Переключатель" },
};

export const DisabledChecked: Story = {
  args: { disabled: true, defaultChecked: true, "aria-label": "Переключатель" },
};
