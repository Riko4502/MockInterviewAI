import { Link } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Link для Storybook.
 */
const meta = {
  title: "Components/Link",
  component: Link,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Link** — интерактивная навигационная ссылка

Универсальный компонент ссылки для навигации между страницами, внешних ресурсов и контекстных переходов. Поддерживает стилистические темы (\`default\`, \`muted\`, \`destructive\`, \`subtle\`), режимы подчеркивания (\`always\`, \`hover\`, \`none\`), индикацию внешних ссылок (\`external\`, \`showExternalIcon\`) и полиморфизм через \`asChild\` для бесшовной интеграции с Next.js или React Router.

---

### **Установка и импорт**
\`\`\`tsx
import { Link } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Link href="/dashboard" variant="default">
  Перейти в личный кабинет
</Link>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "muted", "destructive", "subtle"],
      description: "Цветовой стиль оформления ссылки.",
      table: {
        type: { summary: '"default" | "muted" | "destructive" | "subtle"' },
        defaultValue: { summary: '"default"' },
      },
    },
    underline: {
      control: "select",
      options: ["always", "hover", "none"],
      description: "Режим отображения линии подчеркивания.",
      table: {
        type: { summary: '"always" | "hover" | "none"' },
        defaultValue: { summary: '"hover"' },
      },
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
      description: "Размер шрифта ссылки.",
      table: {
        type: { summary: '"sm" | "default" | "lg"' },
        defaultValue: { summary: '"default"' },
      },
    },
    external: {
      control: "boolean",
      description:
        'Открывать во внешней вкладке (`target="_blank"` и `rel="noopener noreferrer"`).',
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showExternalIcon: {
      control: "boolean",
      description: "Отображать ли иконку стрелки перехода справа от текста.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует клик по ссылке и отключает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    asChild: {
      control: "boolean",
      description:
        "Заменять корневой тег `<a>` дочерним элементом (Radix asChild).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    children: {
      control: "text",
      description: "Текст или содержимое ссылки.",
      table: { type: { summary: "ReactNode" } },
    },
    href: {
      control: "text",
      description: "URL-адрес перехода.",
      table: { type: { summary: "string" } },
    },
  },
  args: {
    href: "/sessions",
    children: "Список сессий собеседований",
    variant: "default",
    underline: "hover",
    size: "default",
    external: false,
    showExternalIcon: false,
    disabled: false,
  },
} satisfies Meta<typeof Link>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Интерактивная ссылка по умолчанию (изменяйте свойства в Controls).
 */
export const Default: Story = {
  render: (args) => <Link {...args} />,
};

/**
 * Все стилистические варианты (Variants).
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Link href="/analytics" variant="default">
        Основная ссылка (Default)
      </Link>
      <Link href="/privacy" variant="muted">
        Приглушенная ссылка (Muted)
      </Link>
      <Link href="/account" variant="subtle">
        Нейтральная ссылка (Subtle)
      </Link>
      <Link href="/delete-account" variant="destructive">
        Опасное действие (Destructive)
      </Link>
    </div>
  ),
};

/**
 * Режимы подчеркивания (Underline modes).
 */
export const UnderlineModes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Link href="/docs" underline="hover">
        Подчеркивание только при наведении (Hover — по умолчанию)
      </Link>
      <Link href="/docs" underline="always">
        Постоянное подчеркивание (Always)
      </Link>
      <Link href="/docs" underline="none">
        Без подчеркивания (None)
      </Link>
    </div>
  ),
};

/**
 * Внешняя ссылка с индикатором перехода.
 */
export const ExternalLink: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Link
        href="https://github.com"
        external
        showExternalIcon
        variant="default"
      >
        Перейти в GitHub репозиторий
      </Link>
    </div>
  ),
};

/**
 * Размеры ссылок (Sizes).
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-baseline gap-4">
      <Link href="/terms" size="sm">
        Small (12px)
      </Link>
      <Link href="/terms" size="default">
        Default (14px)
      </Link>
      <Link href="/terms" size="lg">
        Large (16px)
      </Link>
    </div>
  ),
};

/**
 * Заблокированная ссылка (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Link href="/locked-feature" disabled>
        Недоступная ссылка (Disabled)
      </Link>
    </div>
  ),
};
