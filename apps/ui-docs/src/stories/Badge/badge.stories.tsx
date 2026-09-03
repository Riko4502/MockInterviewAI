import { Badge } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Badge для Storybook.
 */
const meta = {
  title: "Components/Badge",
  component: Badge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Badge** — информационный бейдж / статус

Компактный элемент для отображения статусов сессий (Пройдено, В процессе, Ошибка), тегов технологий и счетчиков.

---

### **Установка и импорт**
\`\`\`tsx
import { Badge } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Badge variant="statusSuccess">Пройдено (92%)</Badge>
\`\`\`
`,
      },
    },
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
        "Вариант бейджа. `tag` — нейтральный тег; `statusSuccess` — успех; `statusInfo` — инфо; `statusDanger` — ошибка; `confirmed` — подтверждено; `ready` — готово; `waiting` — ожидание.",
      table: {
        type: {
          summary:
            '"tag" | "statusSuccess" | "statusInfo" | "statusDanger" | "confirmed" | "ready" | "waiting"',
        },
        defaultValue: { summary: '"tag"' },
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

/**
 * Интерактивный бейдж по умолчанию.
 */
export const Default: Story = {
  args: {
    variant: "statusSuccess",
    children: "Собеседование пройдено",
  },
  render: (args) => <Badge {...args} />,
};

/**
 * Все статусные варианты оформления (Status Badges).
 */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Badge variant="statusSuccess">Пройдено</Badge>
      <Badge variant="statusInfo">В процессе</Badge>
      <Badge variant="statusDanger">Не пройдено</Badge>
      <Badge variant="confirmed">Подтверждено</Badge>
      <Badge variant="ready">Готов к интервью</Badge>
      <Badge variant="waiting">Ожидает проверки</Badge>
      <Badge variant="tag">TypeScript</Badge>
    </div>
  ),
};

/**
 * Теги стека технологий (Tags).
 */
export const TechTags: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="tag">React 19</Badge>
      <Badge variant="tag">Next.js</Badge>
      <Badge variant="tag">TypeScript</Badge>
      <Badge variant="tag">Node.js</Badge>
      <Badge variant="tag">PostgreSQL</Badge>
      <Badge variant="tag">Docker</Badge>
    </div>
  ),
};
