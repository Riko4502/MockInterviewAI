import { Button } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "success",
        "ghost",
        "destructive",
        "link",
      ],
      description:
        "Визуальный стиль кнопки. `default` — основная; `outline` — контурная; `secondary` — вторичная; `success` — успех; `ghost` — прозрачная; `destructive` — опасное действие; `link` — ссылка.",
      table: {
        type: {
          summary:
            '"default" | "outline" | "secondary" | "success" | "ghost" | "destructive" | "link"',
        },
        defaultValue: { summary: '"default"' },
      },
    },
    size: {
      control: "select",
      options: [
        "default",
        "xs",
        "sm",
        "lg",
        "icon",
        "icon-xs",
        "icon-sm",
        "icon-lg",
      ],
      description:
        "Размер кнопки. `default` — 32px; `xs` — 24px; `sm` — 28px; `lg` — 36px. Варианты `icon*` — квадратные кнопки-иконки.",
      table: {
        type: {
          summary:
            '"default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"',
        },
        defaultValue: { summary: '"default"' },
      },
    },
    rounded: {
      control: "select",
      options: ["default", "square", "small"],
      description:
        "Скругление углов. `default` — rounded-md; `square` — без скругления; `small` — минимальное скругление.",
      table: {
        type: { summary: '"default" | "square" | "small"' },
        defaultValue: { summary: '"default"' },
      },
    },
    asChild: {
      control: "boolean",
      description:
        "Заменяет `<button>` дочерним элементом (паттерн Radix `asChild`). Полезно для обёртки ссылок `<a>` или компонентов роутера.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    children: {
      control: "text",
      description: "Содержимое кнопки — текст, иконка или любой JSX.",
      table: { type: { summary: "ReactNode" } },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует кнопку. Снижает прозрачность и отключает события указателя.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    type: {
      control: "select",
      options: ["button", "submit", "reset"],
      description: "HTML-атрибут `type` тега `<button>`.",
      table: {
        type: { summary: '"button" | "submit" | "reset"' },
        defaultValue: { summary: '"button"' },
      },
    },
    onClick: {
      action: "clicked",
      description: "Обработчик клика.",
      table: { type: { summary: "MouseEventHandler<HTMLButtonElement>" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: "Button", variant: "default" },
};

export const Outline: Story = {
  args: { children: "Button", variant: "outline" },
};

export const Secondary: Story = {
  args: { children: "Button", variant: "secondary" },
};

export const Success: Story = {
  args: { children: "Button", variant: "success" },
};

export const Ghost: Story = {
  args: { children: "Button", variant: "ghost" },
};

export const Destructive: Story = {
  args: { children: "Button", variant: "destructive" },
};

export const Link: Story = {
  args: { children: "Button", variant: "link" },
};

export const ExtraSmall: Story = {
  args: { children: "Button", size: "xs" },
};

export const Small: Story = {
  args: { children: "Button", size: "sm" },
};

export const Large: Story = {
  args: { children: "Button", size: "lg" },
};

export const RoundedSquare: Story = {
  args: { children: "Button", rounded: "square" },
};

export const RoundedSmall: Story = {
  args: { children: "Button", rounded: "small" },
};

export const IconOnly: Story = {
  args: { size: "icon" },
  render: (args) => (
    <Button {...args}>
      <PlusIcon />
    </Button>
  ),
};

export const Disabled: Story = {
  args: {
    children: "Button",
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="success">Success</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">LG</Button>
      <Button size="icon">
        <PlusIcon />
      </Button>
      <Button size="icon-xs">
        <PlusIcon />
      </Button>
      <Button size="icon-sm">
        <PlusIcon />
      </Button>
      <Button size="icon-lg">
        <PlusIcon />
      </Button>
    </div>
  ),
};
