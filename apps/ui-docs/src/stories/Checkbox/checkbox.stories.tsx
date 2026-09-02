import { Checkbox, Label } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import * as React from "react";

/**
 * Метаданные компонента Checkbox для Storybook.
 */
const meta = {
  title: "Components/Checkbox",
  component: Checkbox,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Checkbox** — элемент множественного выбора

Доступный компонент флажка на базе примитива \`radix-ui\`. Поддерживает включенное (\`checked\`), выключенное (\`unchecked\`) и промежуточное частичное состояние (\`indeterminate\`), а также полную клавиатурную навигацию (\`Space\`).

---

### **Установка и импорт**
\`\`\`tsx
import { Checkbox, Label } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<div className="flex items-center gap-2">
  <Checkbox id="terms" />
  <Label htmlFor="terms">Согласен с правилами сервиса</Label>
</div>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    checked: {
      control: "select",
      options: [true, false, "indeterminate"],
      description:
        'Управляемое состояние чекбокса. `true` — отмечен; `false` — снят; `"indeterminate"` — неопределённое (частичный выбор).',
      table: {
        type: { summary: 'boolean | "indeterminate"' },
      },
    },
    defaultChecked: {
      control: "boolean",
      description: "Неуправляемое начальное состояние чекбокса.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    disabled: {
      control: "boolean",
      description:
        "Блокирует чекбокс. Снижает прозрачность и запрещает взаимодействие.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onCheckedChange: {
      action: "checkedChange",
      description:
        'Обработчик изменения состояния. Вызывается с новым значением `boolean | "indeterminate"`.',
      table: {
        type: { summary: '(checked: boolean | "indeterminate") => void' },
      },
    },
    "aria-label": {
      control: "text",
      description:
        "Доступное название чекбокса. Обязательно, если нет видимого лейбла.",
      table: { type: { summary: "string" } },
    },
    className: {
      control: "text",
      description: "Дополнительные CSS-классы.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный интерактивный чекбокс.
 */
export const Default: Story = {
  render: (args) => <Checkbox {...args} aria-label="Чекбокс" />,
};

/**
 * Чекбокс с текстовой подписью Label.
 */
export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="c1" defaultChecked />
      <Label htmlFor="c1" className="cursor-pointer font-medium">
        Включить AI-подсказки во время интервью
      </Label>
    </div>
  ),
};

/**
 * Группа чекбоксов с частичным выбором (Indeterminate).
 */
export const IndeterminateGroup: Story = {
  render: () => {
    const [checkedItems, setCheckedItems] = React.useState([
      true,
      false,
      false,
    ]);

    const allChecked = checkedItems.every(Boolean);
    const isIndeterminate = checkedItems.some(Boolean) && !allChecked;

    return (
      <div className="space-y-3 w-64 p-4 border rounded-xl bg-card">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Checkbox
            id="parent"
            checked={
              allChecked ? true : isIndeterminate ? "indeterminate" : false
            }
            onCheckedChange={(val) =>
              setCheckedItems([Boolean(val), Boolean(val), Boolean(val)])
            }
          />
          <Label htmlFor="parent" className="font-semibold cursor-pointer">
            Выбрать все секции
          </Label>
        </div>

        <div className="space-y-2 pl-4">
          {["System Design", "Coding / Algorithms", "Behavioral"].map(
            (name, i) => (
              <div key={name} className="flex items-center gap-2">
                <Checkbox
                  id={`sub-${i}`}
                  checked={checkedItems[i]}
                  onCheckedChange={(val) => {
                    const updated = [...checkedItems];
                    updated[i] = Boolean(val);
                    setCheckedItems(updated);
                  }}
                />
                <Label htmlFor={`sub-${i}`} className="text-sm cursor-pointer">
                  {name}
                </Label>
              </div>
            ),
          )}
        </div>
      </div>
    );
  },
};

/**
 * Заблокированные чекбоксы (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Checkbox id="d1" disabled defaultChecked />
        <Label htmlFor="d1" className="opacity-50">
          Заблокировано (выбрано)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="d2" disabled />
        <Label htmlFor="d2" className="opacity-50">
          Заблокировано (не выбрано)
        </Label>
      </div>
    </div>
  ),
};
