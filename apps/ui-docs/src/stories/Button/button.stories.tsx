import { PlayIcon, PlusIcon, TrashIcon, WandIcon } from "@packages/icons";
import { Button } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Button для Storybook.
 */
const meta = {
  title: "Components/Button",
  component: Button,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Button** — интерактивный компонент кнопки

Основной элемент интерфейса для выполнения целевых действий, отправки форм, вызова модальных окон и навигации. Поддерживает 7 стилистических вариантов, 8 вариантов размеров, скругления, интеграцию с иконками и состояние загрузки/блокировки.

---

### **Установка и импорт**
\`\`\`tsx
import { Button } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Button variant="default" size="default" onClick={() => console.log("clicked")}>
  Начать собеседование
</Button>
\`\`\`

---

### **Стилистические варианты (\`variant\`)**
* **\`default\`** — основная акцентная кнопка (\`bg-primary\`);
* **\`outline\`** — контурная кнопка (\`border border-border\`);
* **\`secondary\`** — вторичная кнопка (\`bg-secondary\`);
* **\`success\`** — кнопка успешного действия (\`bg-success\`);
* **\`ghost\`** — прозрачная кнопка с подсветкой при наведении;
* **\`destructive\`** — кнопка удаления или критического действия (\`bg-destructive\`);
* **\`link\`** — кнопка в виде ссылки с подчеркиванием при наведении.
`,
      },
    },
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
        "Заменяет `<button>` дочерним элементом (паттерн Radix `asChild`).",
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

/**
 * Интерактивная кнопка по умолчанию (изменяйте свойства в Controls).
 */
export const Default: Story = {
  args: {
    children: "Начать интервью",
    variant: "default",
    size: "default",
    rounded: "default",
    disabled: false,
  },
  render: (args) => <Button {...args} />,
};

/**
 * Кнопка с иконками и AI-действиями.
 */
export const WithIcons: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Кнопки органично сочетаются с векторными иконками из `@packages/icons`.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">
        <PlayIcon size="xs" />
        <span>Запустить тест</span>
      </Button>
      <Button variant="outline">
        <WandIcon size="xs" />
        <span>AI Анализ</span>
      </Button>
      <Button variant="destructive" size="sm">
        <TrashIcon size="xs" />
        <span>Удалить</span>
      </Button>
      <Button variant="secondary" size="icon">
        <PlusIcon size="xs" />
      </Button>
    </div>
  ),
};

/**
 * Все стилистические варианты (Variants).
 */
export const AllVariants: Story = {
  parameters: {
    docs: {
      description: {
        story: "Сравнение всех 7 стилистических вариантов оформления кнопки.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
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

/**
 * Размеры кнопок (Sizes).
 */
export const AllSizes: Story = {
  parameters: {
    docs: {
      description: {
        story: "Сравнение текстовых и иконочных размеров кнопок.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XS (24px)</Button>
      <Button size="sm">SM (28px)</Button>
      <Button size="default">Default (32px)</Button>
      <Button size="lg">LG (36px)</Button>
      <Button size="icon-xs">
        <PlusIcon size="xs" />
      </Button>
      <Button size="icon-sm">
        <PlusIcon size="xs" />
      </Button>
      <Button size="icon">
        <PlusIcon size="sm" />
      </Button>
      <Button size="icon-lg">
        <PlusIcon size="sm" />
      </Button>
    </div>
  ),
};

/**
 * Заблокированное состояние (Disabled).
 */
export const Disabled: Story = {
  parameters: {
    docs: {
      description: {
        story: "Кнопки в заблокированном состоянии (`disabled={true}`).",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default" disabled>
        Недоступно
      </Button>
      <Button variant="outline" disabled>
        Контурная
      </Button>
      <Button variant="secondary" disabled>
        Вторичная
      </Button>
    </div>
  ),
};
