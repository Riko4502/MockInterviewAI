import { HelpIcon, PlusIcon, SettingsIcon, TrashIcon } from "@packages/icons";
import { Button, Tooltip } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Tooltip для Storybook.
 */
const meta = {
  title: "UI/Tooltip",
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
  },
  tags: ["autodocs"],
  argTypes: {
    content: {
      control: "text",
      description: "Текст подсказки",
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
      description: "Сторона появления подсказки",
    },
    align: {
      control: "select",
      options: ["start", "center", "end"],
      description: "Выравнивание подсказки по оси",
    },
    delayDuration: {
      control: "number",
      description: "Задержка появления (мс)",
    },
    withArrow: {
      control: "boolean",
      description: "Отображать ли стрелку-указатель",
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
      <Button variant="outline">Наведите курсор</Button>
    </Tooltip>
  ),
};

/**
 * Варианты расположения подсказки по 4 сторонам (Top, Right, Bottom, Left).
 */
export const Positions: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-12">
      <Tooltip content="Подсказка сверху" side="top">
        <Button variant="outline">Сверху (Top)</Button>
      </Tooltip>

      <Tooltip content="Подсказка справа" side="right">
        <Button variant="outline">Справа (Right)</Button>
      </Tooltip>

      <Tooltip content="Подсказка снизу" side="bottom">
        <Button variant="outline">Снизу (Bottom)</Button>
      </Tooltip>

      <Tooltip content="Подсказка слева" side="left">
        <Button variant="outline">Слева (Left)</Button>
      </Tooltip>
    </div>
  ),
};

/**
 * Подсказки для кнопок-иконок в тулбаре действий.
 */
export const WithIconButtons: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Tooltip content="Создать новое интервью" side="top">
        <Button size="icon" variant="outline" aria-label="Создать">
          <PlusIcon size="sm" />
        </Button>
      </Tooltip>

      <Tooltip content="Настройки профиля" side="top">
        <Button size="icon" variant="outline" aria-label="Настройки">
          <SettingsIcon size="sm" />
        </Button>
      </Tooltip>

      <Tooltip content="Справочный центр" side="top">
        <Button size="icon" variant="ghost" aria-label="Помощь">
          <HelpIcon size="sm" />
        </Button>
      </Tooltip>

      <Tooltip content="Удалить вопрос" side="top">
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label="Удалить"
        >
          <TrashIcon size="sm" />
        </Button>
      </Tooltip>
    </div>
  ),
};

/**
 * Подсказка со стрелкой-указателем (withArrow).
 */
export const WithArrow: Story = {
  render: () => (
    <Tooltip content="Подсказка с треугольной стрелкой" withArrow side="top">
      <Button>Со стрелкой</Button>
    </Tooltip>
  ),
};

/**
 * Использование через составной синтаксис (Compound API).
 */
export const CompoundApi: Story = {
  render: () => (
    <Tooltip.Provider delayDuration={100}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Button variant="secondary">Составной API</Button>
        </Tooltip.Trigger>
        <Tooltip.Content side="bottom">
          Кастомный контент подсказки
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  ),
};
