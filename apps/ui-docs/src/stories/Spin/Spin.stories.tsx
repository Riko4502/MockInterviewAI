import { Button, Card, Spin, Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Метаданные компонента Spin для Storybook.
 */
const meta = {
  title: "UI/Spin",
  component: Spin,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "secondary",
        "muted",
        "success",
        "destructive",
        "white",
        "current",
      ],
      description: "Цветовой вариант спиннера",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "default", "md", "lg", "xl"],
      description: "Размер спиннера",
    },
    spinning: {
      control: "boolean",
      description: "Включен ли индикатор загрузки",
    },
    tip: {
      control: "text",
      description: "Текстовое описание / подпись под спиннером",
    },
    fullscreen: {
      control: "boolean",
      description: "Полноэкранный блокирующий оверлей",
    },
  },
  args: {
    spinning: true,
    size: "default",
    variant: "default",
  },
} satisfies Meta<typeof Spin>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Базовый спиннер по умолчанию.
 */
export const Default: Story = {
  args: {},
};

/**
 * Спиннер с текстовой подсказкой.
 */
export const WithTip: Story = {
  args: {
    tip: "Загрузка данных...",
  },
};

/**
 * Все доступные размеры индикатора загрузки.
 */
export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Spin size="xs" />
        <span className="text-xs text-muted-foreground">XS (14px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin size="sm" />
        <span className="text-xs text-muted-foreground">SM (16px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin size="default" />
        <span className="text-xs text-muted-foreground">Default (20px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin size="lg" />
        <span className="text-xs text-muted-foreground">LG (32px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin size="xl" />
        <span className="text-xs text-muted-foreground">XL (48px)</span>
      </div>
    </div>
  ),
};

/**
 * Все цветовые варианты оформления.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6 p-4">
      <div className="flex flex-col items-center gap-2">
        <Spin variant="default" size="lg" />
        <span className="text-xs text-muted-foreground">Default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin variant="secondary" size="lg" />
        <span className="text-xs text-muted-foreground">Secondary</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin variant="muted" size="lg" />
        <span className="text-xs text-muted-foreground">Muted</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin variant="success" size="lg" />
        <span className="text-xs text-muted-foreground">Success</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Spin variant="destructive" size="lg" />
        <span className="text-xs text-muted-foreground">Destructive</span>
      </div>
    </div>
  ),
};

/**
 * Использование спиннера внутри кнопок Button в состоянии загрузки.
 */
export const InsideButton: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button disabled>
        <Spin size="xs" variant="current" />
        Сохранение...
      </Button>
      <Button variant="outline" disabled>
        <Spin size="xs" variant="current" />
        Загрузка
      </Button>
      <Button variant="destructive" disabled>
        <Spin size="xs" variant="current" />
        Удаление...
      </Button>
    </div>
  ),
};

/**
 * Оборачивание карточки Card с переключением состояния загрузки и блюром контента.
 */
export const WrappedCard: Story = {
  render: () => {
    const [loading, setLoading] = React.useState(true);

    return (
      <div className="flex flex-col gap-4 w-[400px]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Статус загрузки:</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {loading ? "Загрузка активна" : "Загрузка завершена"}
            </span>
            <Switch
              checked={loading}
              onCheckedChange={setLoading}
              aria-label="Переключить состояние загрузки"
            />
          </div>
        </div>

        <Spin spinning={loading} tip="Обновление профиля..." size="lg">
          <Card className="p-6">
            <Card.Header className="p-0 pb-4">
              <Card.Title>Профиль кандидата</Card.Title>
              <Card.Description>Информация об опыте и навыках</Card.Description>
            </Card.Header>
            <Card.Content className="p-0 space-y-2 text-sm">
              <p>
                <strong>Позиция:</strong> Senior Frontend Developer
              </p>
              <p>
                <strong>Стек:</strong> React, TypeScript, Tailwind CSS
              </p>
              <p>
                <strong>Статус:</strong> Доступен для предложений
              </p>
            </Card.Content>
          </Card>
        </Spin>
      </div>
    );
  },
};

/**
 * Полноэкранный режим блокирующей загрузки с автоматическим закрытием.
 */
export const FullscreenDemo: Story = {
  render: () => {
    const [active, setActive] = React.useState(false);

    React.useEffect(() => {
      if (active) {
        const timer = setTimeout(() => setActive(false), 3000);
        return () => clearTimeout(timer);
      }
    }, [active]);

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setActive(true)}>
          Запустить полноэкранную загрузку (3 сек)
        </Button>
        {active && (
          <Spin fullscreen size="xl" tip="Синхронизация с сервером AI..." />
        )}
      </div>
    );
  },
};

/**
 * Использование пользовательского индикатора (Custom Indicator).
 */
export const CustomIndicator: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <Spin
        tip="Пульсирующая загрузка"
        indicator={
          <div className="size-5 rounded-full bg-primary animate-ping" />
        }
      />
    </div>
  ),
};
