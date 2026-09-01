import { Avatar } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "UI/Avatar",
  component: Avatar,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description:
        "Размер аватара. `sm` — 24px; `md` — 32px (по умолчанию); `lg` — 56px.",
      table: {
        type: { summary: '"sm" | "md" | "lg"' },
        defaultValue: { summary: '"md"' },
      },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы для корневого элемента аватара.",
      table: { type: { summary: "string" } },
    },
    children: {
      control: false,
      description:
        "Дочерние элементы. Используйте sub-компоненты: " +
        "`Avatar.Image` — изображение пользователя; " +
        "`Avatar.Fallback` — запасной контент (инициалы), " +
        "отображаемый пока Avatar.Image загружается или недоступно.",
      table: { type: { summary: "ReactNode" } },
    },
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Avatar (root) stories ───

export const WithImage: Story = {
  name: "Avatar / With Image",
  args: { size: "md" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Image src="https://github.com/shadcn.png" alt="User avatar" />
      <Avatar.Fallback>CN</Avatar.Fallback>
    </Avatar>
  ),
};

export const FallbackOnly: Story = {
  name: "Avatar / Fallback Only",
  args: { size: "md" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Fallback>AB</Avatar.Fallback>
    </Avatar>
  ),
};

export const Small: Story = {
  name: "Avatar / Small",
  args: { size: "sm" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Fallback>SM</Avatar.Fallback>
    </Avatar>
  ),
};

export const Large: Story = {
  name: "Avatar / Large",
  args: { size: "lg" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Fallback>LG</Avatar.Fallback>
    </Avatar>
  ),
};

export const AllSizes: Story = {
  name: "Avatar / All Sizes",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <Avatar size="sm">
        <Avatar.Image src="https://github.com/shadcn.png" alt="SM" />
        <Avatar.Fallback>SM</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Image src="https://github.com/shadcn.png" alt="MD" />
        <Avatar.Fallback>MD</Avatar.Fallback>
      </Avatar>
      <Avatar size="lg">
        <Avatar.Image src="https://github.com/shadcn.png" alt="LG" />
        <Avatar.Fallback>LG</Avatar.Fallback>
      </Avatar>
    </div>
  ),
};

// ─────────────────────────────────────────────
// Avatar.Image — отдельная история
// ─────────────────────────────────────────────

export const AvatarImageStory: Story = {
  name: "Avatar.Image",
  parameters: {
    docs: {
      description: {
        story:
          "`Avatar.Image` — изображение аватара (`aspect-square size-full object-cover`). " +
          "Принимает все стандартные пропсы `<img>`: `src`, `alt`, `className`, `onLoad`, `onError`.\n\n" +
          "Пока изображение загружается или если URL недоступен — автоматически показывается `Avatar.Fallback`.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: 12 }}>
      <Avatar size="lg">
        <Avatar.Image src="https://github.com/shadcn.png" alt="Shadcn" />
        <Avatar.Fallback>SC</Avatar.Fallback>
      </Avatar>
      <Avatar size="lg">
        <Avatar.Image src="https://invalid-url.xyz/nope.jpg" alt="Broken" />
        <Avatar.Fallback>?</Avatar.Fallback>
      </Avatar>
    </div>
  ),
};

// ─────────────────────────────────────────────
// Avatar.Fallback — отдельная история
// ─────────────────────────────────────────────

export const AvatarFallbackStory: Story = {
  name: "Avatar.Fallback",
  parameters: {
    docs: {
      description: {
        story:
          "`Avatar.Fallback` — запасной контент, отображаемый когда `Avatar.Image` " +
          "не загрузилось или отсутствует. Обычно содержит инициалы (1–2 буквы).\n\n" +
          "Принимает все стандартные пропсы `<span>`: `children`, `className`, `style`. " +
          "Базовый стиль: `bg-muted`, `font-medium`, `rounded-full`.",
      },
    },
  },
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Avatar size="sm">
        <Avatar.Fallback>А</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Fallback>ИИ</Avatar.Fallback>
      </Avatar>
      <Avatar size="lg">
        <Avatar.Fallback>МК</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Fallback className="bg-blue-100 text-blue-700">
          AI
        </Avatar.Fallback>
      </Avatar>
    </div>
  ),
};
