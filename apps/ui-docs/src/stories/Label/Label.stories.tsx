import { Checkbox, Input, Label, Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Label для Storybook.
 */
const meta = {
  title: "UI/Label",
  component: Label,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "muted", "destructive", "success"],
      description: "Цветовой вариант текста метки",
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
      description: "Размер шрифта метки",
    },
    required: {
      control: "boolean",
      description: "Обязательное ли поле (отображение звездочки *)",
    },
    children: {
      control: "text",
      description: "Текст метки",
    },
  },
  args: {
    children: "Имя пользователя",
    variant: "default",
    size: "default",
    required: false,
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовая текстовая метка по умолчанию.
 */
export const Default: Story = {
  args: {
    children: "Электронная почта",
  },
};

/**
 * Метка обязательного поля с индикатором (*).
 */
export const Required: Story = {
  args: {
    children: "Пароль",
    required: true,
  },
};

/**
 * Использование Label в связке с текстовым полем Input через htmlFor/id.
 */
export const WithInput: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="email-input" required>
        Рабочий email
      </Label>
      <Input id="email-input" type="email" placeholder="name@company.com" />
    </div>
  ),
};

/**
 * Использование Label в связке с Checkbox.
 */
export const WithCheckbox: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms-checkbox" />
      <Label htmlFor="terms-checkbox" className="cursor-pointer">
        Я согласен с условиями сервиса
      </Label>
    </div>
  ),
};

/**
 * Использование Label в связке с переключателем Switch.
 */
export const WithSwitch: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Switch id="airplane-mode" />
      <Label htmlFor="airplane-mode" className="cursor-pointer">
        Режим полета
      </Label>
    </div>
  ),
};

/**
 * Все доступные размеры компонента Label.
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="w-24 text-xs text-muted-foreground">sm (12px):</span>
        <Label size="sm">Маленькая метка (Small)</Label>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-24 text-xs text-muted-foreground">
          default (14px):
        </span>
        <Label size="default">Стандартная метка (Default)</Label>
      </div>
      <div className="flex items-center gap-4">
        <span className="w-24 text-xs text-muted-foreground">lg (16px):</span>
        <Label size="lg">Крупная метка (Large)</Label>
      </div>
    </div>
  ),
};

/**
 * Все цветовые варианты компонента Label.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Label variant="default">Default — стандартный цвет текста</Label>
      <Label variant="muted">Muted — приглушенный цвет текста</Label>
      <Label variant="destructive">Destructive — ошибка / критичное поле</Label>
      <Label variant="success">Success — успешное подтверждение</Label>
    </div>
  ),
};

/**
 * Поведение метки при отключенном связанном поле (peer-disabled).
 */
export const DisabledState: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-80">
      <Label htmlFor="disabled-input">Заблокированное поле</Label>
      <Input
        id="disabled-input"
        disabled
        placeholder="Поле недоступно для ввода"
      />
    </div>
  ),
};
