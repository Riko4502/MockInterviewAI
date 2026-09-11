import { SettingsIcon } from "@packages/icons";
import { Button, Input, Label, Sheet } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Sheet для Storybook.
 */
const meta = {
  title: "Components/Sheet",
  component: Sheet,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Sheet** — выезжающая панель

Overlay-панель на базе диалога Radix. Выезжает с любой стороны экрана и используется для фильтров, настроек, деталей записи и мобильной версии Sidebar.

---

### **Установка и импорт**
\`\`\`tsx
import { Sheet } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Sheet>
  <Sheet.Trigger asChild>
    <Button>Открыть</Button>
  </Sheet.Trigger>
  <Sheet.Content side="right">
    <Sheet.Header>
      <Sheet.Title>Настройки</Sheet.Title>
      <Sheet.Description>Параметры сессии собеседования.</Sheet.Description>
    </Sheet.Header>
    Содержимое панели
    <Sheet.Footer>
      <Sheet.Close asChild>
        <Button variant="outline">Закрыть</Button>
      </Sheet.Close>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

function SheetExample({
  side = "right",
  showCloseButton = true,
}: {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <Sheet>
      <Sheet.Trigger asChild>
        <Button>
          <SettingsIcon />
          Открыть панель
        </Button>
      </Sheet.Trigger>
      <Sheet.Content side={side} showCloseButton={showCloseButton}>
        <Sheet.Header>
          <Sheet.Title>Настройки сессии</Sheet.Title>
          <Sheet.Description>
            Параметры текущего собеседования. Изменения применяются сразу.
          </Sheet.Description>
        </Sheet.Header>
        <div className="grid flex-1 gap-4 px-4">
          <div className="grid gap-2">
            <Label htmlFor="sheet-title">Название</Label>
            <Input id="sheet-title" defaultValue="Frontend Developer" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sheet-duration">Длительность, мин</Label>
            <Input id="sheet-duration" type="number" defaultValue={45} />
          </div>
        </div>
        <Sheet.Footer>
          <Sheet.Close asChild>
            <Button variant="outline">Отмена</Button>
          </Sheet.Close>
          <Sheet.Close asChild>
            <Button>Сохранить</Button>
          </Sheet.Close>
        </Sheet.Footer>
      </Sheet.Content>
    </Sheet>
  );
}

/**
 * Панель справа — основной сценарий настроек и деталей.
 */
export const Default: Story = {
  render: () => <SheetExample />,
};

/**
 * Панель слева, как мобильная навигация.
 */
export const Left: Story = {
  render: () => <SheetExample side="left" />,
};

/**
 * Панель сверху.
 */
export const Top: Story = {
  render: () => <SheetExample side="top" />,
};

/**
 * Панель снизу.
 */
export const Bottom: Story = {
  render: () => <SheetExample side="bottom" />,
};

/**
 * Без системной кнопки закрытия — только действия в футере.
 */
export const WithoutCloseButton: Story = {
  render: () => <SheetExample showCloseButton={false} />,
};
