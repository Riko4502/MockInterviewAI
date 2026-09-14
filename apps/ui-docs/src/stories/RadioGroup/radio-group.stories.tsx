import { Label, RadioGroup } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

interface StoryRadioGroupProps {
  defaultValue?: string;
  disabled?: boolean;
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  required?: boolean;
  name?: string;
  dir?: "ltr" | "rtl";
}

/**
 * Метаданные компонента RadioGroup для Storybook.
 */
const meta = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **RadioGroup** — группа радио-кнопок

Составной компонент: **RadioGroup** (корень) + **RadioGroup.Item** (радио-кнопка).
Используется для выбора одного взаимоисключающего значения из небольшого списка вариантов (грейды, специализации, причины отказа).

---

### **Установка и импорт**
\`\`\`tsx
import { RadioGroup, Label } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<RadioGroup defaultValue="middle">
  <div className="flex items-center space-x-2">
    <RadioGroup.Item value="junior" id="junior" />
    <Label htmlFor="junior">Junior</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroup.Item value="middle" id="middle" />
    <Label htmlFor="middle">Middle</Label>
  </div>
</RadioGroup>
\`\`\`

---

### **Состояние (controlled vs uncontrolled)**
По умолчанию компонент работает в неконтролируемом режиме через \`defaultValue\`. Для контролируемого режима передайте \`value\` и \`onValueChange\`.
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    // --- RadioGroup Root ---
    defaultValue: {
      control: "text",
      description:
        "Начальное выбранное значение (для неконтролируемого режима).",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: "string" },
        defaultValue: { summary: '"middle"' },
      },
    },
    disabled: {
      control: "boolean",
      description: "Отключение всей группы радио-кнопок.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    orientation: {
      control: "radio",
      options: ["vertical", "horizontal"],
      description:
        "Ориентация группы и направление навигации стрелками клавиатуры.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: '"vertical" | "horizontal"' },
        defaultValue: { summary: '"vertical"' },
      },
    },
    loop: {
      control: "boolean",
      description:
        "Зацикливать ли перемещение фокуса при достижении первого/последнего элемента клавишами стрелок.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
    required: {
      control: "boolean",
      description:
        "Обязательность выбора хотя бы одного значения в HTML-форме.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    name: {
      control: "text",
      description: "Имя поля для нативной отправки формы.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: "string" },
      },
    },
    dir: {
      control: "radio",
      options: ["ltr", "rtl"],
      description: "Направление текста и раскладки.",
      table: {
        category: "RadioGroup (Root)",
        type: { summary: '"ltr" | "rtl"' },
        defaultValue: { summary: '"ltr"' },
      },
    },
  },
  args: {
    defaultValue: "middle",
    disabled: false,
    orientation: "vertical",
    loop: true,
    required: false,
    dir: "ltr",
  },
} satisfies Meta<StoryRadioGroupProps>;

export default meta;
type Story = StoryObj<StoryRadioGroupProps>;

/**
 * Интерактивный RadioGroup со всеми доступными пропсами в Controls.
 */
export const Default: Story = {
  render: ({ orientation, ...args }) => (
    <RadioGroup
      orientation={orientation}
      className={
        orientation === "horizontal" ? "flex flex-row gap-6" : "grid gap-3"
      }
      {...args}
    >
      <div className="flex items-center space-x-2">
        <RadioGroup.Item value="junior" id="junior" />
        <Label htmlFor="junior" className="cursor-pointer">
          Junior (до 1 года)
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroup.Item value="middle" id="middle" />
        <Label htmlFor="middle" className="cursor-pointer">
          Middle (1–3 года)
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroup.Item value="senior" id="senior" />
        <Label htmlFor="senior" className="cursor-pointer">
          Senior (3+ лет)
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroup.Item value="lead" id="lead" />
        <Label htmlFor="lead" className="cursor-pointer">
          Team Lead
        </Label>
      </div>
    </RadioGroup>
  ),
};

/**
 * Контролируемый режим (Controlled Component).
 */
export const Controlled: Story = {
  render: () => {
    const [selectedRole, setSelectedRole] = useState("frontend");

    return (
      <div className="w-[380px] p-4 rounded-xl border border-border bg-card space-y-4">
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">Специализация интервью</h4>
          <p className="text-xs text-muted-foreground">
            Выберите основное направление собеседования.
          </p>
        </div>

        <RadioGroup value={selectedRole} onValueChange={setSelectedRole}>
          <div className="flex items-center space-x-2">
            <RadioGroup.Item value="frontend" id="role-frontend" />
            <Label htmlFor="role-frontend" className="cursor-pointer text-sm">
              Frontend разработчик
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroup.Item value="backend" id="role-backend" />
            <Label htmlFor="role-backend" className="cursor-pointer text-sm">
              Backend разработчик
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroup.Item value="fullstack" id="role-fullstack" />
            <Label htmlFor="role-fullstack" className="cursor-pointer text-sm">
              Fullstack инженер
            </Label>
          </div>
        </RadioGroup>

        <div className="p-2.5 rounded bg-muted text-xs font-mono">
          <strong>Выбрано:</strong> {selectedRole}
        </div>
      </div>
    );
  },
};

/**
 * Пример формы отклонения заявки (Reject Reason).
 */
export const RejectReasonForm: Story = {
  render: () => (
    <div className="w-[360px] p-4 rounded-xl border border-border bg-card shadow-sm space-y-4">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">Укажите причину отклонения</h4>
        <p className="text-xs text-muted-foreground">
          Собеседник получит уведомление с выбранной причиной.
        </p>
      </div>
      <RadioGroup defaultValue="time_mismatch">
        <div className="flex items-start space-x-2">
          <RadioGroup.Item
            value="time_mismatch"
            id="reason-1"
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="reason-1"
              className="text-sm font-medium cursor-pointer"
            >
              Не подходит время
            </Label>
            <p className="text-xs text-muted-foreground">
              Не совпадает часовой пояс или график созвонов
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroup.Item
            value="already_matched"
            id="reason-2"
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="reason-2"
              className="text-sm font-medium cursor-pointer"
            >
              Уже нашел пару
            </Label>
            <p className="text-xs text-muted-foreground">
              Карточка уже закрыта другим подтвержденным собеседованием
            </p>
          </div>
        </div>

        <div className="flex items-start space-x-2">
          <RadioGroup.Item
            value="level_mismatch"
            id="reason-3"
            className="mt-0.5"
          />
          <div className="space-y-0.5">
            <Label
              htmlFor="reason-3"
              className="text-sm font-medium cursor-pointer"
            >
              Разница в уровне/стеке
            </Label>
            <p className="text-xs text-muted-foreground">
              Ожидается другой стек технологий
            </p>
          </div>
        </div>
      </RadioGroup>
    </div>
  ),
};
