import { Badge } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "tag",
        "statusSuccess",
        "statusInfo",
        "statusDanger",
        "confirmed",
        "ready",
        "waiting",
      ],
      description:
        "Вариант бейджа. `tag` — обычный тег; `statusSuccess` — успех; `statusInfo` — инфо; `statusDanger` — ошибка; `confirmed` — подтверждено; `ready` — готово; `waiting` — ожидание.",
      table: {
        type: {
          summary:
            '"tag" | "statusSuccess" | "statusInfo" | "statusDanger" | "confirmed" | "ready" | "waiting"',
        },
        defaultValue: { summary: "undefined" },
      },
    },
    children: {
      control: "text",
      description: "Текст или JSX-содержимое внутри бейджа.",
      table: { type: { summary: "ReactNode" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
  args: {
    children: "Badge",
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tag: Story = {
  args: { variant: "tag", children: "Тег" },
};

export const StatusSuccess: Story = {
  args: { variant: "statusSuccess", children: "Успешно" },
};

export const StatusInfo: Story = {
  args: { variant: "statusInfo", children: "Информация" },
};

export const StatusDanger: Story = {
  args: { variant: "statusDanger", children: "Ошибка" },
};

export const Confirmed: Story = {
  args: { variant: "confirmed", children: "Подтверждено" },
};

export const Ready: Story = {
  args: { variant: "ready", children: "Готово" },
};

export const Waiting: Story = {
  args: { variant: "waiting", children: "Ожидание" },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Badge variant="tag">Тег</Badge>
      <Badge variant="statusSuccess">Успешно</Badge>
      <Badge variant="statusInfo">Информация</Badge>
      <Badge variant="statusDanger">Ошибка</Badge>
      <Badge variant="confirmed">Подтверждено</Badge>
      <Badge variant="ready">Готово</Badge>
      <Badge variant="waiting">Ожидание</Badge>
    </div>
  ),
};
