import { Button, Card, Separator } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Separator для Storybook.
 */
const meta = {
  title: "UI/Separator",
  component: Separator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Ориентация разделителя",
    },
    variant: {
      control: "select",
      options: ["default", "muted", "dashed", "dotted"],
      description: "Стиль линии разделителя",
    },
    decorative: {
      control: "boolean",
      description: "Является ли разделитель чисто декоративным (a11y)",
    },
    label: {
      control: "text",
      description: "Текстовая подпись по центру горизонтального разделителя",
    },
  },
  args: {
    orientation: "horizontal",
    variant: "default",
    decorative: true,
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный горизонтальный разделитель контента.
 */
export const Horizontal: Story = {
  render: (args) => (
    <div className="w-80 space-y-3">
      <div>
        <h4 className="text-sm font-semibold leading-none">MockInterview AI</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Платформа для подготовки к техническим собеседованиям.
        </p>
      </div>
      <Separator {...args} />
      <div className="flex text-xs text-muted-foreground gap-4">
        <span>Документация</span>
        <span>Тарифы</span>
        <span>Контакты</span>
      </div>
    </div>
  ),
};

/**
 * Вертикальный разделитель между элементами строки или навигации.
 */
export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-3 text-sm">
      <span className="font-medium">Главная</span>
      <Separator orientation="vertical" />
      <span className="font-medium">Интервью</span>
      <Separator orientation="vertical" />
      <span className="text-muted-foreground">Настройки</span>
    </div>
  ),
};

/**
 * Разделитель с текстовой меткой по центру (например, для форм авторизации).
 */
export const WithLabel: Story = {
  render: () => (
    <div className="w-80 space-y-4">
      <Button className="w-full">Войти через Google</Button>
      <Separator label="или продолжить с email" />
      <Button variant="outline" className="w-full">
        Войти по паролю
      </Button>
    </div>
  ),
};

/**
 * Сравнение всех доступных стилей линий (solid, muted, dashed, dotted).
 */
export const Variants: Story = {
  render: () => (
    <div className="w-80 space-y-6">
      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Default (Solid):</span>
        <Separator variant="default" />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Muted:</span>
        <Separator variant="muted" />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Dashed (Пунктир):</span>
        <Separator variant="dashed" />
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Dotted (Точки):</span>
        <Separator variant="dotted" />
      </div>
    </div>
  ),
};

/**
 * Пример использования разделителя внутри карточки Card.
 */
export const InCardSection: Story = {
  render: () => (
    <Card className="w-80 p-0 overflow-hidden">
      <div className="p-4">
        <h4 className="text-sm font-semibold">Настройки приватности</h4>
        <p className="text-xs text-muted-foreground mt-1">
          Управляйте видимостью профиля
        </p>
      </div>
      <Separator />
      <div className="p-4 text-xs text-muted-foreground space-y-2">
        <p>• Показывать результаты собеседований рекрутерам</p>
        <p>• Разрешить AI анализировать видеозапись</p>
      </div>
      <Separator variant="dashed" />
      <div className="p-3 bg-muted/20 flex justify-end">
        <Button size="sm">Сохранить</Button>
      </div>
    </Card>
  ),
};
