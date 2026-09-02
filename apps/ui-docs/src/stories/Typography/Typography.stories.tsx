import { Link, Typography } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Typography для Storybook.
 */
const meta = {
  title: "Components/Typography",
  component: Typography,
  subcomponents: {
    "Typography.H1": Typography.H1,
    "Typography.H2": Typography.H2,
    "Typography.H3": Typography.H3,
    "Typography.H4": Typography.H4,
    "Typography.P": Typography.P,
    "Typography.Lead": Typography.Lead,
    "Typography.Large": Typography.Large,
    "Typography.Small": Typography.Small,
    "Typography.Muted": Typography.Muted,
    "Typography.Code": Typography.Code,
    "Typography.Blockquote": Typography.Blockquote,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Typography** — система типографики

Набор стандартизированных текстовых элементов (\`H1\`, \`H2\`, \`H3\`, \`H4\`, \`P\`, \`Lead\`, \`Large\`, \`Small\`, \`Muted\`, \`Code\`, \`Blockquote\`) для создания гармоничной и читаемой иерархии текста в интерфейсе.

---

### **Установка и импорт**
\`\`\`tsx
import { Typography } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Typography.H1>Платформа AI-собеседований</Typography.H1>
<Typography.Lead>Подготовьтесь к техническим секциям с персональным AI-интервьюером.</Typography.Lead>
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
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "lead",
        "large",
        "small",
        "muted",
        "code",
        "blockquote",
      ],
      description: "Вариант типографического оформления.",
      table: {
        type: {
          summary:
            '"h1" | "h2" | "h3" | "h4" | "p" | "lead" | "large" | "small" | "muted" | "code" | "blockquote"',
        },
        defaultValue: { summary: '"p"' },
      },
    },
    asChild: {
      control: "boolean",
      description: "Использовать дочерний элемент как слот (Slot).",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    children: {
      control: "text",
      description: "Текстовое содержимое или дочерний элемент.",
      table: { type: { summary: "ReactNode" } },
    },
  },
  args: {
    variant: "p",
    asChild: false,
    children:
      "Платформа подготовки к техническим собеседованиям нового поколения.",
  },
} satisfies Meta<typeof Typography>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Интерактивный типографический элемент.
 */
export const Default: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <Typography {...args} />
    </div>
  ),
};

/**
 * Использование с паттерном asChild (например, для стилизации ссылок).
 */
export const AsChildLink: Story = {
  render: () => (
    <div className="space-y-2">
      <Typography asChild variant="lead">
        <Link
          href="/tasks"
          variant="default"
          onClick={(e: { preventDefault: () => void }) => e.preventDefault()}
        >
          Перейти к каталогу задач по алгоритмам ➔
        </Link>
      </Typography>
    </div>
  ),
};

/**
 * Полная иерархия всех элементов типографики.
 */
export const AllElements: Story = {
  render: () => (
    <div className="space-y-6 w-[560px] max-w-full text-left">
      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          H1 — Главный заголовок страницы
        </span>
        <Typography.H1>Собеседование по System Design</Typography.H1>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          H2 — Заголовок секции
        </span>
        <Typography.H2>Архитектура распределенных очередей</Typography.H2>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          H3 — Подзаголовок блока
        </span>
        <Typography.H3>
          Гарантии доставки сообщений (At-least-once)
        </Typography.H3>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          H4 — Малый заголовок
        </span>
        <Typography.H4>Конфигурация репликации брокера</Typography.H4>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Lead — Вводный абзац
        </span>
        <Typography.Lead>
          В этом сценарии вы проектируете систему обмена сообщениями с
          пропускной способностью более 1 миллиона RPS.
        </Typography.Lead>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          P — Обычный текст
        </span>
        <Typography.P>
          Используйте партиционирование топиков для горизонтального
          масштабирования консьюмеров.
        </Typography.P>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Code — Инлайн-код
        </span>
        <div>
          Запустите команду <Typography.Code>pnpm test:e2e</Typography.Code> для
          валидации решения.
        </div>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Blockquote — Цитата
        </span>
        <Typography.Blockquote>
          «Преждевременная оптимизация — корень всех зол в программировании.» —
          Дональд Кнут
        </Typography.Blockquote>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          Muted / Small — Вспомогательный текст
        </span>
        <Typography.Muted>
          Результаты сессии автоматически сохранены в базе знаний платформы.
        </Typography.Muted>
      </div>
    </div>
  ),
};
