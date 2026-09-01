import { HelpIcon, PlusIcon, SettingsIcon, TrashIcon } from "@packages/icons";
import { Button, Tooltip } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Tooltip для Storybook.
 */
const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  subcomponents: {
    "Tooltip.Provider": Tooltip.Provider,
    "Tooltip.Root": Tooltip.Root,
    "Tooltip.Trigger": Tooltip.Trigger,
    "Tooltip.Content": Tooltip.Content,
    "Tooltip.Arrow": Tooltip.Arrow,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Tooltip** — всплывающая контекстная подсказка

Компонент для отображения краткой поясняющей информации при наведении курсора мыши или получении элементом фокуса с клавиатуры. Построен на базе доступного примитива \`radix-ui\`.

Поддерживает два удобных способа вызова:
1. **Shorthand-режим:** \`<Tooltip content="Текст подсказки"><Button>Наведи</Button></Tooltip>\`
2. **Compound-режим:** \`<Tooltip.Root><Tooltip.Trigger>...</Tooltip.Trigger><Tooltip.Content>...</Tooltip.Content></Tooltip.Root>\`

---

### **Установка и импорт**
\`\`\`tsx
import { Tooltip, Button } from "@packages/ui";
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    content: {
      control: "text",
      description: "Текст подсказки (shorthand-режим).",
      table: { type: { summary: "ReactNode" } },
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
      description: "Сторона появления подсказки.",
      table: {
        type: { summary: '"top" | "right" | "bottom" | "left"' },
        defaultValue: { summary: '"top"' },
      },
    },
    align: {
      control: "select",
      options: ["start", "center", "end"],
      description: "Выравнивание подсказки по оси.",
      table: {
        type: { summary: '"start" | "center" | "end"' },
        defaultValue: { summary: '"center"' },
      },
    },
    delayDuration: {
      control: "number",
      description: "Задержка появления подсказки в миллисекундах.",
      table: {
        type: { summary: "number" },
        defaultValue: { summary: "200" },
      },
    },
    withArrow: {
      control: "boolean",
      description: "Отображать ли стрелку-указатель.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    content: "Подсказка к кнопке",
    side: "top",
    align: "center",
    delayDuration: 200,
    withArrow: false,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовая подсказка при наведении (Shorthand-режим).
 */
export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="outline">Наведите курсор на кнопку</Button>
    </Tooltip>
  ),
};

/**
 * Подсказка со стрелочкой (With arrow).
 */
export const WithArrow: Story = {
  render: () => (
    <Tooltip
      content="Нажмите для настройки критериев оценки"
      withArrow
      side="top"
    >
      <Button size="icon" variant="outline">
        <SettingsIcon size="xs" />
      </Button>
    </Tooltip>
  ),
};

/**
 * Позиционирование подсказок со всех 4 сторон.
 */
export const AllSides: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      <Tooltip content="Подсказка сверху" side="top">
        <Button variant="outline" size="sm">
          Top
        </Button>
      </Tooltip>
      <Tooltip content="Подсказка справа" side="right">
        <Button variant="outline" size="sm">
          Right
        </Button>
      </Tooltip>
      <Tooltip content="Подсказка снизу" side="bottom">
        <Button variant="outline" size="sm">
          Bottom
        </Button>
      </Tooltip>
      <Tooltip content="Подсказка слева" side="left">
        <Button variant="outline" size="sm">
          Left
        </Button>
      </Tooltip>
    </div>
  ),
};

/**
 * Подсказки к иконкам действий в интерфейсе.
 */
export const ActionIcons: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tooltip content="Добавить новый вопрос в базу">
        <Button size="icon-sm" variant="secondary">
          <PlusIcon size="xs" />
        </Button>
      </Tooltip>
      <Tooltip content="Справочный центр и документация">
        <Button size="icon-sm" variant="ghost">
          <HelpIcon size="xs" />
        </Button>
      </Tooltip>
      <Tooltip content="Удалить сессию безвозвратно">
        <Button size="icon-sm" variant="destructive">
          <TrashIcon size="xs" />
        </Button>
      </Tooltip>
    </div>
  ),
};
