import { BellIcon, SettingsIcon } from "@packages/icons";
import { Badge, Button, Input, Label, Popover, Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

interface StoryPopoverProps {
  // Popover Root
  defaultOpen?: boolean;
  modal?: boolean;
  // Popover Content
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  sticky?: "partial" | "always";
  hideWhenDetached?: boolean;
  showCloseButton?: boolean;
  showArrow?: boolean;
}

/**
 * Метаданные компонента Popover для Storybook.
 */
const meta = {
  title: "Components/Popover",
  component: Popover,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Popover** — всплывающее контекстное окно

Составной компонент: **Popover** (корень) + **Popover.Trigger** + **Popover.Content** + **Popover.Anchor** + **Popover.Close** + **Popover.Arrow**.
Используется для отображения произвольного богатого контента (центр уведомлений, быстрые настройки, фильтры, карточки пользователя).

---

### **Установка и импорт**
\`\`\`tsx
import { Popover } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Popover>
  <Popover.Trigger asChild>
    <Button variant="outline">Параметры</Button>
  </Popover.Trigger>
  <Popover.Content align="center" side="bottom" sideOffset={8} showCloseButton>
    <Popover.Arrow />
    <div className="p-2">
      <h4 className="font-semibold text-sm">Заголовок</h4>
      <p className="text-xs text-muted-foreground">Контент всплывающего окна</p>
    </div>
  </Popover.Content>
</Popover>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    // --- Popover Root ---
    defaultOpen: {
      control: "boolean",
      description: "Начальное состояние видимости (неконтролируемый режим).",
      table: {
        category: "Popover (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    modal: {
      control: "boolean",
      description:
        "Модальный режим: блокирует взаимодействие с остальной частью страницы, пока панель открыта.",
      table: {
        category: "Popover (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    // --- Popover Content ---
    align: {
      control: "select",
      options: ["start", "center", "end"],
      description: "Выравнивание окна относительно триггера по поперечной оси.",
      table: {
        category: "Popover.Content",
        type: { summary: '"start" | "center" | "end"' },
        defaultValue: { summary: '"center"' },
      },
    },
    side: {
      control: "select",
      options: ["top", "right", "bottom", "left"],
      description: "Сторона появления всплывающего окна относительно триггера.",
      table: {
        category: "Popover.Content",
        type: { summary: '"top" | "right" | "bottom" | "left"' },
        defaultValue: { summary: '"bottom"' },
      },
    },
    sideOffset: {
      control: "number",
      description: "Отступ окна от триггера в пикселях.",
      table: {
        category: "Popover.Content",
        type: { summary: "number" },
        defaultValue: { summary: "4" },
      },
    },
    alignOffset: {
      control: "number",
      description: "Смещение выравнивания в пикселях.",
      table: {
        category: "Popover.Content",
        type: { summary: "number" },
        defaultValue: { summary: "0" },
      },
    },
    avoidCollisions: {
      control: "boolean",
      description:
        "Автоматическое предотвращение вылета окна за границы вьюпорта (flip).",
      table: {
        category: "Popover.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    collisionPadding: {
      control: "number",
      description: "Минимальный отступ окна от краев экрана в пикселях.",
      table: {
        category: "Popover.Content",
        type: { summary: "number" },
        defaultValue: { summary: "0" },
      },
    },
    sticky: {
      control: "radio",
      options: ["partial", "always"],
      description:
        "Поведение прилипания к триггеру при прокрутке страницы (`partial` — прилипать пока триггер виден, `always` — прилипать всегда).",
      table: {
        category: "Popover.Content",
        type: { summary: '"partial" | "always"' },
        defaultValue: { summary: '"partial"' },
      },
    },
    hideWhenDetached: {
      control: "boolean",
      description:
        "Автоматически скрывать всплывающее окно, если триггер полностью прокручен за пределы видимой области.",
      table: {
        category: "Popover.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showCloseButton: {
      control: "boolean",
      description:
        "Отображать ли встроенную кнопку-крестик закрытия в правом верхнем углу окна.",
      table: {
        category: "Popover.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    showArrow: {
      control: "boolean",
      description:
        "Отображать ли стрелочку-указатель (`Popover.Arrow`), направленную на триггер.",
      table: {
        category: "Popover.Content",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    align: "center",
    side: "bottom",
    sideOffset: 6,
    alignOffset: 0,
    avoidCollisions: true,
    collisionPadding: 8,
    sticky: "partial",
    hideWhenDetached: false,
    showCloseButton: true,
    showArrow: true,
    modal: false,
    defaultOpen: false,
  },
} satisfies Meta<StoryPopoverProps>;

export default meta;
type Story = StoryObj<StoryPopoverProps>;

/**
 * Интерактивный Popover со всеми доступными параметрами позиционирования и кастомизации в Controls.
 */
export const Default: Story = {
  render: ({
    defaultOpen,
    modal,
    showArrow,
    showCloseButton,
    ...contentProps
  }) => (
    <Popover defaultOpen={defaultOpen} modal={modal}>
      <Popover.Trigger asChild>
        <Button variant="outline" className="gap-2">
          <SettingsIcon size="sm" />
          <span>Быстрые настройки</span>
        </Button>
      </Popover.Trigger>
      <Popover.Content
        className="w-80"
        showCloseButton={showCloseButton}
        {...contentProps}
      >
        {showArrow && <Popover.Arrow />}
        <div className="grid gap-4">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm leading-none">
              Параметры комнаты
            </h4>
            <p className="text-xs text-muted-foreground">
              Настройте звук и видео перед началом интервью.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="audio-toggle" className="text-xs">
                Авто-включение микрофона
              </Label>
              <Switch id="audio-toggle" defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="camera-toggle" className="text-xs">
                HD качество камеры
              </Label>
              <Switch id="camera-toggle" />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label htmlFor="display-name" className="text-xs">
                Отображаемое имя
              </Label>
              <Input
                id="display-name"
                defaultValue="Александр Смирнов"
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>
      </Popover.Content>
    </Popover>
  ),
};

/**
 * Центр уведомлений (NotificationBell Popover).
 */
export const NotificationsPreview: Story = {
  render: () => (
    <Popover>
      <Popover.Trigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <BellIcon size="md" />
          <Badge
            variant="statusDanger"
            className="absolute -top-1.5 -right-1.5 size-4 p-0 text-[10px] flex items-center justify-center font-bold"
          >
            2
          </Badge>
        </Button>
      </Popover.Trigger>
      <Popover.Content
        align="end"
        sideOffset={8}
        className="w-80 p-0 shadow-xl"
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Уведомления</span>
          <span className="text-xs text-primary cursor-pointer hover:underline">
            Прочитать все
          </span>
        </div>
        <div className="divide-y divide-border/60 max-h-64 overflow-y-auto">
          <div className="p-3 hover:bg-muted/50 transition-colors cursor-pointer text-xs space-y-1">
            <div className="flex items-center justify-between font-medium">
              <span className="text-foreground">Новый отклик</span>
              <span className="text-muted-foreground text-[10px]">
                5 мин назад
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2">
              Иван откликнулся на вашу карточку React Middle.
            </p>
          </div>
          <div className="p-3 hover:bg-muted/50 transition-colors cursor-pointer text-xs space-y-1">
            <div className="flex items-center justify-between font-medium">
              <span className="text-foreground">Матч подтвержден</span>
              <span className="text-muted-foreground text-[10px]">
                1 час назад
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2">
              Собеседование запланировано на 19:00 МСК.
            </p>
          </div>
        </div>
        <div className="p-2 border-t border-border text-center">
          <Button variant="ghost" size="sm" className="w-full text-xs h-7">
            Открыть центр уведомлений
          </Button>
        </div>
      </Popover.Content>
    </Popover>
  ),
};
