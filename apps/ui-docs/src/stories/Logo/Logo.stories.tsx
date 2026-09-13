import { Logo } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Logo для Storybook.
 */
const meta = {
  title: "Components/Logo",
  component: Logo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Logo** — официальный брендовый компонент DEVSYNC Interview AI

Единый источник истины для отображения бренда платформы на лендинге, в веб-приложении и витрине компонентов.

---

### **Установка и импорт**
\`\`\`tsx
import { Logo } from "@packages/ui";
\`\`\`

---

### **Базовые примеры использования**
\`\`\`tsx
// Стандартный брендовый логотип (Full / MD)
<Logo href="/" />

// Компактный логотип только с иконкой (для свернутого Sidebar)
<Logo href="/dashboard" variant="icon" size="md" />

// Крупный логотип для экранов авторизации (Login / Register)
<Logo href="/" variant="full" size="lg" />

// Полиморфный рендеринг через Radix UI Slot
<Logo asChild variant="full" size="md">
  <Link href="/dashboard" />
</Logo>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["full", "icon"],
      description:
        "Стилистический вариант. `full` — иконка + текст бренда; `icon` — только графическая иконка бренда с доступным `aria-label`.",
      table: {
        type: { summary: '"full" | "icon"' },
        defaultValue: { summary: '"full"' },
      },
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description:
        "Семантический размер логотипа. `sm` — 32px (16px иконка); `md` — 40px (20px иконка, стандарт); `lg` — 48px (24px иконка, для Auth).",
      table: {
        type: { summary: '"sm" | "md" | "lg"' },
        defaultValue: { summary: '"md"' },
      },
    },
    href: {
      control: "text",
      description: "URL-адрес для перехода при клике на логотип.",
      table: {
        type: { summary: "string" },
        defaultValue: { summary: '"/"' },
      },
    },
    asChild: {
      control: "boolean",
      description:
        "Включает полиморфный рендеринг через Radix UI `Slot`, позволяя оборачивать кастомные ссылки (например, Next.js `<Link>`).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    className: {
      control: "text",
      description: "Дополнительные пользовательские CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
  args: {
    variant: "full",
    size: "md",
    href: "/",
    asChild: false,
  },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Интерактивный логотип по умолчанию (Full, MD).
 */
export const Default: Story = {
  args: {
    variant: "full",
    size: "md",
    href: "/",
  },
  render: (args) => <Logo {...args} />,
};

/**
 * Все размеры полного логотипа (Full: SM, MD, LG).
 */
export const AllSizesFull: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Сравнение размеров полного логотипа: `sm` (32px), `md` (40px, стандарт) и `lg` (48px, экраны входа и регистрации).",
      },
    },
  },
  render: () => (
    <div className="flex flex-col items-start gap-6 p-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-slate-400">
          Size: SM (32px / 16px icon)
        </span>
        <Logo variant="full" size="sm" href="/" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-slate-400">
          Size: MD (40px / 20px icon — Default)
        </span>
        <Logo variant="full" size="md" href="/" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-mono text-slate-400">
          Size: LG (48px / 24px icon — Auth Pages)
        </span>
        <Logo variant="full" size="lg" href="/" />
      </div>
    </div>
  ),
};

/**
 * Все размеры иконочного логотипа (Icon: SM, MD, LG).
 */
export const AllSizesIcon: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Вариант `icon` отображает только фирменную иконку с градиентом и встроенным `aria-label` (идеально для компактного сайдбара).",
      },
    },
  },
  render: () => (
    <div className="flex items-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-mono text-slate-400">SM</span>
        <Logo variant="icon" size="sm" href="/dashboard" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-mono text-slate-400">MD</span>
        <Logo variant="icon" size="md" href="/dashboard" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-mono text-slate-400">LG</span>
        <Logo variant="icon" size="lg" href="/dashboard" />
      </div>
    </div>
  ),
};

/**
 * Полиморфный рендеринг через `asChild`.
 */
export const PolymorphicAsChild: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Демонстрация интеграции с кастомными элементами роутинга без прямой зависимости `@packages/ui` от фреймворка.",
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-4 p-4">
      <Logo asChild variant="full" size="md">
        <a
          href="/dashboard"
          className="border border-violet-500/30 p-3 rounded-xl bg-violet-950/20"
          onClick={(e) => {
            e.preventDefault();
            alert("Custom link clicked!");
          }}
        >
          {/* Logo content automatically injected via Slot */}
        </a>
      </Logo>
    </div>
  ),
};
