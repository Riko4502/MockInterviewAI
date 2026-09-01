import { Label, Switch } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Switch для Storybook.
 */
const meta = {
  title: "Components/Switch",
  component: Switch,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Switch** — двухпозиционный переключатель (Toggle)

Компонент для мгновенного включения или выключения определенной настройки или функции. Построен на базе доступного примитива \`radix-ui\` с плавной анимацией перемещения ползунка.

---

### **Установка и импорт**
\`\`\`tsx
import { Switch, Label } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<div className="flex items-center gap-2">
  <Switch id="airplane-mode" />
  <Label htmlFor="airplane-mode">Режим полета</Label>
</div>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
      description:
        "Размер переключателя. `default` — стандартный; `sm` — уменьшенный.",
      table: {
        type: { summary: '"default" | "sm"' },
        defaultValue: { summary: '"default"' },
      },
    },
    checked: {
      control: "boolean",
      description:
        "Управляемое состояние переключателя (вкл/выкл). Требует `onCheckedChange`.",
      table: { type: { summary: "boolean" } },
    },
    defaultChecked: {
      control: "boolean",
      description: "Неуправляемое начальное состояние переключателя.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует переключатель. Снижает прозрачность и запрещает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onCheckedChange: {
      action: "checkedChange",
      description:
        "Обработчик изменения состояния. Вызывается с новым значением `boolean`.",
      table: { type: { summary: "(checked: boolean) => void" } },
    },
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный переключатель.
 */
export const Default: Story = {
  render: (args) => <Switch {...args} aria-label="Переключатель" />,
};

/**
 * Переключатель с подписью Label и описанием настройки.
 */
export const WithLabelAndDescription: Story = {
  render: () => (
    <div className="flex items-start gap-3 w-80 p-4 border rounded-xl bg-card">
      <Switch id="realtime-ai" defaultChecked className="mt-0.5" />
      <div className="space-y-0.5">
        <Label htmlFor="realtime-ai" className="font-medium cursor-pointer">
          AI Анализ в реальном времени
        </Label>
        <p className="text-xs text-muted-foreground">
          Генерация рекомендаций и фидбэка по ходу ответа кандидата.
        </p>
      </div>
    </div>
  ),
};

/**
 * Размеры переключателей (Default vs Small).
 */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <Switch id="s1" size="default" defaultChecked />
        <Label htmlFor="s1">Default</Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="s2" size="sm" defaultChecked />
        <Label htmlFor="s2" className="text-xs">
          Small
        </Label>
      </div>
    </div>
  ),
};

/**
 * Заблокированное состояние (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Switch disabled defaultChecked aria-label="Включено (заблокировано)" />
      <Switch disabled aria-label="Выключено (заблокировано)" />
    </div>
  ),
};
