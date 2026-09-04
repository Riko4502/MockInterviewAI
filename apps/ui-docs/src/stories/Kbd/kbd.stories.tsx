import { Input, Kbd } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Kbd для Storybook.
 */
const meta = {
  title: "Components/Kbd",
  component: Kbd,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Kbd** — обозначение клавиш клавиатуры

Компонент для отображения клавиш и их сочетаний в интерфейсе (например, подсказки горячих клавиш вида «Ctrl + K»). Использует семантический HTML-тег \`<kbd>\` для корректной доступности (a11y).

---

### **Установка и импорт**
\`\`\`tsx
import { Kbd } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline"],
      description: "Визуальный стиль клавиши.",
    },
    size: {
      control: "select",
      options: ["default", "sm"],
      description: "Размер компонента.",
    },
    children: {
      control: "text",
      description: "Содержимое — название клавиши.",
    },
  },
  args: {
    size: "default",
    children: "Ctrl",
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартная отдельная клавиша.
 */
export const Default: Story = {};

/**
 * Сочетание клавиш (например, для подсказки горячей клавиши поиска).
 */
export const Combination: Story = {
  render: () => (
    <div className="flex items-center gap-1">
      <Kbd>Ctrl</Kbd>
      <span className="text-xs text-muted-foreground">+</span>
      <Kbd>K</Kbd>
    </div>
  ),
};

/**
 * Уменьшенный размер — например, внутри компактных элементов интерфейса.
 */
export const Small: Story = {
  args: {
    size: "sm",
    children: "Esc",
  },
};

/**
 * Вариант без заливки — только рамка.
 */
export const Outline: Story = {
  args: {
    variant: "outline",
    children: "Alt",
  },
};

/**
 * Подсказка горячей клавиши поиска прямо в поле ввода — частый паттерн
 * в реальных интерфейсах (например, поиск по вопросам собеседования).
 */
export const SearchShortcut: Story = {
  render: () => (
    <div className="relative w-64">
      <Input placeholder="Поиск по вопросам..." className="pr-14" />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <Kbd size="sm">Ctrl</Kbd>
        <Kbd size="sm">K</Kbd>
      </div>
    </div>
  ),
};

/**
 * Панель горячих клавиш — например, в разделе помощи во время прохождения
 * мок-собеседования.
 */
export const ShortcutsList: Story = {
  render: () => (
    <div className="w-72 space-y-3 rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold">Горячие клавиши</h4>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Следующий вопрос</span>
          <Kbd>→</Kbd>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Предыдущий вопрос</span>
          <Kbd>←</Kbd>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Завершить собеседование</span>
          <Kbd>Esc</Kbd>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Открыть поиск</span>
          <div className="flex items-center gap-1">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </div>
        </div>
      </div>
    </div>
  ),
};
