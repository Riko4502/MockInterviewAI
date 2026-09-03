import { Select } from "@packages/ui";
import type { Meta, StoryObj } from "@storybook/react";

/**
 * Метаданные компонента Select для Storybook.
 */
const meta = {
  title: "Components/Select",
  component: Select,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: `
### **Select** — выпадающий список выбора

Компонент для выбора одного значения из списка вариантов. Построен на базе доступного примитива \`radix-ui\` с поддержкой позиционирования выпадающего меню, группировки (\`Select.Group\`), разделителей (\`Select.Separator\`) и клавиатурной навигации.

---

### **Установка и импорт**
\`\`\`tsx
import { Select } from "@packages/ui";
\`\`\`

---

### **Базовый пример использования**
\`\`\`tsx
<Select defaultValue="middle">
  <Select.Trigger className="w-52">
    <Select.Value placeholder="Выберите грейд" />
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="junior">Junior</Select.Item>
    <Select.Item value="middle">Middle</Select.Item>
    <Select.Item value="senior">Senior</Select.Item>
    <Select.Item value="lead">Team Lead</Select.Item>
  </Select.Content>
</Select>
\`\`\`
`,
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "primary", "secondary"],
      description: "Визуальный стиль выпадающего списка.",
      table: {
        type: { summary: '"default" | "primary" | "secondary"' },
        defaultValue: { summary: '"default"' },
      },
    },
    value: {
      control: "text",
      description: "Управляемое значение выбранного элемента.",
      table: { type: { summary: "string" } },
    },
    defaultValue: {
      control: "text",
      description: "Неуправляемое начальное значение.",
      table: { type: { summary: "string" } },
    },
    disabled: {
      control: "boolean",
      description: "Блокирует компонент.",
      table: {
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    onValueChange: {
      action: "valueChange",
      description: "Обработчик смены выбранного значения.",
      table: { type: { summary: "(value: string) => void" } },
    },
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Стандартный выпадающий список выбора роли/грейда кандидата.
 */
export const Default: Story = {
  render: () => (
    <div className="w-60">
      <Select defaultValue="senior">
        <Select.Trigger>
          <Select.Value placeholder="Выберите уровень кандидата" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="junior">Junior Developer</Select.Item>
          <Select.Item value="middle">Middle Developer</Select.Item>
          <Select.Item value="senior">Senior Developer</Select.Item>
          <Select.Item value="lead">Lead / Architect</Select.Item>
        </Select.Content>
      </Select>
    </div>
  ),
};

/**
 * Группировка вариантов с заголовками (`Select.Group`, `Select.Label`).
 */
export const WithGroups: Story = {
  render: () => (
    <div className="w-64">
      <Select defaultValue="react">
        <Select.Trigger>
          <Select.Value placeholder="Выберите технологический стек" />
        </Select.Trigger>
        <Select.Content>
          <Select.Group>
            <Select.Label>Frontend</Select.Label>
            <Select.Item value="react">React / Next.js</Select.Item>
            <Select.Item value="vue">Vue / Nuxt</Select.Item>
            <Select.Item value="angular">Angular</Select.Item>
          </Select.Group>
          <Select.Separator />
          <Select.Group>
            <Select.Label>Backend</Select.Label>
            <Select.Item value="node">Node.js / NestJS</Select.Item>
            <Select.Item value="go">Go / Golang</Select.Item>
            <Select.Item value="python">Python / FastAPI</Select.Item>
          </Select.Group>
        </Select.Content>
      </Select>
    </div>
  ),
};

/**
 * Заблокированный селект (Disabled).
 */
export const Disabled: Story = {
  render: () => (
    <div className="w-60">
      <Select disabled defaultValue="locked">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="locked">Заблокированная опция</Select.Item>
        </Select.Content>
      </Select>
    </div>
  ),
};
