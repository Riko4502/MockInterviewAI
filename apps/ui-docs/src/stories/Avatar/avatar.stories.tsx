import { Avatar } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Avatar для Storybook.
 */
const meta = {
  title: "Components/Avatar",
  component: Avatar,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Avatar** — компонент аватара пользователя

Элемент отображения фотографии профиля кандидата или интервьюера с автоматическим показом фолбэка (текстовых инициалов) при загрузке или отсутствии изображения.

---

### **Установка и импорт**
\`\`\`tsx
import { Avatar } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Avatar size="md">
  <Avatar.Image src="https://github.com/shadcn.png" alt="Алексей Смирнов" />
  <Avatar.Fallback>АС</Avatar.Fallback>
</Avatar>
\`\`\`
`,
      },
    },
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
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Аватар с загруженным изображением и фолбэком.
 */
export const WithImage: Story = {
  args: { size: "md" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Image
        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
        alt="Елена Васильева"
      />
      <Avatar.Fallback>ЕВ</Avatar.Fallback>
    </Avatar>
  ),
};

/**
 * Аватар только с текстовыми инициалами (Fallback).
 */
export const FallbackOnly: Story = {
  args: { size: "md" },
  render: (args) => (
    <Avatar {...args}>
      <Avatar.Fallback>АС</Avatar.Fallback>
    </Avatar>
  ),
};

/**
 * Сравнение размеров аватаров (sm, md, lg).
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar size="sm">
        <Avatar.Fallback>SM</Avatar.Fallback>
      </Avatar>
      <Avatar size="md">
        <Avatar.Fallback>MD</Avatar.Fallback>
      </Avatar>
      <Avatar size="lg">
        <Avatar.Fallback>LG</Avatar.Fallback>
      </Avatar>
    </div>
  ),
};

/**
 * Группа аватаров команды интервьюеров.
 */
export const AvatarGroup: Story = {
  render: () => (
    <div className="flex -space-x-2 overflow-hidden">
      <Avatar size="md" className="ring-2 ring-background">
        <Avatar.Fallback>АС</Avatar.Fallback>
      </Avatar>
      <Avatar size="md" className="ring-2 ring-background">
        <Avatar.Fallback>ЕВ</Avatar.Fallback>
      </Avatar>
      <Avatar size="md" className="ring-2 ring-background">
        <Avatar.Fallback>ДК</Avatar.Fallback>
      </Avatar>
      <Avatar
        size="md"
        className="ring-2 ring-background bg-muted text-muted-foreground font-semibold"
      >
        <Avatar.Fallback>+3</Avatar.Fallback>
      </Avatar>
    </div>
  ),
};
