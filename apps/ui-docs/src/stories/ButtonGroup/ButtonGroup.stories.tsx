import { ArrowDownIcon, CopyIcon, EditIcon, TrashIcon } from "@packages/icons";
import { Button, ButtonGroup } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента ButtonGroup для Storybook.
 */
const meta = {
  title: "Components/ButtonGroup",
  component: ButtonGroup,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Ориентация группы кнопок",
    },
    attached: {
      control: "boolean",
      description: "Склеивать ли границы кнопок",
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
      description: "Размер кнопок в группе",
    },
    variant: {
      control: "select",
      options: [
        "default",
        "outline",
        "secondary",
        "success",
        "ghost",
        "destructive",
      ],
      description: "Вариант оформления кнопок в группе",
    },
    disabled: {
      control: "boolean",
      description: "Отключить все кнопки в группе",
    },
  },
  args: {
    orientation: "horizontal",
    attached: true,
  },
} satisfies Meta<typeof ButtonGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовая горизонтальная группа кнопок.
 */
export const Horizontal: Story = {
  render: (args) => (
    <ButtonGroup {...args} variant="outline">
      <Button>День</Button>
      <Button>Неделя</Button>
      <Button>Месяц</Button>
      <Button>Год</Button>
    </ButtonGroup>
  ),
};

/**
 * Вертикальная группа кнопок.
 */
export const Vertical: Story = {
  render: (args) => (
    <ButtonGroup {...args} orientation="vertical" variant="outline">
      <Button>Профиль</Button>
      <Button>Настройки</Button>
      <Button>Безопасность</Button>
      <Button>Уведомления</Button>
    </ButtonGroup>
  ),
};

/**
 * Различные цветовые варианты оформления группы кнопок.
 */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Outline:</span>
        <ButtonGroup variant="outline">
          <Button>Лево</Button>
          <Button>Центр</Button>
          <Button>Право</Button>
        </ButtonGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Secondary:</span>
        <ButtonGroup variant="secondary">
          <Button>Сетка</Button>
          <Button>Список</Button>
          <Button>Таблица</Button>
        </ButtonGroup>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Default:</span>
        <ButtonGroup variant="default">
          <Button>Принять</Button>
          <Button>Отклонить</Button>
        </ButtonGroup>
      </div>
    </div>
  ),
};

/**
 * Сравнение всех доступных размеров группы кнопок.
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 items-start">
      <div className="flex items-center gap-4">
        <span className="w-20 text-xs text-muted-foreground">XS:</span>
        <ButtonGroup size="xs" variant="outline">
          <Button>1</Button>
          <Button>2</Button>
          <Button>3</Button>
        </ButtonGroup>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-20 text-xs text-muted-foreground">SM:</span>
        <ButtonGroup size="sm" variant="outline">
          <Button>1</Button>
          <Button>2</Button>
          <Button>3</Button>
        </ButtonGroup>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-20 text-xs text-muted-foreground">Default:</span>
        <ButtonGroup size="default" variant="outline">
          <Button>1</Button>
          <Button>2</Button>
          <Button>3</Button>
        </ButtonGroup>
      </div>

      <div className="flex items-center gap-4">
        <span className="w-20 text-xs text-muted-foreground">LG:</span>
        <ButtonGroup size="lg" variant="outline">
          <Button>1</Button>
          <Button>2</Button>
          <Button>3</Button>
        </ButtonGroup>
      </div>
    </div>
  ),
};

/**
 * Разделенная кнопка действия (Split Button) с выпадающим меню.
 */
export const SplitButton: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <ButtonGroup variant="default">
        <Button>Сохранить изменения</Button>
        <Button size="icon" aria-label="Дополнительные действия">
          <ArrowDownIcon />
        </Button>
      </ButtonGroup>

      <ButtonGroup variant="outline">
        <Button>Экспорт отчета</Button>
        <Button size="icon" aria-label="Форматы экспорта">
          <ArrowDownIcon />
        </Button>
      </ButtonGroup>
    </div>
  ),
};

/**
 * Панель инструментов (Toolbar) с иконками действий.
 */
export const Toolbar: Story = {
  render: () => (
    <ButtonGroup variant="outline">
      <Button size="icon" aria-label="Редактировать">
        <EditIcon />
      </Button>
      <Button size="icon" aria-label="Копировать">
        <CopyIcon />
      </Button>
      <Button size="icon" variant="destructive" aria-label="Удалить">
        <TrashIcon />
      </Button>
    </ButtonGroup>
  ),
};

/**
 * Группа кнопок с разделением отступами (без склейки границ).
 */
export const Spaced: Story = {
  render: () => (
    <ButtonGroup attached={false} variant="outline">
      <Button>Кнопка 1</Button>
      <Button>Кнопка 2</Button>
      <Button>Кнопка 3</Button>
    </ButtonGroup>
  ),
};
